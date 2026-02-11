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
      console.log('[Axios Request] URL:', url, 'Token:', token ? `${token.substring(0, 20)}...` : 'NONE');

      // защита от мусора
      if (token && token !== "undefined" && token !== "null") {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[Axios Request] Added Authorization header');
      } else {
        // если мусор — подчистим
        if (token) localStorage.removeItem("access_token");
        if (config.headers?.Authorization) delete config.headers.Authorization;
        console.log('[Axios Request] NO TOKEN - skipping Authorization header');
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // RESPONSE: token_not_valid => пробуем обновить токен; CSRF 403 => пробуем получить куку и повторить
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error?.response?.status;
      const data = error?.response?.data;

      // 1) JWT невалиден/истек => пробуем обновить access токен
      if (
        status === 401 &&
        (data?.code === "token_not_valid" ||
          (typeof data?.detail === "string" && data.detail.toLowerCase().includes("token")))
      ) {
        // Проверяем, что это не повторная попытка обновления токена
        if (!originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');

            // Если refresh токена нет - очищаем все и выходим
            if (!refreshToken || refreshToken === "undefined" || refreshToken === "null") {
              clearTokens();
              return Promise.reject(error);
            }

            // Пытаемся обновить access токен
            const response = await axios.post('/auth/token/refresh/', {
              refresh: refreshToken
            });

            const newAccessToken = response.data?.access;

            if (newAccessToken) {
              // Сохраняем новый access токен
              localStorage.setItem('access_token', newAccessToken);

              // Обновляем заголовок Authorization в оригинальном запросе
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

              // Повторяем оригинальный запрос с новым токеном
              return axios(originalRequest);
            } else {
              // Если новый токен не получен - чистим все
              clearTokens();
              return Promise.reject(error);
            }
          } catch (refreshError) {
            // Если обновление токена не удалось - чистим все
            clearTokens();
            return Promise.reject(refreshError);
          }
        } else {
          // Это уже повторная попытка - чистим токены
          clearTokens();
          return Promise.reject(error);
        }
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
