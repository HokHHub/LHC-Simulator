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
      // Валидность токена проверится при первом реальном запросе
      const savedUser = localStorage.getItem("user");
      const accessToken = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");

      if (savedUser && accessToken && refreshToken) {
        try {
          const parsedUser = JSON.parse(savedUser);
          // Если это не гость, загружаем пользователя
          if (!parsedUser.isGuest) {
            setUser(parsedUser);
            setLoading(false);
            return;
          }
        } catch (err) {
          // Если не удалось распарсить - очищаем
          console.error('Ошибка парсинга user:', err);
          localStorage.removeItem('user');
        }
      }

      // Если пользователя нет или токены отсутствуют - создаем гостя
      const guestUser = {
        id: 'guest_' + Date.now(),
        username: 'Гость',
        email: null,
        isGuest: true,
      };
      localStorage.setItem("user", JSON.stringify(guestUser));
      setUser(guestUser);
      setLoading(false);
    };

    loadUser();
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
      console.log('Login response:', response);

      const { user, access, refresh } = response.data;
      console.log('Extracted:', { user, access, refresh });

      if (access) {
        localStorage.setItem('access_token', access);
        console.log('Access token saved');
      }
      if (refresh) {
        localStorage.setItem('refresh_token', refresh);
        console.log('Refresh token saved');
      }

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        setUser(user);
        console.log('User saved:', user);
      } else {
        console.error('No user in response!');
        return { success: false, error: 'Нет данных пользователя в ответе' };
      }

      return { success: true, data: response.data };
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.detail || "Ошибка входа";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
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
    isAuthenticated: !!user && !user.isGuest,
    isGuest: user?.isGuest || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};