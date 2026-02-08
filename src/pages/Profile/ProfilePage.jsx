import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import styles from "./ProfilePage.module.css";
import particlesData from "../../data/all_particles.json";
const particleById = new Map(
  (Array.isArray(particlesData) ? particlesData : []).map((p) => [p.mcid, p])
);

const titleCase = (s) => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const particleName = (mcid) => {
  const p = particleById.get(mcid);
  return titleCase(p?.name ?? String(mcid));
};

// Достаём ВСЕ id_* из объекта (id_1, id_2, id_3...) и превращаем в список имён
const extractIdsFromObj = (obj) => {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj)
    .filter((k) => k.startsWith("id_"))
    .sort() // id_1, id_2, id_3...
    .map((k) => obj[k])
    .filter((v) => v !== null && v !== undefined);
};


// делаем "γ(22)" или "K0(311)" — по желанию
const particleLabelWithId = (mcid) => {
  const p = particleById.get(mcid);
  const base = p?.symbol || p?.name || String(mcid);
  return `${base} (${mcid})`;
};


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
  rank: "Новичок",
};

const mockSimulations = [
  {
    id: 7,
    user_name: "jepstein",
    simulation_type: "hadron-hadron",
    energy: {
      source: "13.0",
      parsedValue: 13,
    },
    duration: null,
    simulation_results: [
      [{ id_1: 421, id_2: -421, id_3: 21 }],
      [{ id_1: 21, id_2: -511 }],
      [
        {
          Mass: 25.35581499892298,
          BaryonNum: { source: "0.0", parsedValue: 0 },
          "S,B,C": [0, 0, 0],
          Charge: { source: "0.0", parsedValue: 0 },
        },
      ],
    ],
    created_at: "2026-02-08T15:47:03.192167Z",
  },
  {
    id: 8,
    user_name: "dev_user",
    simulation_type: "hadron-hadron",
    energy: {
      source: "7.0",
      parsedValue: 7,
    },
    duration: 18.4,
    simulation_results: [
      [{ id_1: 2212, id_2: 2212 }],
      [{ id_1: 211, id_2: -211, id_3: 111 }],
      [
        {
          Mass: 9.12,
          BaryonNum: { source: "0.0", parsedValue: 0 },
          "S,B,C": [0, 0, 0],
          Charge: { source: "0.0", parsedValue: 0 },
        },
      ],
    ],
    created_at: "2026-02-08T12:20:00.000000Z",
  },
];

const mockLeaderboard = [
  { id: 1, username: "Kleyman", score: 120 },
  { id: 2, username: "Nova", score: 110 },
  { id: 3, username: "Quark", score: 98 },
];

const formatDateTime = (value) => {
  if (!value) return "Дата неизвестна";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Дата неизвестна";
  const date = parsed.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = parsed.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
};

const timeAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";

  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);

  if (sec < 5) return "только что";
  if (sec < 60) return `${sec} сек назад`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} дн назад`;

  // дальше уже лучше показывать дату
  return formatDateTime(iso);
};


const formatValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    if ("parsedValue" in value) return value.parsedValue;
    if ("source" in value) return value.source;
  }
  return value;
};

const formatResultEntry = (entry) => {
  if (!entry || typeof entry !== "object") return String(entry ?? "—");

  const parts = [];
  const hasIds = "id_1" in entry || "id_2" in entry || "id_3" in entry;

  if (hasIds) {
    const idParts = [];
    if ("id_1" in entry) idParts.push(`id_1=${formatValue(entry.id_1)}`);
    if ("id_2" in entry) idParts.push(`id_2=${formatValue(entry.id_2)}`);
    if ("id_3" in entry && entry.id_3 !== null && entry.id_3 !== undefined) {
      idParts.push(`id_3=${formatValue(entry.id_3)}`);
    }
    if (idParts.length > 0) parts.push(`Частицы: ${idParts.join(", ")}`);
  }

  if ("Mass" in entry) parts.push(`Масса: ${formatValue(entry.Mass)}`);
  if ("BaryonNum" in entry) parts.push(`Бар. число: ${formatValue(entry.BaryonNum)}`);
  if ("S,B,C" in entry) parts.push(`S,B,C: ${formatValue(entry["S,B,C"])}`);
  if ("Charge" in entry) parts.push(`Заряд: ${formatValue(entry.Charge)}`);

  if (parts.length === 0) return "Нет данных";
  return parts.join(", ");
};

const formatSimulationResults = (results) => {
  if (!Array.isArray(results) || results.length === 0) {
    return "Результаты отсутствуют";
  }

  return results
    .map((step, index) => {
      const entries = Array.isArray(step) ? step : [step];
      const formattedEntries = entries
        .map(formatResultEntry)
        .filter((item) => item && item !== "Нет данных");
      const stepText = formattedEntries.length > 0 ? formattedEntries.join("; ") : "Нет данных";
      return `Этап ${index + 1}: ${stepText}`;
    })
    .join(" | ");
};

const normalizeSimulation = (sim) => {
  const type =
    sim?.simulation_type ||
    sim?.type ||
    sim?.collision_type ||
    sim?.mode ||
    "Unknown";

  const energy = sim?.energy?.parsedValue ?? sim?.energy?.source ?? sim?.energy ?? null;

  const createdAt =
    sim?.created_at ||
    sim?.createdAt ||
    sim?.time ||
    sim?.timestamp ||
    null;

  const rawResults = Array.isArray(sim?.simulation_results) ? sim.simulation_results : [];

  // По твоему примеру:
  // step1 = [ { id_1, id_2, id_3? } ]  (вход/или первый этап)
  // step2 = [ { id_1, id_2, id_3? } ]  (выход/второй этап)
  const step1Obj = Array.isArray(rawResults?.[0]) ? rawResults[0]?.[0] : null;
  const step2Obj = Array.isArray(rawResults?.[1]) ? rawResults[1]?.[0] : null;

  const inIds = extractIdsFromObj(step1Obj);
  const outIds = extractIdsFromObj(step2Obj);

  const inTitle = inIds.length ? inIds.map(particleName).join(" + ") : "—";
  const outTitle = outIds.length
    ? outIds.slice(0, 2).map(particleName).join(" + ") // как на скрине: кратко
    : "—";

  const productsText = outIds.length ? outIds.map(particleName).join(" + ") : "—";

  // тип столкновения красивее
  const typeLabel =
    typeof type === "string"
      ? type
        .split("-")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join("-")
      : "Hadron-Hadron";

  return {
    id: sim?.id ?? `${type}-${createdAt || "unknown"}`,
    energyLabel: energy !== null && energy !== undefined ? `${energy} GeV` : "—",
    typeLabel,
    dateLabel: formatDateTime(createdAt),
    timeAgoLabel: timeAgo(createdAt),

    inTitle,
    outTitle,
    productsText,
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

        setSimulations(
          Array.isArray(simsRes.data)
            ? simsRes.data
            : simsRes.data?.simulations || simsRes.data?.results || []
        );

        setLeaderboard(
          Array.isArray(leaderboardRes.data)
            ? leaderboardRes.data
            : leaderboardRes.data?.results || []
        );
      } catch (err) {
        if (!isMounted) return;

        if (isDev) {
          setProfile(mockProfile);
          setStats(mockStats);
          setSimulations(mockSimulations);
          setLeaderboard(mockLeaderboard);
          setError("");
          return;
        }

        setError(err?.response?.data?.detail || "Не удалось загрузить данные профиля");
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
  const rankTitle = stats?.rank ?? stats?.level ?? "Ранг";

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
      setFormError(err?.response?.data?.detail || "Не удалось сохранить профиль");
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
            <div className={styles.statsLabel}>Симуляций</div>
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
                Редактировать
              </button>
              <button type="button" className={styles.actionButton} onClick={handleLogout}>
                Выйти
              </button>
            </div>
            <div className={styles.helpText}>Нужна помощь?</div>
          </div>
        </section>

        <section className={styles.historyCard}>
          <div className={styles.historyTitle}>История симуляций</div>

          <div className={styles.simList}>
            {loading && <div className={styles.stateText}>Загрузка...</div>}
            {!loading && error && <div className={styles.stateText}>{error}</div>}
            {!loading && !error && normalizedSims.length === 0 && (
              <div className={styles.stateText}>Пока нет симуляций</div>
            )}

            {!loading && !error && normalizedSims.length > 0 && (
              <div className={styles.simListInner}>
                {normalizedSims.map((sim) => (
                  <div key={sim.id} className={styles.simItem}>
                    <div className={styles.topRow}>
                      <div className={styles.titleLeft}>{sim.inTitle}</div>

                      <div className={styles.rightBlock}>
                        <div className={styles.titleRight}>{sim.outTitle}</div>
                        <div className={styles.timeAgo}>{sim.timeAgoLabel}</div>
                      </div>
                    </div>


                    <div className={styles.bottomRow}>
                      <div className={styles.metaLeft}>{sim.energyLabel}</div>
                      <div className={styles.metaCenter}>{sim.typeLabel}</div>
                      <div className={styles.metaRight}>{sim.productsText}</div>
                    </div>
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
            <div className={styles.modalTitle}>Редактировать профиль</div>
            <form className={styles.modalForm} onSubmit={handleSubmit}>
              <label className={styles.inputLabel}>
                Имя пользователя
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
                  Имя
                  <input
                    className={styles.inputField}
                    name="first_name"
                    value={formState.first_name}
                    onChange={handleInputChange}
                    type="text"
                  />
                </label>
                <label className={styles.inputLabel}>
                  Фамилия
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
                  Отмена
                </button>
                <button type="submit" className={styles.actionButton} disabled={isSaving}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
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
