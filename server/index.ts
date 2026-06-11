import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes/index";
import { serveStatic } from "./static";
import { createServer } from "http";
import { connect } from "net";
import { setupAuth } from "./auth";
import { verifySmtp } from "./email";
import { startSseListener } from "./sse-listener";

const app = express();
const httpServer = createServer(app);

// Trust Cloudflare proxy so secure cookies work over HTTPS tunnel
app.set("trust proxy", 1);

// Prevent unhandled errors from crashing the process
process.on("uncaughtException", (err) => {
  console.error("[express] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[express] unhandledRejection:", reason);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "20mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// CORS: allow cross-origin requests from Vercel-hosted frontend
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins, credentials: true }));
}

// Clickjacking protection: only allow same-origin framing.
// frame-ancestors overrides X-Frame-Options (even if Cloudflare adds it).
// Note: this disallows embedding in the code-server Simple Browser; if that
// is needed during local dev, add the explicit code-server origin here rather
// than reverting to the "*" wildcard (which lets any site iframe the app).
app.use((_req, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.removeHeader("X-Frame-Options");
  next();
});

// Auth: sessions + passport (must come before routes)
setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Premium landing page is the default homepage. Serve the static HTML at "/"
  // (before Vite middleware claims the route) and the JSX/asset sidecars at /premium/*.
  const premiumDir = path.resolve("client/public/premium");
  const sendPremium = (file: string) => (_req: Request, res: Response, next: NextFunction) => {
    fs.readFile(path.join(premiumDir, file), "utf-8", (err, html) => {
      if (err) return next();
      res.type("html").send(html);
    });
  };
  app.get("/", sendPremium("index.html"));
  app.get("/login", sendPremium("login.html"));
  app.use("/premium", express.static(premiumDir));

  // Dev: proxy /preview to legacy-handoff Vite dev server (HMR, no rebuild needed)
  app.use("/preview", async (req, res) => {
    try {
      const upstream = await fetch(`http://localhost:5173${req.originalUrl}`);
      res.status(upstream.status);
      const ct = upstream.headers.get("content-type");
      if (ct) res.set("content-type", ct);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(502).send("Vite not running. Run: cd /home/gabriel/legacy-handoff && npm run dev");
    }
  });

  // Proxy WebSocket upgrades to Vite dev server so HMR works through the tunnel
  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url) return;
    const isHmr = req.url.startsWith("/preview/") || req.url.startsWith("/@");
    if (!isHmr) return;
    const proxy = connect(5173, "localhost", () => {
      const headers = [
        `${req.method} ${req.url} HTTP/1.1`,
        ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`),
        "\r\n",
      ].join("\r\n");
      proxy.write(headers);
      proxy.write(head);
      socket.pipe(proxy);
      proxy.pipe(socket);
    });
    proxy.on("error", () => socket.destroy());
    socket.on("error", () => proxy.destroy());
  });

  await registerRoutes(httpServer, app);
  startSseListener(); // Real-time push via PostgreSQL LISTEN/NOTIFY
  verifySmtp(); // Log SMTP status at startup (non-blocking)

  // Log notification channel status at startup
  console.log("[notifications] VAPID configured:", !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY));
  console.log("[notifications] Telegram configured:", !!(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_WEBHOOK_URL));

  // Start Gmail sync polling (every 5 min)
  const { startGmailSync } = await import("./gmail-sync");
  startGmailSync();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[express] unhandled error:`, err);
    res.status(status).json({ message });
  });

  // In production, serve the pre-built static files.
  // In development with STANDALONE_API=true, skip Vite (frontend runs separately).
  // Otherwise, embed Vite middleware for single-port dev mode.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else if (!process.env.STANDALONE_API) {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
