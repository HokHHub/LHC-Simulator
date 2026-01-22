import styles from "./Modal.module.css";

export default function Modal({ isOpen, onClose, data }) {
  if (!isOpen) return null;

  const {
    title = "Proton",
    description = "Протон — первичный «кирпичик» видимой Вселенной...",
    iconText = "p",
    stats = [
      { label: "Семья", value: "Адрон" },
      { label: "Масса", value: "0,938 GeV" },
      { label: "Стабильность", value: "Стабилен" },
      { label: "Взаимодействие", value: "Сильное" },
      { label: "Спин", value: "1/2" },
      { label: "Заряд", value: "1" },
      { label: "S, C, B, L", value: "0, 0, 1, 0" },
      { label: "Состав", value: "uud" },
    ],
  } = data || {};

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.shell} onMouseDown={(e) => e.stopPropagation()} style={{"--accent-color": data.color || "#4E3F8F"}}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ✕
        </button>

        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.iconWrap}>
              <div className={styles.icon}><span>{iconText}</span></div>
            </div>

            <div className={styles.headText}>
              <div className={styles.title}>{title}</div>
              <div className={styles.desc}>{description}</div>
            </div>
          </div>

          <div className={styles.stats}>
            {stats.map((s, idx) => (
              <div className={styles.stat} key={idx}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statValue}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
