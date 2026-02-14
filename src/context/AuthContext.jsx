// AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/auth';

const AuthContext = createContext(null);

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

      // Просто загружаем сохраненного пользователя из localStorage
      // Если нет токенов - пользователь не авторизован (user = null)
      const savedUser = localStorage.getItem("user");
      const accessToken = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");

      if (savedUser && accessToken && refreshToken) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
        } catch (err) {
          // Если не удалось распарсить - очищаем
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      } else {
        // Нет токенов - пользователь не авторизован
        setUser(null);
      }

      setLoading(false);
    };

    loadUser();

    // Слушаем событие очистки токенов от axios interceptor
    const handleAuthLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  const register = async (userData) => {
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
    try {
      setError(null);
      const response = await authAPI.login(credentials);

      const { user, access, refresh } = response.data;

      if (access) localStorage.setItem('access_token', access);
      if (refresh) localStorage.setItem('refresh_token', refresh);

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        setUser(user);
      } else {
        return { success: false, error: 'Нет данных пользователя в ответе' };
      }

      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Ошибка входа";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      if (user) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          await authAPI.logout(refreshToken);
        }
      }
    } catch (err) {
      console.error('Ошибка выхода:', err);
    } finally {
      // Очищаем все данные и токены
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: !!user,
    isGuest: false, // Больше нет гостевого режима
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};