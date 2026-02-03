// api/setupAxios.js
import axios from 'axios';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}


// Настройка axios глобально
const setupAxios = () => {
    // Базовые настройки
    axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
    axios.defaults.withCredentials = true;
    axios.defaults.xsrfCookieName = 'csrftoken';
    axios.defaults.xsrfHeaderName = 'X-CSRFToken';

    // Интерцептор для автоматического добавления access token
    axios.interceptors.request.use(
        (config) => {
            const method = (config.method || 'get').toLowerCase();

            // CSRF для небезопасных методов
            if (['post', 'put', 'patch', 'delete'].includes(method)) {
                const csrfToken = getCookie('csrftoken');
                if (csrfToken) {
                    config.headers = config.headers || {};
                    config.headers['X-CSRFToken'] = csrfToken;
                }
            }

            // JWT
            const token = localStorage.getItem('access_token');
            if (token) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${token}`;
            }

            return config;
        },
        (error) => Promise.reject(error)
    );


    // Интерцептор для обработки ошибок 403 (CSRF)
    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            // Если это CSRF ошибка (403)
            if (error.response?.status === 403 &&
                error.response?.data?.detail?.includes('CSRF')) {

                console.log('Обнаружена CSRF ошибка, пытаемся исправить...');

                // Пробуем сделать GET запрос чтобы получить CSRF куки
                try {
                    await axios.get('/api/csrf').catch(() => { });
                    // Повторяем оригинальный запрос
                    return axios(originalRequest);
                } catch (csrfError) {
                    console.error('Не удалось исправить CSRF:', csrfError);
                }
            }

            return Promise.reject(error);
        }
    );

    console.log('Axios настроен с поддержкой CSRF');
};

export default setupAxios;