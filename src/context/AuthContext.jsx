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
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      // Создаем временного (гостевого) пользователя
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
    setLoading(false);
  }, []);

  // Регистрация (теперь опциональна)
  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);
      const { user } = response.data;

      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Ошибка регистрации";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Вход (теперь не обязателен)
  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);
      const { user } = response.data;

      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Ошибка входа";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Выход с учетом гостевого режима
  const logout = async () => {
    try {
      // Если пользователь был зарегистрирован, отправляем запрос на сервер
      if (user && !user.isGuest) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          await authAPI.logout(refreshToken);
        }
      }
    } catch (err) {
      console.error('Ошибка при выходе:', err);
    } finally {
      // Очищаем токены только для зарегистрированных пользователей
      if (user && !user.isGuest) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      
      // Создаем нового гостевого пользователя
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

  // Конвертация гостя в зарегистрированного пользователя
  const convertGuestToUser = async (userData) => {
    try {
      // Если есть данные гостя, можно отправить их на сервер
      const guestData = {
        ...userData,
        guestId: user?.id,
        guestData: localStorage.getItem('guest_cart') // пример: сохраненная корзина
      };

      const response = await authAPI.register(guestData);
      const { user: newUser } = response.data;

      // Переносим данные из гостевого аккаунта
      const guestCart = localStorage.getItem('guest_cart');
      if (guestCart) {
        localStorage.setItem('user_cart', guestCart);
        localStorage.removeItem('guest_cart');
      }

      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Ошибка регистрации";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateUser,
    convertGuestToUser,
    isAuthenticated: !!user,
    isGuest: user?.isGuest || false,
    isRegistered: user && !user.isGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};