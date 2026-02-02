import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const result = await login(formData);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrors({ general: result.error });
    }
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="particle-field">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${15 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-header">
            <div className="logo-mark">
              <div className="logo-rings">
                <div className="ring ring-1"></div>
                <div className="ring ring-2"></div>
                <div className="ring ring-3"></div>
              </div>
            </div>
            <h1 className="auth-title">Добро пожаловать</h1>
            <p className="auth-subtitle">Войдите в свой аккаунт</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {errors.general && (
              <div className="alert-error">
                {errors.general}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Имя пользователя
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`form-input ${errors.username ? 'error' : ''}`}
                placeholder="username"
                required
              />
              {errors.username && (
                <span className="form-error">{errors.username}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Пароль
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="••••••••"
                required
              />
              {errors.password && (
                <span className="form-error">{errors.password}</span>
              )}
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" className="checkbox-input" />
                <span>Запомнить меня</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">
                Забыли пароль?
              </Link>
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Нет аккаунта?{' '}
              <Link to="/register" className="auth-link">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
