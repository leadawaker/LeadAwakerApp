import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import i18n from "./i18n";

// força o idioma baseado na URL ANTES do React montar
const langFromPath = window.location.pathname.split("/")[1];

if (["en", "pt", "nl"].includes(langFromPath)) {
  i18n.changeLanguage(langFromPath);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);