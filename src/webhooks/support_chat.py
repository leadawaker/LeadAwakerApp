"""
support_chat.py — Webhook handler for Tom support chat AI responses.

Receives a chat message payload from the Node.js Express layer (forwarded
from the n8n webhook), enriches the system prompt with live platform
context, calls the AI, and returns the response.

Expected incoming JSON:
  {
    "sessionId": str,
    "message":   str,
    "history":   list[dict],   # [{"role": "user"|"assistant", "content": str}]
    "systemPrompt": str,       # base system prompt from Prompt Library
    "userRole":  str,          # e.g. "Admin", "Operator", "Manager", "Viewer"
    "userId":    int
  }
"""

import asyncio
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

# Allow sibling package imports when run directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from tools.db.support_context import (
    get_platform_stats,
    get_all_accounts_detailed,
    format_context_for_prompt,
)

# ── Config ────────────────────────────────────────────────────────────────────

PORT = int(os.environ.get("SUPPORT_CHAT_PYTHON_PORT", "8766"))


# ── Core handler ──────────────────────────────────────────────────────────────

async def build_enriched_system_prompt(base_prompt: str, user_role: str) -> str:
    """
    Fetch live stats and append them to the base Tom system prompt.
    Admin users also receive a per-account breakdown.
    """
    try:
        stats = await get_platform_stats()

        # If user is admin, get detailed per-account breakdown
        accounts_detail = None
        if user_role in ("admin", "Admin"):
            accounts_detail = await get_all_accounts_detailed()

        context = format_context_for_prompt(stats, accounts_detail=accounts_detail)
        return f"{base_prompt}\n\n{context}"
    except Exception as exc:
        # Non-fatal: return base prompt unchanged if DB is unreachable
        print(f"[support_chat] Warning — could not fetch DB context: {exc}", flush=True)
        return base_prompt


def handle_chat_request(payload: dict) -> dict:
    """
    Synchronous entry point — runs the async enrichment and returns
    a dict ready to be serialised back to the caller.
    """
    session_id   = payload.get("sessionId", "")
    user_message = payload.get("message", "")
    history      = payload.get("history", [])
    base_prompt  = payload.get("systemPrompt", "")
    user_role    = payload.get("userRole", "Viewer")
    user_id      = payload.get("userId")

    # Enrich system prompt with live context
    enriched_prompt = asyncio.run(
        build_enriched_system_prompt(base_prompt, user_role)
    )

    # Return enriched prompt + metadata for n8n to consume
    return {
        "sessionId":    session_id,
        "userId":       user_id,
        "userRole":     user_role,
        "systemPrompt": enriched_prompt,
        "message":      user_message,
        "history":      history,
    }


# ── HTTP server (simple passthrough for n8n) ──────────────────────────────────

class SupportChatHandler(BaseHTTPRequestHandler):
    """
    Minimal HTTP handler so n8n can POST a chat payload and receive back
    an enriched payload (with live DB context injected into systemPrompt).
    n8n then forwards the enriched payload to the actual AI model.
    """

    def log_message(self, fmt, *args):
        print(f"[support_chat] {self.address_string()} — {fmt % args}", flush=True)

    def do_POST(self):
        if self.path != "/enrich":
            self._send(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            payload = json.loads(body)
        except Exception as exc:
            self._send(400, {"error": f"Invalid JSON: {exc}"})
            return

        try:
            result = handle_chat_request(payload)
            self._send(200, result)
        except Exception as exc:
            print(f"[support_chat] Error handling request: {exc}", flush=True)
            self._send(500, {"error": str(exc)})

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok"})
        else:
            self._send(404, {"error": "Not found"})

    def _send(self, status: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run():
    server = HTTPServer(("0.0.0.0", PORT), SupportChatHandler)
    print(f"[support_chat] Tom context enrichment server listening on port {PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run()
