import React from "react";
import ReactDOM from "react-dom/client";
import App from "./src/App";
import "./src/index.css";

// Registro del Service Worker para PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) =>
        console.log("SW registrado: ", registration.scope),
      )
      .catch((err) => console.log("SW fallo: ", err));
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
