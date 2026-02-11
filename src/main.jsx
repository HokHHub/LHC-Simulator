import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import setupAxios from "./api/setupAxios";

setupAxios();


(function sanitizeAuthStorage() {
  const keys = ["access_token", "refresh_token"];

  for (const k of keys) {
    const v = localStorage.getItem(k);

    // ключ отсутствует — ок
    if (v == null) continue;

    // мусорные значения
    if (
      v === "" ||
      v === "undefined" ||
      v === "null" ||
      v === "NaN" ||
      v === "[object Object]"
    ) {
      localStorage.removeItem(k);
      continue;
    }

    // если кто-то положил JSON строку вместо токена
    // (иногда кладут {"access":"..."} или {"token":"..."} )
    if (v.trim().startsWith("{") || v.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(v);
        const token =
          parsed?.access ||
          parsed?.token ||
          parsed?.access_token ||
          parsed?.jwt ||
          null;

        if (typeof token === "string" && token.length > 10) {
          localStorage.setItem(k, token);
        } else {
          localStorage.removeItem(k);
        }
      } catch {
        localStorage.removeItem(k);
      }
    }
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
