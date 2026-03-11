import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for push notifications (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
