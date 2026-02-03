import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';
import authPreview from '../../tmp_figma_assets/35fadc0f07ee1848bd818da637216a528c6ef85d.png';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

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

    const result = await register(formData);

    if (result.success) {
      navigate('/');
    } else {
      setErrors(typeof result.error === 'string' ? { general: result.error } : result.error);
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-page">
      <main className="auth-window auth-window--register" role="main" aria-label="Регистрация">
        <section className="auth-register-media" aria-hidden="true">
          <img src={authPreview} alt="" />
        </section>

        <section className="auth-register-panel">
          <header className="auth-register-header">
            <h1 className="auth-title">Регистрация</h1>
            <p className="auth-note auth-note--left">
              У вас уже есть аккаунт?{' '}
              <Link to="/login" className="auth-header-link">
                Log in
              </Link>
            </p>
          </header>

          <form onSubmit={handleSubmit} className="auth-window-form auth-window-form--register" noValidate>
            {errors.general && <div className="auth-alert-error">{errors.general}</div>}

            <div className="auth-row">
              <div className="auth-field">
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`auth-input ${errors.first_name ? 'auth-input-error' : ''}`}
                  placeholder="Имя"
                />
                {errors.first_name && <span className="auth-field-error">{errors.first_name}</span>}
              </div>

              <div className="auth-field">
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={`auth-input ${errors.last_name ? 'auth-input-error' : ''}`}
                  placeholder="Фамилия"
                />
                {errors.last_name && <span className="auth-field-error">{errors.last_name}</span>}
              </div>
            </div>

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
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`auth-input ${errors.email ? 'auth-input-error' : ''}`}
                placeholder="Электронная почта"
                autoComplete="email"
                required
              />
              {errors.email && <span className="auth-field-error">{errors.email}</span>}
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
                autoComplete="new-password"
                minLength={6}
                required
              />
              {errors.password && <span className="auth-field-error">{errors.password}</span>}
            </div>

            <div className="auth-field">
              <input
                type="password"
                id="password2"
                name="password2"
                value={formData.password2}
                onChange={handleChange}
                className={`auth-input ${errors.password2 ? 'auth-input-error' : ''}`}
                placeholder="Повторите пароль"
                autoComplete="new-password"
                minLength={6}
                required
              />
              {errors.password2 && <span className="auth-field-error">{errors.password2}</span>}
            </div>

            <span className="auth-divider" aria-hidden="true" />

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? <span className="auth-spinner" /> : 'Создать аккаунт'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Register;
