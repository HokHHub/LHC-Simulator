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

  useEffect(() => {
    if (!isOpen) return;
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

  useEffect(() => {
    if (!isOpen || hasLoadedRef.current) return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await authAPI.getLeaderboard();
        const payload = response?.data || {};
        const list = Array.isArray(payload.leaderboard)
          ? payload.leaderboard
          : [];
        setRows(list);
        onDataLoaded?.(list, payload.total_users ?? list.length);
        hasLoadedRef.current = true;
      } catch (err) {
        if (isDev) {
          setRows(devLeaderboard);
          onDataLoaded?.(devLeaderboard, devLeaderboard.length);
          hasLoadedRef.current = true;
        } else {
          setError(
            "Не удалось загрузить таблицу лидеров. Попробуйте ещё раз."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, isDev, onDataLoaded]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        onMouseDown={(e) => e.stopPropagation()}
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

            {!loading && !error && rows.length > 0 && (
              <div className={styles.listInner}>
                {rows.map((row) => {
                  const letter =
                    row?.username?.charAt(0)?.toUpperCase() || "?";
                  return (
                    <div
                      key={`${row.id}-${row.rank}`}
                      className={styles.row}
                      aria-label={`#${row.rank} ${row.username}`}
                    >
                      <span className={styles.srOnly}>
                        Место {row.rank}
                      </span>
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
