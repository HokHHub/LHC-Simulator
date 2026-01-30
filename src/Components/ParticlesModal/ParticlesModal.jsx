import { useEffect, useMemo, useRef, useState } from "react";
import s from "./ParticlesModal.module.css";

import ParticleCard from "../ParticleCard/ParticleCard";
import Modal from "../Modal/Modal";

/**
 * props:
 * - isOpen: boolean
 * - onClose: () => void
 * - stages: [{ key, label, ids }]
 * - particlesById: Map<mcid, rawParticle>
 * - initialStageKey?: string
 * - title?: string
 */
export default function ParticlesModal({
  isOpen,
  onClose,
  stages = [],
  particlesById,
  initialStageKey,
  title = "Частицы",
}) {
  const [stageKey, setStageKey] = useState(
    initialStageKey || stages?.[0]?.key || ""
  );

  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const stageWrapRef = useRef(null);

  // детальная модалка
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // при открытии — сбрасываем стадию
  useEffect(() => {
    if (!isOpen) return;
    setStageKey(initialStageKey || stages?.[0]?.key || "");
  }, [isOpen, initialStageKey, stages]);

  // ESC закрывает только ЭТУ модалку
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // lock scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // закрытие селекта стадий кликом вне
  useEffect(() => {
    if (!stageMenuOpen) return;
    const onDown = (e) => {
      if (!stageWrapRef.current) return;
      if (!stageWrapRef.current.contains(e.target)) {
        setStageMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [stageMenuOpen]);

  const stage = useMemo(
    () => stages.find((s) => s.key === stageKey) || stages?.[0],
    [stages, stageKey]
  );

  const particles = useMemo(() => {
    const ids = stage?.ids || [];
    return ids
      .map((id) => {
        const raw = particlesById?.get(id) || null;
        return raw ? { id, raw } : null;
      })
      .filter(Boolean);
  }, [stage, particlesById]);

  function buildDetailData(raw, id) {
    const title = raw?.name || `PDG ${id}`;
    const iconText = raw?.symbol || raw?.name?.[0] || "?";
    const descr = raw?.descr || raw?.description || "";

    const mass = raw?.mass ?? raw?.mass_GeV ?? raw?.m ?? null;
    const charge = raw?.charge ?? null;
    const spin = raw?.spin ?? raw?.J ?? null;

    const color = raw?.color || "#4E3F8F";

    const stats = [
      { label: "Тип", value: raw?.type || "—" },
      { label: "PDG id", value: String(raw?.mcid ?? id ?? "—") },
      {
        label: "Масса",
        value: mass == null ? "—" : `${Number(mass).toFixed(1)} GeV`,
      },
      { label: "Спин", value: spin == null ? "—" : String(spin) },
      { label: "Заряд", value: charge == null ? "—" : String(charge) },
    ];

    return { title, descr, iconText, stats, color };
  }

  function stop(e) {
    e.stopPropagation();
  }

  if (!isOpen) return null;

  return (
    <>
      {/* ОСНОВНАЯ МОДАЛКА */}
      <div className={s.overlay} onMouseDown={onClose}>
        <div className={s.modal} onMouseDown={stop}>
          {/* HEADER */}
          <div className={s.header}>
            <div className={s.stageSelect} ref={stageWrapRef}>
              <button
                type="button"
                className={s.stageBtn}
                onClick={() => setStageMenuOpen((v) => !v)}
              >
                <span className={s.stageBtnText}>
                  {stage?.label || "Стадия"}
                </span>
                <span className={s.stageChevron}>▾</span>
              </button>

              {stageMenuOpen && (
                <div className={s.stageMenu}>
                  {stages.map((st) => (
                    <button
                      key={st.key}
                      className={`${s.stageItem} ${
                        st.key === stageKey ? s.stageItemActive : ""
                      }`}
                      onClick={() => {
                        setStageKey(st.key);
                        setStageMenuOpen(false);
                      }}
                    >
                      <span>{st.label}</span>
                      <span className={s.stageCount}>
                        {st.ids?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={s.title}>{title}</div>

            <button className={s.close} onClick={onClose}>
              ✕
            </button>
          </div>

          {/* CONTENT */}
          <div className={s.content}>
            {particles.length === 0 ? (
              <div className={s.empty}>Нет частиц</div>
            ) : (
              <div className={s.grid}>
                {particles.map(({ id, raw }, idx) => {
                  const particleForCard = {
                    symbol: raw.symbol ?? raw.name?.[0] ?? "?",
                    name: raw.name ?? `PDG ${id}`,
                    mass: raw.mass ?? raw.mass_GeV ?? null,
                    charge: raw.charge ?? 0,
                    spin: raw.spin ?? raw.J ?? "—",
                    color: raw.color ?? "#4E3F8F",
                  };

                  return (
                    <ParticleCard
                      key={`${id}-${idx}`}
                      particle={particleForCard}
                      onClick={() => {
                        setDetailData(buildDetailData(raw, id));
                        setDetailOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ДЕТАЛЬНАЯ МОДАЛКА */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        data={detailData}
      />
    </>
  );
}
