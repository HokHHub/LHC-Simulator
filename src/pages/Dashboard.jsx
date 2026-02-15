import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getRankTitle = (rank) => {
    if (rank === 1) return 'Ученик';
    if (rank === 2) return 'Исследователь';
    if (rank >= 3) return 'Профессор';
    return 'Error';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <div className="ring ring-1"></div>
              <div className="ring ring-2"></div>
            </div>
            <span className="logo-text">LHC Simulator</span>
          </div>
          
          <div className="user-menu">
            <div className="user-info">
              <div className="user-avatar">
                {user?.first_name?.[0] || user?.username?.[0] || 'U'}
              </div>
              <div className="user-details">
                <div className="user-name">
                  {user?.first_name} {user?.last_name} {!user?.first_name && user?.username}
                </div>
                <div className="user-rank">{getRankTitle(user?.rank)}</div>
                <div className="user-email">{user?.email}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-section">
          <h1 className="welcome-title">
            Добро пожаловать, {user?.first_name || user?.username}!
          </h1>
          <p className="welcome-text">
            Вы успешно вошли в систему LHC Simulator
          </p>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">🔬</div>
            <h3>Симуляции</h3>
            <p>Запустите свою первую симуляцию столкновения частиц</p>
          </div>
          
          <div className="info-card">
            <div className="info-icon">📊</div>
            <h3>Результаты</h3>
            <p>Просмотрите историю ваших экспериментов</p>
          </div>
          
          <div className="info-card">
            <div className="info-icon">⚙️</div>
            <h3>Настройки</h3>
            <p>Настройте параметры симуляций</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
