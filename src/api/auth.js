// api/auth.js
import axios from 'axios';

// Настраиваем axios один раз
axios.defaults.withCredentials = true; // САМОЕ ВАЖНО
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.xsrfCookieName = 'csrftoken';

// Интерцептор для автоматической отправки CSRF
axios.interceptors.request.use(
  (config) => {
    // Для POST/PUT/PATCH/DELETE добавляем CSRF
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      // Получаем CSRF из кук
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
      
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    
    // Добавляем access token если есть
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// API методы - используем относительные пути
export const authAPI = {
  register: (userData) => axios.post('/auth/signup/', userData),
  login: (credentials) => axios.post('/auth/login/', credentials),
  logout: (refreshToken) => axios.post('/auth/logout/', { refresh_token: refreshToken }),
  getProfile: () => axios.get('/auth/profile/'),
  refreshToken: (refreshToken) => axios.post('/auth/token/refresh/', { refresh: refreshToken }),
};