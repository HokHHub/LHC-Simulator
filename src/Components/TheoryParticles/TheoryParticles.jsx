import { useState } from "react";
import Container3 from "../Container3/Container3";
import ParticleCard from "../ParticleCard/ParticleCard";
import Modal from "../Modal/Modal";
import s from "./TheoryParticles.module.css";

import bgImage from "../../assets/figma/cc3914e83957df4b277a50d89002f3e999873b15.png";
import structure from "../../assets/figma/structure.png";
import atomImg from "../../assets/figma/e6f03190f6bf89efb03ed9213984c12ddf775be5.png";
import nucleusImg from "../../assets/figma/940364d78c6ab904c065b9a3b745883e3c492252.png";
import protonImg from "../../assets/figma/28661d270ca82590607b1af85deea30c4eaf359a.png";

import gravityIcon from "../../assets/figma/4982d4e41077ce6f0029e4c36aa5c7626f0ae61e.png";
import emIcon from "../../assets/figma/69958fb52c478f8910b23f02cac731a051b87800.png";
import strongIcon from "../../assets/figma/7f51cd5c5f6f1f1a92c84a5098907f07175e1dae.png";
import weakIcon from "../../assets/figma/d27c5749757f09f0ba76c56bbebae130b68d4244.png";

import fermionLine from "../../assets/figma/e5ece93b81147485820e273ee528aa2a0716b9e1.png";
import antifermionLine from "../../assets/figma/d6f7401df03760c43cf3f0a38836366648345e80.png";
import photonLine from "../../assets/figma/61a113c7e4833fd950d15aaeb8338536f056e590.png";
import bosonLine from "../../assets/figma/910b4892ee303c637b8a85b3d5e766b9d80460e0.png";
import gluonLine from "../../assets/figma/28661d270ca82590607b1af85deea30c4eaf359a.png";

import atom from "/img/atom.gif";
import orbital from "/img/orbital.png";

// Импортируем данные из JSON
import particlesData from "../../data/all_particles.json";

const generationHeaders = ["I поколение", "II поколение", "III поколение"];

const toneColor = {
  quark: "#A05BC9",
  lepton: "#528F3F",
  boson: "#B84B2C",
};

// Сопоставление ID с именами частиц из JSON
const particleMapping = [
  // Кварки - 1 строка
  { row: 0, col: 0, name: "Up Quark" },        // u
  { row: 0, col: 1, name: "Charm Quark" },     // c
  { row: 0, col: 2, name: "Top Quark" },       // t
  { row: 0, col: 3, name: "gluon" },           // g

  // Кварки - 2 строка
  { row: 1, col: 0, name: "Down Quark" },      // d
  { row: 1, col: 1, name: "Strange Quark" },   // s
  { row: 1, col: 2, name: "Bottom Quark" },    // b
  { row: 1, col: 3, name: "photon" },          // γ

  // Лептоны - 3 строка
  { row: 2, col: 0, name: "electron" },        // e
  { row: 2, col: 1, name: "muon" },            // μ
  { row: 2, col: 2, name: "tau-" },            // τ
  { row: 2, col: 3, name: "Z0" },              // Z

  // Лептоны - 4 строка
  { row: 3, col: 0, name: "electron neutrino" }, // νe
  { row: 3, col: 1, name: "muon neutrino" },     // νμ
  { row: 3, col: 2, name: "tau neutrino" },      // ντ
  { row: 3, col: 3, name: "W+" },                // W⁺
];

const extraBosonsMapping = [
  { id: "graviton", title: "Гипотетический бозон", tone: "boson" },
  { id: "higgs", title: "Скалярный бозон", name: "higgs", tone: "boson" },
];

