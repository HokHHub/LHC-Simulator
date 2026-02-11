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
  axios.defaults.baseURL = import.meta.env.VITE_API_URL || "";
  axios.defaults.withCredentials = true;
  axios.defaults.xsrfCookieName = "csrftoken";
  axios.defaults.xsrfHeaderName = "X-CSRFToken";

  axios.interceptors.request.use(
    (config) => {
      const method = (config.method || "get").toLowerCase();
      const url = config.url || "";

      // CSRF для небезопасных методов
      if (["post", "put", "patch", "delete"].includes(method)) {
        const csrfToken = getCookie("csrftoken");
        if (csrfToken) {
          config.headers = config.headers || {};
          config.headers["X-CSRFToken"] = csrfToken;
        }
      }

      // JWT: НЕ добавляем на auth endpoints
      const skipAuth = NO_AUTH_URLS.some((p) => url.includes(p));
      if (skipAuth) {
        if (config.headers?.Authorization) delete config.headers.Authorization;
        return config;
      }

      const token = localStorage.getItem("access_token");
      if (token && token !== "undefined" && token !== "null") {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        if (token) localStorage.removeItem("access_token");
        if (config.headers?.Authorization) delete config.headers.Authorization;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error?.response?.status;
      const data = error?.response?.data;

      // 1) JWT невалиден/истек => refresh
      if (
        status === 401 &&
        (data?.code === "token_not_valid" ||
          (typeof data?.detail === "string" && data.detail.toLowerCase().includes("token")))
      ) {
        if (!originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem("refresh_token");
            if (!refreshToken || refreshToken === "undefined" || refreshToken === "null") {
              clearTokens();
              return Promise.reject(error);
            }

            const response = await axios.post("/auth/token/refresh/", { refresh: refreshToken });
            const newAccessToken = response.data?.access;

            if (newAccessToken) {
              localStorage.setItem("access_token", newAccessToken);
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return axios(originalRequest);
            }

            clearTokens();
            return Promise.reject(error);
          } catch (refreshError) {
            clearTokens();
            return Promise.reject(refreshError);
          }
        } else {
          clearTokens();
          return Promise.reject(error);
        }
      }

      // 2) CSRF ошибка => дергаем /api/csrf и повторяем 1 раз
      const isCsrfError =
        status === 403 &&
        (typeof data?.detail === "string" && data.detail.toLowerCase().includes("csrf"));

      if (isCsrfError && !originalRequest._csrfRetried) {
        originalRequest._csrfRetried = true;
        try {
          await axios.get("/api/csrf").catch(() => {});
          return axios(originalRequest);
        } catch (e) {
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  console.log("Axios настроен: CSRF + JWT + авто-refresh");
};

export default setupAxios;
