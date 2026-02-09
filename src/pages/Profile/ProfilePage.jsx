import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";

import LeaderboardModal from "../../Components/LeaderboardModal/LeaderboardModal";
import SupportChatModal from "../../Components/SupportChatModal/SupportChatModal";
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

// Достаём ВСЕ id_* из объекта (id_1, id_2, id_3...) и превращаем в список
const extractIdsFromObj = (obj) => {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj)
    .filter((k) => k.startsWith("id_"))
    .sort()
    .map((k) => obj[k])
    .filter((v) => v !== null && v !== undefined);
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
    energy: { source: "13.0", parsedValue: 13 },
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
    energy: { source: "7.0", parsedValue: 7 },
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

  return formatDateTime(iso);
};

const normalizeSimulation = (sim) => {
  const type =
    sim?.simulation_type ||
    sim?.type ||
    sim?.collision_type ||
    sim?.mode ||
    "Unknown";

  const energy = sim?.energy?.parsedValue ?? sim?.energy?.source ?? sim?.energy ?? null;
  const createdAt = sim?.created_at || sim?.createdAt || sim?.time || sim?.timestamp || null;

  const rawResults = Array.isArray(sim?.simulation_results) ? sim.simulation_results : [];

  const step1Obj = Array.isArray(rawResults?.[0]) ? rawResults[0]?.[0] : null; // productsText
  const step2Obj = Array.isArray(rawResults?.[1]) ? rawResults[1]?.[0] : null; // outTitle
  const step4Obj = Array.isArray(rawResults?.[3]) ? rawResults[3]?.[0] : null; // inTitle

  const extractInitIds = (obj) => {
    if (!obj || typeof obj !== "object") return [];
    const ids = [];
    if ("init_id1" in obj && obj.init_id1 !== null && obj.init_id1 !== undefined) {
      ids.push(obj.init_id1);
    }
    if ("init_id2:" in obj && obj["init_id2:"] !== null && obj["init_id2:"] !== undefined) {
      ids.push(obj["init_id2:"]);
    }
    if ("init_id2" in obj && obj.init_id2 !== null && obj.init_id2 !== undefined) {
      ids.push(obj.init_id2);
    }
    return ids;
  };

  const inIds = extractInitIds(step4Obj);
  const outIds = extractIdsFromObj(step2Obj);
  const productsIds = extractIdsFromObj(step1Obj);

  const inTitle = inIds.length ? inIds.map(particleName).join(" + ") : "—";
  const outTitle = outIds.length ? outIds.slice(0, 2).map(particleName).join(" + ") : "—";
  const productsText = productsIds.length ? productsIds.map(particleName).join(" + ") : "—";

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

  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboardCount, setLeaderboardCount] = useState(0);
  const leaderboardTriggerRef = useRef(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const supportTriggerRef = useRef(null);

  // Загружаем профиль/статы/историю
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const profileRes = await authAPI.getProfile();
        const statsRes = await authAPI.getMyStats();      // ← было getStats
        const simsRes = await authAPI.getMySimulations(); // ← было getSimulations

        if (!isMounted) return;

        setProfile(profileRes?.data ?? profileRes ?? null);
        setStats(statsRes?.data ?? statsRes ?? null);
        setSimulations(simsRes?.data ?? simsRes ?? []);
        setLoading(false);
      } catch (e) {
        if (!isMounted) return;
        setError(e?.response?.data?.detail || "Не удалось загрузить данные");
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isDev]);

  // Когда открыли редактирование — заполняем форму данными профиля
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

  // Поддержка разных форматов stats
  const simulationsCount =
    profile?.simulation_count ??
    stats?.simulation_count ??
    stats?.user?.simulation_count ??
    simulations?.length ??
    0;

  const points =
    profile?.rating_score ??
    stats?.rating_score ??
    stats?.user?.rating_score ??
    0;

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
      setProfile(updated?.data ?? updated ?? null);
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

          <a
            type="button"
            className={styles.leaderboardLabel}
            data-count={leaderboardCount}
            onClick={() => setIsLeaderboardOpen(true)}
            ref={leaderboardTriggerRef}
          >
            Таблица лидеров
          </a>

          <div className={styles.buttonsBlock}>
            <div className={styles.buttonsInner}>
              <button type="button" className={styles.actionButton} onClick={handleEditToggle}>
                Редактировать
              </button>
              <button type="button" className={styles.actionButton} onClick={handleLogout}>
                Выйти
              </button>
            </div>
            <div className={styles.helpText} onClick={() => setIsSupportOpen(true)}
              ref={supportTriggerRef}>Нужна помощь?</div>
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
                    <div className={styles.colLC}>
                      <div className={styles.colLeft}>
                        <div className={styles.titleLeft}>{sim.inTitle}</div>
                        <div className={styles.metaL}>
                          <div className={styles.metaLeft}>{sim.energyLabel}</div>
                          <div className={styles.metaType}>{sim.typeLabel}</div>
                        </div>
                      </div>

                      <div className={styles.colCenter}>
                        <div className={styles.titleRight}>{sim.outTitle}</div>
                        <div className={styles.metaProducts}>{sim.productsText}</div>
                      </div>
                    </div>

                    <div className={styles.colRight}>
                      <div className={styles.timeAgo}>{sim.timeAgoLabel}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        triggerRef={leaderboardTriggerRef}
        isDev={isDev}
        onDataLoaded={(rows) => setLeaderboardCount(rows?.length || 0)}
      />

      <SupportChatModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        triggerRef={supportTriggerRef}
        userName={profile?.username || displayName || "Пользователь"}
      />

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
                <button type="button" className={styles.actionButton} onClick={handleEditToggle}>
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
