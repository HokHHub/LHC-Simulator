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
    // Просто получаем CSRF куку при загрузке
    const initCSRF = async () => {
      try {
        // Делаем GET запрос чтобы Django установил CSRF куку
        await fetch('/api/', {
          credentials: 'include' // важно!
        }).catch(() => {
          // Игнорируем ошибки
        });
      } catch (e) {
        console.log('CSRF init:', e.message);
      }
    };

    const loadUser = async () => {
      await initCSRF();
      
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

  // Регистрация
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

  // Вход
  const login = async (credentials) => {
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

  // Выход
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