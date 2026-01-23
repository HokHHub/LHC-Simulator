import Container from "../Container/Container";
import s from "./Simulation.module.css";
import { useEffect, useMemo, useRef, useState } from "react";

import particlesData from "../../data/all_particles.json";

function SearchableSelect({
    id,
    name,
    label,
    options,
    value,
    onChange,
    placeholder = "Выберите...",
    error,
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    const wrapRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const selected = useMemo(
        () => options.find((o) => o.value === value) || null,
        [options, value]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);

    useEffect(() => {
        function onDocMouseDown(e) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    useEffect(() => {
        if (open) {
            setQuery("");
            setActiveIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [open, activeIndex]);

    function choose(opt) {
        onChange?.(opt.value);
        setOpen(false);
    }

    function onTriggerKeyDown(e) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
        }
    }

    function onSearchKeyDown(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            const opt = filtered[activeIndex];
            if (opt) choose(opt);
        }
    }

    return (
        <div className={s.simulation__selectWrap} ref={wrapRef}>
            <label htmlFor={id} className={s.simulation__parameters_text}>
                {label}
            </label>

            <button
                id={id}
                type="button"
                className={`${s.simulation__parameters_select} ${error ? s.simulation__fieldError : ""}`}
                onClick={() => setOpen((v) => !v)}
                onKeyDown={onTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={s.simulation__selectValue}>
                    {selected ? selected.label : placeholder}
                </span>
                <span className={s.simulation__selectChevron}>▾</span>
            </button>

            <input type="hidden" name={name} value={value || ""} />

            {error ? <div className={s.simulation__errorText}>{error}</div> : null}

            {open && (
                <div className={s.simulation__dropdown} role="dialog">
                    <input
                        ref={inputRef}
                        className={s.simulation__dropdownSearch}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder="Начни печатать для поиска…"
                    />

                    <ul
                        ref={listRef}
                        className={s.simulation__dropdownList}
                        role="listbox"
                        aria-label="options"
                    >
                        {filtered.length === 0 ? (
                            <li className={s.simulation__dropdownEmpty}>Ничего не найдено</li>
                        ) : (
                            filtered.map((opt, idx) => (
                                <li
                                    key={opt.value}
                                    data-idx={idx}
                                    className={`${s.simulation__dropdownItem} ${idx === activeIndex ? s.simulation__dropdownItemActive : ""
                                        } ${opt.value === value ? s.simulation__dropdownItemSelected : ""}`}
                                    role="option"
                                    aria-selected={opt.value === value}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => choose(opt)}
                                >
                                    <span>{opt.label}</span>
                                    <span className={s.simulation__dropdownType}>{opt.type}</span>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function Simulation() {
    const particleOptions = useMemo(() => {
        const arr = Array.isArray(particlesData) ? particlesData : [];
        return arr
            .filter((p) => p && typeof p.name === "string")
            .map((p) => ({
                value: p.name,
                label: p.name,
                type: p.type || "",
                raw: p,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, []);

    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [energy, setEnergy] = useState("");

    const [errors, setErrors] = useState({ first: "", second: "", energy: "" });

    const [inputLine, setInputLine] = useState("—");

    function validate() {
        const next = { first: "", second: "", energy: "" };

        if (!first) next.first = "Выбери первую частицу";
        if (!second) next.second = "Выбери вторую частицу";

        const e = Number(String(energy).replace(",", "."));
        if (!energy.trim()) next.energy = "Введи энергию";
        else if (!Number.isFinite(e)) next.energy = "Энергия должна быть числом";
        else if (e <= 0) next.energy = "Энергия должна быть > 0";

        setErrors(next);

        return !next.first && !next.second && !next.energy;
    }

    function handleStart() {
        if (!validate()) return;

        const e = Number(String(energy).replace(",", "."));
        setInputLine(`${first} + ${second} (${e} GeV)`);
    }

    return (
        <>
            <main>
                <Container>
                    <h2>СИМУЛЯТОР</h2>

                    <div className={s.simulation}>
                        <div className={s.simulation__mini}>
                            <div className={s.simulation__parameters}>
                                <p className={s.simulation__parameters_title}>Параметры столкновения</p>
                                <hr className={s.simulation__parameters_hr} />

                                <div className={s.simulation__parameters_options}>
                                    <SearchableSelect
                                        id="first"
                                        name="first"
                                        label="Первая частица:"
                                        options={particleOptions}
                                        value={first}
                                        onChange={(v) => {
                                            setFirst(v);
                                            setErrors((e) => ({ ...e, first: "" }));
                                        }}
                                        placeholder="Протон p+"
                                        error={errors.first}
                                    />
                                </div>

                                <div className={s.simulation__parameters_options}>
                                    <SearchableSelect
                                        id="second"
                                        name="second"
                                        label="Вторая частица:"
                                        options={particleOptions}
                                        value={second}
                                        onChange={(v) => {
                                            setSecond(v);
                                            setErrors((e) => ({ ...e, second: "" }));
                                        }}
                                        placeholder="не Протон не p+"
                                        error={errors.second}
                                    />
                                </div>

                                <div className={s.simulation__parameters_options}>
                                    <label htmlFor="energy" className={s.simulation__parameters_text}>
                                        Энергия пучков (GeV):
                                    </label>
                                    <input
                                        className={`${s.simulation__parameters_input} ${errors.energy ? s.simulation__fieldError : ""
                                            }`}
                                        id="energy"
                                        type="text"
                                        inputMode="decimal"
                                        value={energy}
                                        onChange={(e) => {
                                            setEnergy(e.target.value);
                                            setErrors((er) => ({ ...er, energy: "" }));
                                        }}
                                        placeholder="60"
                                    />
                                    {errors.energy ? (
                                        <div className={s.simulation__errorText}>{errors.energy}</div>
                                    ) : null}
                                </div>
                            </div>

                            <div className={s.simulation__inputs}>
                                <p className={s.simulation__parameters_text}>Входные параметры:</p>
                                <p className={s.simulation__inputs_input}>{inputLine}</p>
                            </div>

                            <button className={s.simulation__startButton} onClick={handleStart}>
                                Запустить симуляцию
                            </button>

                            <div className={s.simulation__results}>
                                <p className={s.simulation__results_text}>Результат</p>
                                <hr className={s.simulation__results_hr} />
                                <div className={s.simulation__results_stages}>
                                    <div className={s.simulation__results_stage}>
                                        <p className={s.simulation__results_stageText}>Первая ступень:</p>
                                        <p className={s.simulation__results_stageRes}>-</p>
                                    </div>
                                    <div className={s.simulation__results_stage}>
                                        <p className={s.simulation__results_stageText}>Распад:</p>
                                        <p className={s.simulation__results_stageRes}>-</p>
                                    </div>
                                </div>
                                <button className={s.simulation__results_button}>Частицы</button>
                            </div>
                        </div>
                        <div className={s.simulation__big}>
                            <div className={s.simulation__bigMain}></div>
                            <div className={s.simulation__console}>
                            </div>
                        </div>
                    </div>
                </Container>
            </main>
        </>
    );
}
