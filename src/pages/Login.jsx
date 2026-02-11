import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';
import authLogo from '../../tmp_figma_assets/5eb260ff1caa5240da9e589ef26a09893c07a01e.png';

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

    console.log('Submitting login with:', formData);
    const result = await login(formData);
    console.log('Login result:', result);

    if (result.success) {
      console.log('Login successful, navigating to:', from);
      navigate(from, { replace: true });
    } else {
      console.log('Login failed:', result.error);
      setErrors({ general: result.error });
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-page">
      <main className="auth-window auth-window--login" role="main" aria-label="Авторизация">
        <div className="auth-login-logo" aria-hidden="true">
          <img src={authLogo} alt="" />
        </div>

        <h1 className="auth-title">Добро пожаловать</h1>

        <form onSubmit={handleSubmit} className="auth-window-form auth-window-form--login" noValidate>
          {errors.general && <div className="auth-alert-error">{errors.general}</div>}

          <div className="auth-field">
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`auth-input ${errors.username ? 'auth-input-error' : ''}`}
              placeholder="Имя пользователя"
              autoComplete="username"
              required
            />
            {errors.username && <span className="auth-field-error">{errors.username}</span>}
          </div>

          <div className="auth-field">
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`auth-input ${errors.password ? 'auth-input-error' : ''}`}
              placeholder="Введите пароль"
              autoComplete="current-password"
              required
            />
            {errors.password && <span className="auth-field-error">{errors.password}</span>}
          </div>

          <span className="auth-divider" aria-hidden="true" />

          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? <span className="auth-spinner" /> : 'Войти'}
          </button>
        </form>

        <p className="auth-note">
          У вас нет аккаунта?{' '}
          <Link to="/register" className="auth-header-link">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
};

export default Login;
