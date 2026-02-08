import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import styles from "./ProfilePage.module.css";

const mockProfile = {
  id: "dev_user",
  username: "Kleyman",
  email: "lhc-simulator@yandex.ru",
  first_name: "Kleyman",
  last_name: "",
};

const mockStats = {
  simulations: 25,
  points: 120,
  rank: "������",
};

const mockSimulations = [
  {
    id: 1,
    initial: "Proton + Neutron",
    final: "Sigma + Proton",
    energy: 12,
    type: "Hadron-Hadron",
    products: "Proton + Pion + Neutron",
    created_at: new Date(Date.now() - 60 * 1000).toISOString(),
  },
  {
    id: 2,
    initial: "Proton + Neutron",
    final: "Sigma + Proton",
    energy: 12,
    type: "Hadron-Hadron",
    products: "Proton + Pion + Neutron",
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    initial: "Proton + Neutron",
    final: "Sigma + Proton",
    energy: 12,
    type: "Hadron-Hadron",
    products: "Proton + Pion + Neutron",
    created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    initial: "Proton + Neutron",
    final: "Sigma + Proton",
    energy: 12,
    type: "Hadron-Hadron",
    products: "Proton + Pion + Neutron",
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
];

const mockLeaderboard = [
  { id: 1, username: "Kleyman", score: 120 },
  { id: 2, username: "Nova", score: 110 },
  { id: 3, username: "Quark", score: 98 },
];

const formatTimeAgo = (value) => {
  if (!value) return "1 ��� �����";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "1 ��� �����";
  const diffMs = Date.now() - parsed.getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} ��� �����`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} � �����`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} �� �����`;
};

const normalizeSimulation = (sim) => {
  const initial =
    sim?.initial ||
    sim?.initial_state ||
    sim?.initial_particles ||
    sim?.initialParticles ||
    "Proton + Neutron";
  const final =
    sim?.final ||
    sim?.final_state ||
    sim?.final_particles ||
    sim?.finalParticles ||
    "Sigma + Proton";
  const energy = sim?.energy ?? sim?.energy_gev ?? sim?.energyGeV ?? 12;
  const type = sim?.type || sim?.collision_type || sim?.mode || "Hadron-Hadron";
  const products =
    sim?.products ||
    sim?.final_products ||
    sim?.final_state ||
    "Proton + Pion + Neutron";
  const createdAt = sim?.created_at || sim?.createdAt || sim?.time || sim?.timestamp;

  return {
    id: sim?.id || `${initial}-${final}-${energy}`,
    initial,
    final,
    energy,
    type,
    products,
    timeAgo: formatTimeAgo(createdAt),
  };
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { logout, isDev } = useAuth();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      if (isDev) {
        if (!isMounted) return;
        setProfile(mockProfile);
        setStats(mockStats);
        setSimulations(mockSimulations);
        setLeaderboard(mockLeaderboard);
        setLoading(false);
        return;
      }

      try {
        const [profileRes, statsRes, simsRes, leaderboardRes] = await Promise.all([
          authAPI.getProfile(),
          authAPI.getMyStats(),
          authAPI.getMySimulations(),
          authAPI.getLeaderboard(),
        ]);

        if (!isMounted) return;
        setProfile(profileRes.data);
        setStats(statsRes.data);
        setSimulations(Array.isArray(simsRes.data) ? simsRes.data : simsRes.data?.results || []);
        setLeaderboard(
          Array.isArray(leaderboardRes.data) ? leaderboardRes.data : leaderboardRes.data?.results || []
        );
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.detail || "�� ������� ��������� ������ �������");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isDev]);

  useEffect(() => {
    if (!profile) return;
    setFormState({
      username: profile?.username || "",
      email: profile?.email || "",
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
    });
  }, [profile, isEditing]);

  const normalizedSims = useMemo(
    () => simulations.map(normalizeSimulation).slice(0, 4),
    [simulations]
  );

  const displayName =
    profile?.first_name || profile?.last_name
      ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
      : profile?.username || "User";

  const avatarLetter = (displayName || "U").charAt(0).toUpperCase();
  const simulationsCount =
    stats?.simulations ?? stats?.simulations_count ?? stats?.count ?? simulations.length ?? 0;
  const points = stats?.points ?? stats?.score ?? stats?.total_points ?? 0;
  const rankTitle = stats?.rank ?? stats?.level ?? "������";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleEditToggle = () => {
    setFormError("");
    setIsEditing((prev) => !prev);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError("");

    if (isDev) {
      setProfile((prev) => ({ ...prev, ...formState }));
      setIsSaving(false);
      setIsEditing(false);
      return;
    }

    try {
      await authAPI.updateProfile(formState);
      const updated = await authAPI.getProfile();
      setProfile(updated.data);
      setIsEditing(false);
    } catch (err) {
      setFormError(err?.response?.data?.detail || "�� ������� �������� �������");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <section className={styles.profileCard}>
          {isDev && <div className={styles.devBadge}>DEV MODE</div>}

          <div className={styles.userBlock}>
            <div className={styles.avatar}>{avatarLetter}</div>
            <div className={styles.userName}>{displayName}</div>
            <div className={styles.userEmail}>{profile?.email || ""}</div>
          </div>

          <div className={styles.rankTitle}>{rankTitle}</div>

          <div className={styles.statsCard}>
            <div className={styles.statsValue}>{simulationsCount}</div>
            <div className={styles.statsLabel}>симуляций</div>
            <div className={styles.statsPoints}>{points} Очков</div>
          </div>

          <div className={styles.leaderboardLabel} data-count={leaderboard.length}>
            Таблица лидеров
          </div>

          <div className={styles.buttonsBlock}>
            <div className={styles.buttonsInner}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleEditToggle}
              >
                Изменить профиль
              </button>
              <button type="button" className={styles.actionButton} onClick={handleLogout}>
                Выйти
              </button>
            </div>
            <div className={styles.helpText}>Нужна помощь?</div>
          </div>
        </section>

        <section className={styles.historyCard}>
          <div className={styles.historyTitle}>Ваши столкновения</div>

          <div className={styles.simList}>
            {loading && <div className={styles.stateText}>��������...</div>}
            {!loading && error && <div className={styles.stateText}>{error}</div>}
            {!loading && !error && normalizedSims.length === 0 && (
              <div className={styles.stateText}>Пока нет столкновений</div>
            )}
            {!loading && !error && normalizedSims.length > 0 && (
              <div className={styles.simListInner}>
                {normalizedSims.map((sim) => (
                  <div key={sim.id} className={styles.simItem}>
                    <div className={styles.simLeft}>
                      <div className={styles.simTitle}>{sim.initial}</div>
                      <div className={styles.simMeta}>
                        <span>{sim.energy} GeV</span>
                        <span>{sim.type}</span>
                      </div>
                    </div>
                    <div className={styles.simRight}>
                      <div className={styles.simTitleSecondary}>{sim.final}</div>
                      <div className={styles.simProducts}>{sim.products}</div>
                    </div>
                    <div className={styles.simTime}>{sim.timeAgo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {isEditing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>�������� �������</div>
            <form className={styles.modalForm} onSubmit={handleSubmit}>
              <label className={styles.inputLabel}>
                ��� ������������
                <input
                  className={styles.inputField}
                  name="username"
                  value={formState.username}
                  onChange={handleInputChange}
                  type="text"
                />
              </label>
              <label className={styles.inputLabel}>
                Email
                <input
                  className={styles.inputField}
                  name="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  type="email"
                />
              </label>
              <div className={styles.modalRow}>
                <label className={styles.inputLabel}>
                  ���
                  <input
                    className={styles.inputField}
                    name="first_name"
                    value={formState.first_name}
                    onChange={handleInputChange}
                    type="text"
                  />
                </label>
                <label className={styles.inputLabel}>
                  �������
                  <input
                    className={styles.inputField}
                    name="last_name"
                    value={formState.last_name}
                    onChange={handleInputChange}
                    type="text"
                  />
                </label>
              </div>
              {formError && <div className={styles.formError}>{formError}</div>}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={handleEditToggle}
                >
                  ������
                </button>
                <button type="submit" className={styles.actionButton} disabled={isSaving}>
                  {isSaving ? "����������..." : "���������"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

