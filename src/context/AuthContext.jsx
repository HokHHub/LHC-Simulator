// AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/auth';

const AuthContext = createContext(null);

// Проверка, запущено ли на localhost
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initCSRF = async () => {
      try {
        await fetch('/csrf', {
          credentials: 'include'
        }).catch(() => {});
      } catch (e) {
        console.log('CSRF init:', e.message);
      }
    };

    const loadUser = async () => {
      await initCSRF();
      
      // Если localhost - создаем dev пользователя без авторизации
      if (isLocalhost) {
        const devUser = {
          id: 'dev_user',
          username: 'Developer',
          email: 'dev@localhost',
          isGuest: false,
          isDev: true, // флаг для отслеживания
        };
        localStorage.setItem("user", JSON.stringify(devUser));
        setUser(devUser);
        setLoading(false);
        return;
      }

      // Обычная логика для продакшена
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        const guestUser = {
          id: 'guest_' + Date.now(),
          username: 'Гость',
          email: null,
          isGuest: true,
        };
        localStorage.setItem("user", JSON.stringify(guestUser));
        setUser(guestUser);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const register = async (userData) => {
    // На localhost пропускаем регистрацию
    if (isLocalhost) {
      return { success: true, data: { user } };
    }

    try {
      setError(null);
      const response = await authAPI.register(userData);
      const { user, access, refresh } = response.data;
      
      if (access) localStorage.setItem('access_token', access);
      if (refresh) localStorage.setItem('refresh_token', refresh);
      
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Ошибка регистрации";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const login = async (credentials) => {
    // На localhost пропускаем логин
    if (isLocalhost) {
      return { success: true, data: { user } };
    }

    try {
      setError(null);
      const response = await authAPI.login(credentials);
      const { user, access, refresh } = response.data;
      
      if (access) localStorage.setItem('access_token', access);
      if (refresh) localStorage.setItem('refresh_token', refresh);
      
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Ошибка входа";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    // На localhost просто сбрасываем на dev пользователя
    if (isLocalhost) {
      const devUser = {
        id: 'dev_user',
        username: 'Developer',
        email: 'dev@localhost',
        isGuest: false,
        isDev: true,
      };
      localStorage.setItem("user", JSON.stringify(devUser));
      setUser(devUser);
      return;
    }

    try {
      if (user && !user.isGuest) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          await authAPI.logout(refreshToken);
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch (err) {
      console.error('Ошибка выхода:', err);
    } finally {
      const guestUser = {
        id: 'guest_' + Date.now(),
        username: 'Гость',
        email: null,
        isGuest: true,
      };
      localStorage.setItem("user", JSON.stringify(guestUser));
      setUser(guestUser);
    }
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: isLocalhost ? true : (!!user && !user.isGuest),
    isGuest: isLocalhost ? false : (user?.isGuest || false),
    isDev: isLocalhost, // добавляем флаг для компонентов
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};