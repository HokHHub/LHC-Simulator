// src/api/setupAxios.js
import axios from "axios";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

const NO_AUTH_URLS = [
  "/auth/login/",
  "/auth/signup/",
  "/auth/token/refresh/",
  "/auth/logout/",
  "/csrf",
  "/api/csrf",
];

const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  // Отправляем событие для AuthContext
  window.dispatchEvent(new Event("auth:logout"));
};

const setupAxios = () => {
  // базовые настройки
  axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";
  axios.defaults.withCredentials = true;
  axios.defaults.xsrfCookieName = "csrftoken";
  axios.defaults.xsrfHeaderName = "X-CSRFToken";

  // REQUEST: CSRF + JWT (с исключениями)
  axios.interceptors.request.use(
    (config) => {
      const method = (config.method || "get").toLowerCase();
      const url = config.url || "";

      // 1) CSRF для небезопасных методов
      if (["post", "put", "patch", "delete"].includes(method)) {
        const csrfToken = getCookie("csrftoken");
        if (csrfToken) {
          config.headers = config.headers || {};
          config.headers["X-CSRFToken"] = csrfToken;
        }
      }

      // 2) JWT: НЕ добавляем на auth endpoints
      const skipAuth = NO_AUTH_URLS.some((p) => url.includes(p));

      if (skipAuth) {
        // на всякий случай убираем, если кто-то где-то добавил
        if (config.headers?.Authorization) delete config.headers.Authorization;
        return config;
      }

      const token = localStorage.getItem("access_token");

      // защита от мусора
      if (token && token !== "undefined" && token !== "null") {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // если мусор — подчистим
        if (token) localStorage.removeItem("access_token");
        if (config.headers?.Authorization) delete config.headers.Authorization;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // RESPONSE: token_not_valid => чистим токены; CSRF 403 => пробуем получить куку и повторить
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error?.response?.status;
      const data = error?.response?.data;

      // 1) JWT невалиден/истек => чистим токены
      if (
        status === 401 &&
        (data?.code === "token_not_valid" ||
          (typeof data?.detail === "string" && data.detail.toLowerCase().includes("token")))
      ) {
        clearTokens();
        return Promise.reject(error);
      }

      // 2) CSRF ошибка => пробуем подтянуть csrftoken и повторить запрос 1 раз
      const isCsrfError =
        status === 403 &&
        (typeof data?.detail === "string" && data.detail.toLowerCase().includes("csrf"));

      if (isCsrfError && !originalRequest._csrfRetried) {
        originalRequest._csrfRetried = true;

        try {
          // дергаем endpoint, который ставит csrftoken cookie
          // (подстрой путь под твой бэк: у тебя в логах было /api/csrf)
          await axios.get("/api/csrf").catch(() => {});
          return axios(originalRequest);
        } catch (e) {
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  console.log("Axios настроен: CSRF + JWT + авто-очистка token_not_valid");
};

export default setupAxios;
