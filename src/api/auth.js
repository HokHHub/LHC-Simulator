// api/auth.js
import axios from 'axios';

// Базовый URL API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Функция для получения CSRF токена из кук
const getCSRFToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (typeof document !== 'undefined' && document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

// Создаём экземпляр axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // ВАЖНО: для передачи кук (включая CSRF)
});

// Интерцептор для добавления токена и CSRF к запросам
api.interceptors.request.use(
  (config) => {
    // Добавляем access token если есть
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Для Django нужно добавлять CSRF токен к изменяющим методам
    // (POST, PUT, PATCH, DELETE)
    const csrfSafeMethod = (method) => {
      // Эти методы не требуют CSRF защиты
      return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
    };

    if (!csrfSafeMethod(config.method.toUpperCase())) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Функция для получения CSRF токена с сервера
export const getCSRFFromServer = async () => {
  try {
    // Этот запрос установит CSRF токен в куки
    const response = await api.get('/auth/csrf/', {
      withCredentials: true
    });
    
    // Если сервер возвращает токен в JSON
    if (response.data.csrfToken) {
      return response.data.csrfToken;
    }
    
    // Или берем из кук
    return getCSRFToken();
  } catch (error) {
    console.warn('Не удалось получить CSRF токен:', error);
    return null;
  }
};

// Интерцептор для обработки ошибок авторизации
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если это ошибка CSRF (403), пробуем обновить токен
    if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
      console.log('CSRF ошибка, пытаемся получить новый токен');
      
      // Пробуем получить новый CSRF токен
      try {
        const newCsrfToken = await getCSRFFromServer();
        if (newCsrfToken) {
          // Повторяем запрос с новым CSRF токеном
          originalRequest.headers['X-CSRFToken'] = newCsrfToken;
          return api(originalRequest);
        }
      } catch (csrfError) {
        console.error('Не удалось обновить CSRF токен:', csrfError);
      }
    }

    // Если получили 401 и это не повторный запрос
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // Получаем CSRF для запроса обновления токена
          const csrfToken = getCSRFToken();
          const headers = csrfToken ? { 'X-CSRFToken': csrfToken } : {};
          
          const response = await axios.post(
            `${API_BASE_URL}/auth/token/refresh/`,
            { refresh: refreshToken }, // Обратите внимание: обычно ключ 'refresh', а не 'refresh_token'
            {
              headers: {
                'Content-Type': 'application/json',
                ...headers
              },
              withCredentials: true
            }
          );
          
          const { access } = response.data;
          localStorage.setItem('access_token', access);
          
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Если обновление токена не удалось, выходим
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API методы
export const authAPI = {
  // Метод для получения CSRF
  getCSRF: () => api.get('/auth/csrf/'),
  
  // Основные методы с явной передачей конфига
  register: (userData, config = {}) => {
    const csrfToken = getCSRFToken();
    const headers = csrfToken ? { 'X-CSRFToken': csrfToken } : {};
    
    return api.post('/auth/signup/', userData, {
      ...config,
      headers: {
        ...config.headers,
        ...headers,
      },
      withCredentials: true,
    });
  },
  
  login: (credentials, config = {}) => {
    const csrfToken = getCSRFToken();
    const headers = csrfToken ? { 'X-CSRFToken': csrfToken } : {};
    
    return api.post('/auth/login/', credentials, {
      ...config,
      headers: {
        ...config.headers,
        ...headers,
      },
      withCredentials: true,
    });
  },
  
  logout: (refreshToken, config = {}) => {
    const csrfToken = getCSRFToken();
    const headers = csrfToken ? { 'X-CSRFToken': csrfToken } : {};
    
    return api.post('/auth/logout/', { refresh_token: refreshToken }, {
      ...config,
      headers: {
        ...config.headers,
        ...headers,
      },
      withCredentials: true,
    });
  },
  
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (userData) => api.patch('/auth/profile/', userData),
  refreshToken: (refreshToken) => api.post('/auth/token/refresh/', { refresh: refreshToken }),
};

export default api;