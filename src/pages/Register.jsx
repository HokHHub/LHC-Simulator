import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Очищаем ошибку поля при изменении
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const result = await register(formData);

    if (result.success) {
      navigate('/');
    } else {
      setErrors(result.error);
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
            <h1 className="auth-title">Создать аккаунт</h1>
            <p className="auth-subtitle">Присоединяйтесь к LHC Simulator</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name" className="form-label">
                  Имя
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`form-input ${errors.first_name ? 'error' : ''}`}
                  placeholder="Иван"
                />
                {errors.first_name && (
                  <span className="form-error">{errors.first_name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="last_name" className="form-label">
                  Фамилия
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={`form-input ${errors.last_name ? 'error' : ''}`}
                  placeholder="Петров"
                />
                {errors.last_name && (
                  <span className="form-error">{errors.last_name}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Имя пользователя <span className="required">*</span>
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
              <label htmlFor="email" className="form-label">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="example@mail.com"
                required
              />
              {errors.email && (
                <span className="form-error">{errors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Пароль <span className="required">*</span>
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
                minLength={6}
              />
              {errors.password && (
                <span className="form-error">{errors.password}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password_confirm" className="form-label">
                Подтвердите пароль <span className="required">*</span>
              </label>
              <input
                type="password"
                id="password_confirm"
                name="password_confirm"
                value={formData.password_confirm}
                onChange={handleChange}
                className={`form-input ${errors.password_confirm ? 'error' : ''}`}
                placeholder="••••••••"
                required
                minLength={6}
              />
              {errors.password_confirm && (
                <span className="form-error">{errors.password_confirm}</span>
              )}
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Зарегистрироваться'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Уже есть аккаунт?{' '}
              <Link to="/login" className="auth-link">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
