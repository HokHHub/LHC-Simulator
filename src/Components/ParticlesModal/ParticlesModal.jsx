import { useEffect, useMemo, useRef, useState } from "react";
import s from "./ParticlesModal.module.css";

/**
 * stages: Array<{ key: string, label: string, ids: number[] }>
 * particlesById: Map<number, rawParticle>
 */
export default function ParticlesModal({
  isOpen,
  onClose,
  stages = [],
  particlesById,
  initialStageKey,
  title = "Частицы",
}) {
  const [stageKey, setStageKey] = useState(initialStageKey || stages?.[0]?.key || "");
  const dialogRef = useRef(null);

  // sync when reopened
  useEffect(() => {
    if (!isOpen) return;
    setStageKey(initialStageKey || stages?.[0]?.key || "");
  }, [isOpen, initialStageKey, stages]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const stage = useMemo(() => stages.find((x) => x.key === stageKey) || stages?.[0], [stages, stageKey]);

  const particles = useMemo(() => {
    const ids = stage?.ids || [];
    return ids
      .map((id) => {
        const raw = particlesById?.get?.(id) || null;
        return { id, raw };
      })
      .filter(Boolean);
  }, [stage, particlesById]);

  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const stageWrapRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (!stageWrapRef.current) return;
      if (!stageWrapRef.current.contains(e.target)) setStageMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  function formatCharge(q) {
    const n = Number(q);
    if (!Number.isFinite(n) || n === 0) return "0";
    if (n === 1) return "+1";
    if (n === -1) return "−1";
    // красивые дроби типа 2/3, -1/3 если это 0.6666
    const eps = 1e-6;
    const frac = [
      { v: 2 / 3, t: "2/3" },
      { v: 1 / 3, t: "1/3" },
      { v: 4 / 3, t: "4/3" },
      { v: 5 / 3, t: "5/3" },
    ];
    for (const f of frac) {
      if (Math.abs(Math.abs(n) - f.v) < eps) return (n < 0 ? "−" : "+") + f.t;
    }
    return (n > 0 ? "+" : "−") + String(Math.abs(n));
  }

  function getSymbol(raw) {
    if (!raw) return "?";
    // если ты добавлял symbol в json — юзаем его
    if (raw.symbol) return raw.symbol;
    // fallback
    return raw.name?.[0]?.toUpperCase?.() || "?";
  }

  function stop(e) {
    e.stopPropagation();
  }

  if (!isOpen) return null;

  return (
    <div className={s.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        onMouseDown={stop}
      >
        <div className={s.header}>
          <div className={s.stageSelect} ref={stageWrapRef}>
            <button
              type="button"
              className={s.stageBtn}
              onClick={() => setStageMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={stageMenuOpen}
            >
              <span className={s.stageBtnText}>{stage?.label || "Стадия"}</span>
              <span className={s.stageChevron}>▾</span>
            </button>

            {stageMenuOpen && (
              <div className={s.stageMenu} role="listbox">
                {stages.map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    className={`${s.stageItem} ${st.key === stageKey ? s.stageItemActive : ""}`}
                    onClick={() => {
                      setStageKey(st.key);
                      setStageMenuOpen(false);
                    }}
                    role="option"
                    aria-selected={st.key === stageKey}
                  >
                    <span>{st.label}</span>
                    <span className={s.stageCount}>{st.ids?.length || 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={s.title}>{title}</div>

          <button type="button" className={s.close} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className={s.content}>
          {particles.length === 0 ? (
            <div className={s.empty}>Нет частиц для отображения</div>
          ) : (
            <div className={s.grid}>
              {particles.map(({ id, raw }, idx) => {
                const name = raw?.name || `PDG ${id}`;
                const mass = raw?.mass ?? raw?.mass_GeV ?? raw?.m ?? null;
                const charge = raw?.charge ?? null;
                const spin = raw?.spin ?? raw?.J ?? null;

                return (
                  <div key={`${id}-${idx}`} className={s.card}>
                    <div className={s.cardTop}>
                      <div className={s.cardMeta}>
                        <div className={s.metaLine}>
                          {mass != null ? (
                            <>
                              <span className={s.metaValue}>{String(mass)}</span>
                              <span className={(s.metaUnit).toFixed(1)}> GeV</span>
                            </>
                          ) : (
                            <span className={s.metaMuted}>—</span>
                          )}
                        </div>

                        <div className={s.metaLine}>
                          <span className={s.metaLabel}>Q</span>
                          <span className={s.metaEq}>=</span>
                          <span className={s.metaValue}>{charge != null ? formatCharge(charge) : "—"}</span>
                        </div>

                        <div className={s.metaLine}>
                          <span className={s.metaLabel}>J</span>
                          <span className={s.metaEq}>=</span>
                          <span className={s.metaValue}>{spin != null ? String(spin) : "—"}</span>
                        </div>
                      </div>

                      <div className={s.avatarWrap}>
                        <div className={s.avatar}>
                          <span className={s.avatarText}>{getSymbol(raw)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={s.cardName}>{name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