const interactions = [
  {
    id: "gravity",
    title: "Гравитационное",
    icon: gravityIcon,
    description: "Взаимодействие между всеми объектами, обладающими массой.",
    range: "Дальность действия: ∞",
    carrier: "Переносчик: гравитон.",
  },
  {
    id: "electromagnetic",
    title: "Электромагнитное",
    icon: emIcon,
    description: "Взаимодействие заряженных частиц. Основа химии, электричества и света.",
    range: "Дальность действия: ∞",
    carrier: "Переносчик: фотон.",
  },
  {
    id: "strong",
    title: "Сильное",
    icon: strongIcon,
    description: "Удерживает кварки в протонах и нейтронах, связывает атомные ядра.",
    range: "Дальность действия: ~10⁻¹⁵ м",
    carrier: "Переносчик: глюон.",
  },
  {
    id: "weak",
    title: "Слабое",
    icon: weakIcon,
    description: "Ответственно за радиоактивный распад и термоядерные реакции в звёздах.",
    range: "Дальность действия: ~10⁻¹⁸ м",
    carrier: "Переносчики: W± и Z⁰ бозоны.",
  },
];

const feynmanLegend = [
  { id: "fermion", label: "Фермион", img: fermionLine },
  { id: "antifermion", label: "Антифермион", img: antifermionLine },
  { id: "photon", label: "Фотон", img: photonLine },
  { id: "boson", label: "Бозон", img: bosonLine },
  { id: "gluon", label: "Глюон", img: gluonLine },
];

// Функция для поиска частицы по имени
function findParticleByName(name) {
  return particlesData.find(p => p.name.toLowerCase() === name.toLowerCase());
}

// Функция для определения типа частицы
function getParticleType(tone) {
  switch(tone) {
    case "quark": return "Кварк";
    case "lepton": return "Лептон";
    case "boson": return "Бозон";
    default: return "Частица";
  }
}

// Функция для форматирования массы с единицами измерения
function formatMassWithUnit(mass) {
  if (mass === 0) return "0";
  if (mass < 0.001) return `${mass} эВ`; // Для очень малых масс
  if (mass < 1) return `${(mass * 1000).toFixed(2)} МэВ`; // Конвертируем в МэВ
  return `${mass.toFixed(3)} ГэВ`; // Для больших масс
}

// Функция для форматирования заряда для отображения
function formatChargeDisplay(charge) {
  if (charge === 0) return "0";
  if (charge === 1) return "+1";
  if (charge === -1) return "-1";
  if (charge === 2) return "+2";
  if (charge === -2) return "-2";
  if (charge === 0.6666666666666666) return "+2/3";
  if (charge === -0.3333333333333333) return "-1/3";
  return charge.toString();
}

// Функция преобразования данных из JSON в формат для ParticleCard
function toParticleCardData(particle, tone) {
  if (!particle) return null;

  // Функция для округления массы
  const formatMass = (mass) => {
    if (mass === 0 || mass === undefined) return 0;

    // Для очень маленьких значений (как у электрона 0.00051099895)
    if (Math.abs(mass) < 0.001) {
      return mass; // оставляем как есть для научной нотации
    }

    // Для обычных значений - округляем до 3 знаков
    return Math.round(mass * 1000) / 1000;
  };

  // Функция для форматирования заряда
  const formatCharge = (charge) => {
    if (charge === undefined) return "0";

    // Округляем до 2 знаков и убираем .0 если целое
    const rounded = Math.round(charge * 100) / 100;
    return rounded.toString();
  };

  return {
    symbol: particle.symbol || "",
    name: particle.name || "",
    mass: formatMass(particle.mass),
    charge: formatCharge(particle.charge),
    spin: particle.spin || "",
    color: toneColor[tone] || toneColor.boson,
    fullData: particle, // Сохраняем полные данные для модалки
    tone: tone,
  };
}

