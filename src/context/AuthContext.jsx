// AuthContext.jsx - УПРОЩЕННАЯ ВЕРСИЯ
import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

// Настраиваем axios глобально
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
axios.defaults.withCredentials = true; // ВАЖНО для кук
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Сначала пытаемся получить CSRF токен
        // Делаем простой GET запрос на главную страницу или любой существующий endpoint
        await axios.get('/api/').catch(() => {
          // Игнорируем ошибки, нам главное получить куки
        });

        // 2. Загружаем пользователя из localStorage
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          // 3. Если пользователь не гость, НЕ проверяем токен (чтобы избежать 404)
          // Просто оставляем его как есть
        } else {
          // Создаем гостя
          const guestUser = {
            id: 'guest_' + Date.now(),
            username: 'Гость',
            email: null,
            isGuest: true,
            createdAt: new Date().toISOString()
          };
          localStorage.setItem("user", JSON.stringify(guestUser));
          setUser(guestUser);
        }
      } catch (error) {
        console.error('Ошибка инициализации:', error);
        // Создаем гостя при любой ошибке
        const guestUser = {
          id: 'guest_' + Date.now(),
          username: 'Гость',
          email: null,
          isGuest: true,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem("user", JSON.stringify(guestUser));
        setUser(guestUser);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Регистрация
  const register = async (userData) => {
    try {
      setError(null);
      
      // Делаем запрос через axios с настройками по умолчанию
      const response = await axios.post('/api/auth/signup/', userData);
      const { user, access, refresh } = response.data;

      // Сохраняем токены если есть
      if (access) localStorage.setItem('access_token', access);
      if (refresh) localStorage.setItem('refresh_token', refresh);

      // Сохраняем пользователя
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      return { success: true, data: response.data };
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          "Ошибка регистрации";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Вход
  const login = async (credentials) => {
    try {
      setError(null);
      
      const response = await axios.post('/api/auth/login/', credentials);
      const { user, access, refresh } = response.data;

      // Сохраняем токены если есть
      if (access) localStorage.setItem('access_token', access);
      if (refresh) localStorage.setItem('refresh_token', refresh);

      // Сохраняем пользователя
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      return { success: true, data: response.data };
    } catch (err) {
      console.error('Ошибка входа:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          "Ошибка входа";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Выход
  const logout = async () => {
    try {
      if (user && !user.isGuest) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            await axios.post('/api/auth/logout/', { refresh_token: refreshToken });
          } catch (logoutError) {
            console.warn('Ошибка выхода на сервере:', logoutError);
          }
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch (err) {
      console.error('Ошибка при выходе:', err);
    } finally {
      // Всегда создаем гостя
      const guestUser = {
        id: 'guest_' + Date.now(),
        username: 'Гость',
        email: null,
        isGuest: true,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem("user", JSON.stringify(guestUser));
      setUser(guestUser);
    }
  };

  // Обновление пользователя
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Очистка ошибки
  const clearError = () => setError(null);

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateUser,
    clearError,
    isAuthenticated: !!user && !user.isGuest,
    isGuest: user?.isGuest || false,
    isRegistered: user && !user.isGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};