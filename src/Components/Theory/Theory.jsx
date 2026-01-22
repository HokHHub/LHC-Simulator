import Container2 from "../Container2/Container2";
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
            iconText: particle.name[0],
            color: particle.color,
            stats: [
                { label: "Тип", value: particle.type },
                { label: "Масса", value: `${formatNumber(particle.mass)} GeV` },
                { label: "Заряд", value: formatNumber(particle.charge) },
                { label: "Спин", value: `${particle.spin} ħ` },
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
                                className={s.theory__button}
                                onClick={() => setTypeFilter("hadron")}
                            >
                                Адроны
                            </button>

                            <button
                                className={s.theory__button}
                                onClick={() => setTypeFilter("quark")}
                            >
                                Кварки
                            </button>

                            <button
                                className={s.theory__button}
                                onClick={() => setTypeFilter("lepton")}
                            >
                                Лептоны
                            </button>

                            <button
                                className={s.theory__button}
                                onClick={() => setTypeFilter("boson")}
                            >
                                Бозоны
                            </button>

                            <button
                                className={s.theory__button}
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