// Функция для подготовки данных модалки
function prepareModalData(particleCardData) {
  if (!particleCardData || !particleCardData.fullData) return null;
  
  const particle = particleCardData.fullData;
  const tone = particleCardData.tone;
  
  // Определяем семейство
  let family = getParticleType(tone);
  if (tone === "boson") {
    family = particle.spin === "0" ? "Скалярный бозон" : "Векторный бозон";
  }
  
  // Определяем взаимодействия
  let interaction = "";
  if (tone === "quark") interaction = "Сильное, электрослабое";
  else if (tone === "lepton") interaction = particle.charge !== 0 ? "Электромагнитное, слабое" : "Слабое";
  else if (tone === "boson") {
    if (particle.name.toLowerCase().includes("gluon")) interaction = "Сильное";
    else if (particle.name.toLowerCase().includes("photon")) interaction = "Электромагнитное";
    else if (particle.name.toLowerCase().includes("w") || particle.name.toLowerCase().includes("z")) interaction = "Слабое";
    else if (particle.name.toLowerCase().includes("higgs")) interaction = "Хиггсовское";
  }
  
  // Квантовые числа
  const quantumNumbers = [];
  if (particle.name.toLowerCase().includes("up")) quantumNumbers.push("I₃ = +1/2");
  if (particle.name.toLowerCase().includes("down")) quantumNumbers.push("I₃ = -1/2");
  if (particle.name.toLowerCase().includes("strange")) quantumNumbers.push("S = -1");
  if (particle.name.toLowerCase().includes("charm")) quantumNumbers.push("C = +1");
  if (particle.name.toLowerCase().includes("bottom")) quantumNumbers.push("B = -1");
  if (particle.name.toLowerCase().includes("top")) quantumNumbers.push("T = +1");
  
  return {
    title: particle.name,
    descr: particle.descr || `Описание для ${particle.name} отсутствует.`,
    iconText: particle.symbol || "?",
    color: toneColor[tone] || "#4E3F8F",
    stats: [
      { label: "Семья", value: family },
      { label: "Масса", value: formatMassWithUnit(particle.mass) },
      { label: "Стабильность", value: particle.mass === 0 ? "Стабилен" : "Нестабилен" },
      { label: "Взаимодействие", value: interaction || "Не определено" },
      { label: "Спин", value: particle.spin || "?" },
      { label: "Заряд", value: formatChargeDisplay(particle.charge) },
      { label: "Квантовые числа", value: quantumNumbers.length > 0 ? quantumNumbers.join(", ") : "Нет" },
      { label: "Состав", value: particle.struct || (tone === "quark" ? "Элементарный" : tone === "lepton" ? "Элементарный" : "Фундаментальный") },
    ],
  };
}

