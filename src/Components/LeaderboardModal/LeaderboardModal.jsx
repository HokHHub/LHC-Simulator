import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authAPI } from "../../api/auth";
import avatarBg from "../../assets/leaderboard-avatar.svg";
import styles from "./LeaderboardModal.module.css";

const devLeaderboard = [
  {
    rank: 1,
    id: 1,
    username: "Kleyman",
    rating_score: 120,
    simulation_count: 25,
    created_at: "2026-02-08T15:47:03.192167Z",
  },
  {
    rank: 2,
    id: 2,
    username: "Nova",
    rating_score: 110,
    simulation_count: 21,
    created_at: "2026-02-08T12:20:00.000000Z",
  },
  {
    rank: 3,
    id: 3,
    username: "Quark",
    rating_score: 98,
    simulation_count: 18,
    created_at: "2026-02-07T09:10:00.000000Z",
  },
  {
    rank: 4,
    id: 4,
    username: "Photon",
    rating_score: 85,
    simulation_count: 15,
    created_at: "2026-02-06T14:30:00.000000Z",
  },
  {
    rank: 5,
    id: 5,
    username: "Neutrino",
    rating_score: 72,
    simulation_count: 12,
    created_at: "2026-02-05T11:20:00.000000Z",
  },
];

export default function LeaderboardModal({
  isOpen,
  onClose,
  triggerRef,
  isDev,
  onDataLoaded,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasLoadedRef = useRef(false);
  const closeBtnRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Обработка открытия/закрытия модалки
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
      return;
    }

    previouslyFocusedRef.current = document.activeElement;

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;

      const focusTarget = triggerRef?.current || previouslyFocusedRef.current;
      focusTarget?.focus?.();
    };
  }, [isOpen, onClose, triggerRef]);

  // Загрузка данных
  useEffect(() => {
    if (!isOpen || hasLoadedRef.current) return;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        // Всегда пробуем загрузить данные с бэкенда
        const response = await authAPI.getLeaderboard();
        const payload = response?.data || response || {};
        
        let list = [];
        if (Array.isArray(payload.leaderboard)) {
          list = payload.leaderboard;
        } else if (Array.isArray(payload)) {
          list = payload;
        } else if (Array.isArray(payload.users)) {
          list = payload.users;
        } else if (Array.isArray(payload.results)) {
          list = payload.results;
        }

        // Проверяем и добавляем ранги, если их нет
        const processedList = list.map((item, index) => ({
          ...item,
          rank: item.rank ?? index + 1,
          rating_score: item.rating_score ?? item.score ?? item.points ?? 0,
          simulation_count: item.simulation_count ?? item.simulations ?? item.count ?? 0,
        }));

        setRows(processedList);
        onDataLoaded?.(processedList, payload.total_users ?? processedList.length);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error("Ошибка загрузки таблицы лидеров:", err);
        
        // В случае ошибки показываем dev данные
        setRows(devLeaderboard);
        onDataLoaded?.(devLeaderboard, devLeaderboard.length);
        hasLoadedRef.current = true;
        
        // Показываем ошибку только если это не 404 и не 401
        const status = err?.response?.status;
        if (status !== 404 && status !== 401) {
          setError("Не удалось загрузить таблицу лидеров");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, isDev, onDataLoaded]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Закрыть"
          ref={closeBtnRef}
        >
          ×
        </button>

        <div className={styles.inner}>
          <div className={styles.title} id="leaderboard-title">
            Активные участники
          </div>

          <div className={styles.list}>
            {loading && <div className={styles.stateText}>Загрузка...</div>}
            {!loading && error && (
              <div className={styles.stateText}>{error}</div>
            )}
            {!loading && !error && rows.length === 0 && (
              <div className={styles.stateText}>Пока нет участников</div>
            )}

            {!loading && rows.length > 0 && (
              <div className={styles.listInner}>
                {rows.map((row) => {
                  const letter = row?.username?.charAt(0)?.toUpperCase() || "?";
                  return (
                    <div
                      key={`${row.id}-${row.rank}`}
                      className={styles.row}
                      aria-label={`Место ${row.rank}: ${row.username}`}
                    >
                      <span className={styles.srOnly}>Место {row.rank}</span>
                      
                      <div className={styles.avatar}>
                        <img
                          src={avatarBg}
                          alt=""
                          className={styles.avatarBg}
                        />
                        <span className={styles.avatarLetter}>{letter}</span>
                      </div>

                      <div className={styles.username} title={row.username}>
                        {row.username}
                      </div>

                      <div className={styles.metrics}>
                        <div className={styles.metric}>
                          <div className={styles.metricValue}>
                            {row.simulation_count}
                          </div>
                          <div className={styles.metricLabel}>симуляций</div>
                        </div>
                        <div className={styles.metric}>
                          <div className={styles.metricValue}>
                            {row.rating_score}
                          </div>
                          <div className={styles.metricLabel}>очков</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}