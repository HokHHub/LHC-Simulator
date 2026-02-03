import Container2 from "../Container2/Container2";
import Container3 from "../Container3/Container3";
import s from "./Theory.module.css";
import Modal from "../Modal/Modal";
import { useEffect, useMemo, useRef, useState } from "react";

import particlesData from "../../data/all_particles.json";
import ParticleCard from "../ParticleCard/ParticleCard";
import { formatNumber } from "../../utils/formatNumber";
const PAGE_SIZE = 24;

export default function Theory() {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(null);

    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const sentinelRef = useRef(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return particlesData.filter((p) => {
            const matchesType = typeFilter === "all" ? true : String(p.type).toLowerCase() === typeFilter;

            if (!matchesType) return false;
            if (!q) return true;

            const haystack = [
                p.name,
                p.type,
                p.mass,
                p.charge,
                p.spin,
                p.descr
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [query, typeFilter]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [query, typeFilter]);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first?.isIntersecting) {
                    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
                }
            },
            { root: null, rootMargin: "400px", threshold: 0 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [filtered.length]);

    const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

    const handleCardClick = (particle) => {
        const modalData = {
            title: particle.name,
            descr: particle.descr,
            iconText: particle.symbol,
            color: particle.color,
            stats: [
                { label: "Семья", value: particle.type },
                { label: "Масса", value: `${formatNumber(particle.mass)} GeV` },
                { label: "Заряд", value: formatNumber(particle.charge) },
                { label: "Спин", value: `${particle.spin} ħ` },
                { label: "Заряд", value: formatNumber(particle.charge) },
                { label: "Заряд", value: formatNumber(particle.charge) },
                { label: "Заряд", value: formatNumber(particle.charge) },
                { label: "Заряд", value: formatNumber(particle.charge) },
            ],
        };

        setSelected(modalData);
        setOpen(true);
    };

    return (
        <>
            <main>
                <Container2>
                    <h2 className={s.theory__title}>Теория элементарных частиц</h2>
                    <p className={s.theory__text}><span>Стандартная модель</span> — это современная научная теория, описывающая фундаментальные «кирпичики» материи и силы, действующие между ними. Она объясняет, из чего состоит всё вещество во Вселенной и как частицы взаимодействуют друг с другом.</p>
                    <p className={s.theory__text}>Согласно Стандартной модели, существует два основных типа элементарных частиц. Первые — это фермионы, составляющие материю. К ним относятся кварки (из которых состоят протоны и нейтроны) и лептоны (включая электроны и нейтрино). Вторые — это бозоны, переносящие фундаментальные взаимодействия</p>
                    <h3 className={s.theory__sTitle}>Взаимодействия</h3>
                    <p className={s.theory__sText}><span>Фундаментальные взаимодействия</span> — это взаимодействия в природе, которые, по-видимому, нельзя свести к более базовым взаимодействиям</p>
                </Container2>
                <Container3>
                    <div className={s.theory__subCards}>
                        <div className={s.theory__subCard}>
                            <img className={s.theory__subicon} src="/img/earth.png" alt="" />
                            <p className={s.theory__subtitle}>Гравитационное</p>
                            <p className={s.theory__subsubtext}>Взаимодействие между всеми телами, обладающими массой.</p>
                            <div className={s.theory__subdiv}>
                                <p className={s.theory__subdivp}>Дальность действия:   ∞</p>
                                <hr className={s.theory__subhr} />
                                <p className={s.theory__subsubsubtext}>Переносчик: Гравитон (не доказан)</p>
                            </div>
                        </div>
                        <div className={s.theory__subCard}>
                            <img className={s.theory__subicon} src="/img/react.png" alt="" />
                            <p className={s.theory__subtitle}>Электромагнитное</p>
                            <p className={s.theory__subsubtext}>Взаимодействие заряженных частиц. Основа химии, электричества и света.</p>
                            <div className={s.theory__subdiv}>
                                <p className={s.theory__subdivp}>Дальность действия:   ∞</p>
                                <hr className={s.theory__subhr} />
                                <p className={s.theory__subsubsubtext}>Переносчик: Фотон</p>
                            </div>
                        </div>
                        <div className={s.theory__subCard}>
                            <img className={s.theory__subicon} src="/img/strong.png" alt="" />
                            <p className={s.theory__subtitle}>Сильное</p>
                            <p className={s.theory__subsubtext}>Удерживает кварки в протонах и нейтронах, связывает атомные ядра.</p>
                            <div className={s.theory__subdiv}>
                                <p className={s.theory__subdivp}>Дальность действия:   10⁻¹⁵ м</p>
                                <hr className={s.theory__subhr} />
                                <p className={s.theory__subsubsubtext}>Переносчик: Глюон</p>
                            </div>
                        </div>
                        <div className={s.theory__subCard}>
                            <img className={s.theory__subicon} src="/img/weak.png" alt="" />
                            <p className={s.theory__subtitle}>Слабое</p>
                            <p className={s.theory__subsubtext}>Ответственно за радиоактивный распад и термоядерные реакции в звёздах.</p>
                            <div className={s.theory__subdiv}>
                                <p className={s.theory__subdivp}>Дальность действия:   10⁻¹⁸ м</p>
                                <hr className={s.theory__subhr} />
                                <p className={s.theory__subsubsubtext}>Переносчик: W± и Z⁰ бозоны</p>
                            </div>
                        </div>
                    </div>
                </Container3>
                <Container2>
                    <div className={s.theory}>
                        <p className={s.theory__mainText}>Список частиц</p>

                        <input
                            className={s.theory__input}
                            placeholder="Поиск частиц по названию или свойствам..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />

                        <div className={s.theory__buttons}>
                            <button
                                className={`${s.theory__button} ${typeFilter === "hadron" ? s.active : ""}`}
                                onClick={() => setTypeFilter("hadron")}
                            >
                                Адроны
                            </button>


                            <button
                                className={`${s.theory__button} ${typeFilter === "quark" ? s.active : ""}`}
                                onClick={() => setTypeFilter("quark")}
                            >
                                Кварки
                            </button>

                            <button
                                className={`${s.theory__button} ${typeFilter === "lepton" ? s.active : ""}`}
                                onClick={() => setTypeFilter("lepton")}
                            >
                                Лептоны
                            </button>

                            <button
                                className={`${s.theory__button} ${typeFilter === "boson" ? s.active : ""}`}
                                onClick={() => setTypeFilter("boson")}
                            >
                                Бозоны
                            </button>

                            <button
                                className={`${s.theory__button} ${typeFilter === "all" ? s.active : ""}`}
                                onClick={() => setTypeFilter("all")}
                            >
                                Все
                            </button>
                        </div>


                        <div className={s.theory__cards}>
                            {visibleItems.map((p, idx) => (
                                <ParticleCard
                                    key={`${p.name}-${idx}`}
                                    particle={p}
                                    onClick={() => handleCardClick(p)}
                                />
                            ))}

                            <div ref={sentinelRef} style={{ height: 1 }} />

                            <Modal isOpen={open} onClose={() => setOpen(false)} data={selected} />
                        </div>

                    </div>
                </Container2>
            </main>
        </>
    );
}