export default function TheoryParticles() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

  // Создаем двумерный массив частиц для сетки
  const gridParticles = [];

  for (let row = 0; row < 4; row++) {
    gridParticles[row] = [];
    for (let col = 0; col < 4; col++) {
      const mapping = particleMapping.find(m => m.row === row && m.col === col);
      if (mapping) {
        const particle = findParticleByName(mapping.name);
        let tone = "boson";
        if (row < 2) tone = "quark";
        else if (row < 4) tone = "lepton";
        gridParticles[row][col] = {
          ...mapping,
          particle,
          tone
        };
      } else {
        gridParticles[row][col] = null;
      }
    }
  }

  const handleParticleClick = (item) => {
    if (!item || !item.particle) return;
    
    const cardData = toParticleCardData(item.particle, item.tone);
    const modalData = prepareModalData(cardData);
    setModalData(modalData);
    setIsModalOpen(true);
  };

  const renderModelCard = (item) => {
    if (!item || !item.particle) return <div key={Math.random()} className={s.cardWrap}></div>;

    return (
      <div 
        key={`${item.row}-${item.col}`} 
        className={s.cardWrap}
        onClick={() => handleParticleClick(item)}
        style={{ cursor: "pointer" }}
      >
        <ParticleCard particle={toParticleCardData(item.particle, item.tone)} />
      </div>
    );
  };

  // Получаем частицы для дополнительных бозонов
  const extraBosons = extraBosonsMapping.map(item => {
    if (item.name) {
      const particle = findParticleByName(item.name);
      return { ...item, particle };
    }
    return item;
  });

  const handleExtraBosonClick = (item) => {
    if (!item.particle) return;
    
    const cardData = toParticleCardData(item.particle, item.tone);
    const modalData = prepareModalData(cardData);
    setModalData(modalData);
    setIsModalOpen(true);
  };

  return (
    <div className={s.theoryParticles}>
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        data={modalData}
      />

      <section className={s.hero}>
        <img className={s.heroImg} src={bgImage} alt="" />
        <h1 className={s.heroTitle}>Теория элементарных частиц</h1>
      </section>

      <section className={s.textSection}>
        <Container3>
          <p><span style={{color: "#008DD8"}}>Стандартная модель (СМ)</span> — это математический каркас, объединяющий квантовую механику и специальную теорию относительности для описания элементарных частиц и их взаимодействий. Она была окончательно сформулирована к середине 1970-х годов и с тех пор подтверждена тысячами экспериментов с поразительной точностью.

            {<br style={{margin: "0 0 20px 0"}}/>}Все частицы СМ делятся на два больших класса: фермионы (спин ½) — «кирпичики» материи, и бозоны (целый спин) — переносчики взаимодействий. Фермионы подчиняются принципу запрета Паули: два одинаковых фермиона не могут находиться в одном квантовом состоянии. Бозоны этому принципу не подчиняются.

            {<br style={{margin: "0 0 20px 0"}}/>}Модель объединяет три фундаментальных взаимодействия: электромагнитное (квантовая электродинамика, QED), сильное (квантовая хромодинамика, QCD) и слабое. Электромагнитное и слабое объединены в электрослабое взаимодействие теорией Глэшоу — Вайнберга — Салама. Гравитация пока не включена в СМ — это одна из главных нерешённых задач физики.
            {<br style={{margin: "0 0 20px 0"}}/>} <span style={{color: "#008DD8", opacity: "0.7"}}>Триумф модели — предсказание и открытие бозона Хиггса (масса ≈125 ГэВ) 4 июля 2012 года на LHC. Хиггсовский механизм объясняет, как частицы приобретают массу: поле Хиггса пронизывает всё пространство, и частицы, взаимодействуя с ним, получают инерцию.</span>
          </p>
        </Container3>
      </section>

      <h2 className={s.sectionTitle}>Строение частиц</h2>
      <section className={s.particlesSection}>
        <Container3>
          <div className={s.particlesPanel}>
            <h3 className={s.panelHeading}>Элементарные частицы</h3>

            <div className={s.topSplit}>
              <article className={s.particleGroup}>
                <h4>Фермионы</h4>
                <p>
                  Из фермионов состоит вся видимая материя, отличительная черта - они имеют полуцелый спин. Волновая функция антисимметрична — при перестановке двух частиц функция меняет знак
                </p>
              </article>
              <article className={s.particleGroup}>
                <h4>Бозоны</h4>
                <p>
                  Бозоны - переносчики фундаментальных взаимодействий, имеют целый спин. Волновая функция симметрична. Делятся на векторные и скалярные
                </p>
              </article>
            </div>

            <div className={s.centerNote}>
              Волновая функция — математическая функция, которая описывает облако всех возможных местоположений частицы в пространстве. Квадрат волновой функции показывает вероятность найти частицу в каждой точке: где функция больше, там вероятнее её найти, где меньше — там менее вероятно.
            </div>

            <h3 className={s.panelSubheading}>Фермионы</h3>

            <div className={s.bottomSplit}>
              <article className={s.particleGroup}>
                <h4>Кварки</h4>
                <p style={{ opacity: 0.4 }}>
                  Участвуют в сильном взаимодействии и образуют адроны: протоны,
                  нейтроны и другие составные частицы.
                </p>
              </article>
              <article className={s.particleGroup}>
                <h4>Лептоны</h4>
                <p style={{ opacity: 0.4 }}>
                  Не участвуют в сильном взаимодействии. К этому классу относятся
                  электроны, мюоны, тау-лептоны и нейтрино.
                </p>
              </article>
            </div>
          </div>

        </Container3>
      </section>

      <h2 className={s.sectionTitle}>Сетка частиц</h2>
      <section className={s.gridSection}>
        <Container3>
          <div className={s.smPanel}>
            <div className={s.smCanvas}>
              <div className={s.generationHeaders}>
                {generationHeaders.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <div className={s.smMain}>
                <div className={s.leftLabels}>
                  <span className={s.quarkText}>Кварки</span>
                  <span className={s.leptonText}>Лептоны</span>
                </div>
                <div className={s.smGrid}>
                  {gridParticles.flat().map((item, index) =>
                    renderModelCard(item)
                  )}
                </div>
                <div className={s.rightLabel}>Калибровочные бозоны</div>
              </div>

              <div className={s.extraRow}>
                {extraBosons.map((item) => (
                  <div key={item.id} className={s.extraBlock}>
                    <div className={s.extraTitle}>{item.title}</div>
                    <div 
                      className={s.cardWrap}
                      onClick={() => handleExtraBosonClick(item)}
                      style={{ cursor: "pointer" }}
                    >
                      {item.particle ? (
                        <ParticleCard particle={toParticleCardData(item.particle, item.tone)} />
                      ) : (
                        <ParticleCard particle={{
                          symbol: "?",
                          name: item.id === "graviton" ? "Graviton" : "Higgs",
                          mass: 0,
                          charge: "0",
                          spin: item.id === "graviton" ? "2" : "0",
                          color: toneColor.boson,
                        }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container3>
      </section>

      <section className={s.matterSection}>
        <Container3>
          <h2 style={{ marginTop: "59px" }} className={s.sectionTitle}>Строение вещества</h2>
          <div className={s.matterPanel}>
            <div style={{ display: "flex", flexDirection: "column", width: "100%", alignItems: "center" }}>
              <img style={{ margin: "0 auto" }} src={structure} alt="" />
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "680px", margin: "0 -76px 0 -27px" }}>
                <div className={s.structureBlock} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <h4>Атом</h4>
                  <p>~10⁻¹⁰ м</p>
                </div>
                <div className={s.structureBlock} style={{ display: "flex", flexDirection: "column", marginLeft: "54px", alignItems: "center" }}>
                  <h4>Ядро</h4>
                  <p>~10⁻¹⁵ м</p>
                </div>
                <div className={s.structureBlock} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <h4>Протон</h4>
                  <p>~10⁻¹⁵ м</p>
                </div>
              </div>
            </div>
          </div>
        </Container3>
      </section>

      <section className={s.schemaSection}>
        <Container3>
          <div className={s.schemaWrapper}>
            <div className={s.schemaBlock}>
              <img style={{ width: "430px", height: "460px", aspectRatio: "43/46" }} className={s.schemaImg} src={atom} alt="" />
              <p className={s.schemaNdTitle}>Схема устройства атома</p>
              <p className={s.schemaText}>Синим цветом показано электронное облако (орбиталь),а красным - ядро атома</p>
            </div>
            <div className={s.schemaBlock}>
              <img style={{ width: "460px", height: "460px", aspectRatio: "1/1" }} className={s.schemaImg} src={orbital} alt="" />
              <p className={s.schemaNdTitle}>Атомные орбитали</p>
              <p className={s.schemaText}>Часть пространства вокруг ядра атома, в которой наиболее велика вероятность нахождения электрона</p>
            </div>
          </div>
        </Container3>
      </section>

      <h2 className={s.sectionTitle}>Фундаментальные взаимодействия</h2>
      <section className={s.interactionsSection}>
        <Container3>

          <p className={s.interactionsLead}>
            <span style={{ color: "#008DD8" }}>Фундаментальные взаимодействия</span> — качественно различающиеся типы взаимодействия элементарных частиц и составленных из них тел. Достоверно известно существование четырёх фундаментальных взаимодействий: гравитационного, электромагнитного, сильного и слабого.
          </p>

          <div className={s.interactionsGrid}>
            {interactions.map((item) => (
              <article key={item.id} className={s.interactionCard}>
                <header className={s.cardHeader}>{item.title}</header>
                <img className={s.interactionIcon} src={item.icon} alt="" />
                <p className={s.cardBody}>{item.description}</p>
                <div className={s.cardDivider} />
                <p className={s.cardMeta}>{item.range}</p>
                <p className={s.cardMeta}>{item.carrier}</p>
              </article>
            ))}
          </div>

          <h3 className={s.feynmanTitle}>Отображение на диаграммах Фейнмана</h3>
          <div className={s.feynmanGrid}>
            {feynmanLegend.map((item) => (
              <div key={item.id} className={s.feynmanItem}>
                <img src={item.img} alt={item.label} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Container3>
      </section>
    </div >
  );
}