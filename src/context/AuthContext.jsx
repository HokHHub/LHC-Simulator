// AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, getCSRFFromServer } from '../api/auth';

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

  // Инициализация CSRF и пользователя
  const initializeApp = async () => {
    try {
      // Пытаемся получить CSRF токен
      await getCSRFFromServer();
      
      // Загружаем пользователя
      const savedUser = localStorage.getItem("user");
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          // Если пользователь не гость, проверяем его токен
          if (!parsedUser.isGuest) {
            try {
              await authAPI.getProfile();
            } catch (profileError) {
              console.log('Токен недействителен, переводим в гости');
              createGuestUser();
            }
          }
        } catch (e) {
          console.error('Ошибка парсинга пользователя:', e);
          createGuestUser();
        }
      } else {
        createGuestUser();
      }
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      createGuestUser();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const createGuestUser = () => {
    const guestUser = {
      id: 'guest_' + Date.now(),
      username: 'Гость',
      email: null,
      isGuest: true,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem("user", JSON.stringify(guestUser));
    setUser(guestUser);
  };

  // Регистрация
  const register = async (userData) => {
    try {
      setError(null);
      
      // Убедимся, что CSRF токен есть
      await getCSRFFromServer();
      
      const response = await authAPI.register(userData);
      const { user, access, refresh } = response.data;

      // Сохраняем токены
      if (access && refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
      }

      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      return { success: true, data: response.data };
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.response?.data?.non_field_errors?.[0] || 
                          err.response?.data?.email?.[0] ||
                          err.response?.data?.username?.[0] ||
                          "Ошибка регистрации";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Вход
  const login = async (credentials) => {
    try {
      setError(null);
      
      // Убедимся, что CSRF токен есть
      await getCSRFFromServer();
      
      const response = await authAPI.login(credentials);
      const { user, access, refresh } = response.data;

      // Сохраняем токены
      if (access && refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
      }

      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      return { success: true, data: response.data };
    } catch (err) {
      console.error('Ошибка входа:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.response?.data?.non_field_errors?.[0] ||
                          "Неверный email или пароль";
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
          // Убедимся, что CSRF токен есть
          await getCSRFFromServer();
          await authAPI.logout(refreshToken);
        }
      }
    } catch (err) {
      console.error('Ошибка при выходе:', err);
      // Продолжаем даже при ошибке
    } finally {
      // Всегда очищаем локальные данные
      if (user && !user.isGuest) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      
      createGuestUser();
    }
  };

  // Обновление пользователя
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Конвертация гостя в пользователя
  const convertGuestToUser = async (userData) => {
    try {
      setError(null);
      
      // Убедимся, что CSRF токен есть
      await getCSRFFromServer();
      
      // Добавляем информацию о госте
      const registrationData = {
        ...userData,
        guestId: user?.id
      };

      const response = await authAPI.register(registrationData);
      const { user: newUser, access, refresh } = response.data;

      // Сохраняем токены
      if (access && refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
      }

      // Переносим данные гостя
      const guestCart = localStorage.getItem('guest_cart');
      if (guestCart) {
        localStorage.setItem('user_cart', guestCart);
        localStorage.removeItem('guest_cart');
      }

      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      return { success: true, data: response.data };
    } catch (err) {
      console.error('Ошибка конвертации:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.response?.data?.non_field_errors?.[0] ||
                          err.response?.data?.email?.[0] ||
                          err.response?.data?.username?.[0] ||
                          "Ошибка регистрации";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
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
    convertGuestToUser,
    clearError,
    isAuthenticated: !!user && !user.isGuest,
    isGuest: user?.isGuest || false,
    isRegistered: user && !user.isGuest,
    refreshCSRF: getCSRFFromServer, // Функция для обновления CSRF вручную
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};