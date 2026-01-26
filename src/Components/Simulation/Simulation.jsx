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
                className={`${s.simulation__parameters_select} ${error ? s.simulation__fieldError : ""
                    }`}
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

    const idToName = useMemo(() => {
        const m = new Map();
        const arr = Array.isArray(particlesData) ? particlesData : [];
        for (const p of arr) {
            const id = Number(p?.mcid);
            if (Number.isFinite(id)) m.set(id, p?.name || String(id));
        }
        return m;
    }, []);

    function formatStage(objOrArr) {
        if (!objOrArr) return "-";

        const arr = Array.isArray(objOrArr) ? objOrArr : [objOrArr];

        return arr
            .map((row) => {
                if (!row || typeof row !== "object") return String(row);

                // Берём все ключи вида id_1, id_2, id_3...
                const ids = Object.keys(row)
                    .filter((k) => /^id_\d+$/.test(k))
                    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
                    .map((k) => Number(row[k]))
                    .filter((n) => Number.isFinite(n));

                if (ids.length === 0) return JSON.stringify(row);

                // Превращаем id в имя
                const names = ids.map((id) => idToName.get(id) || `PDG ${id}`);

                return names.join(" + ");
            })
            .join("\n");
    }



    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [energy, setEnergy] = useState("");

    const [errors, setErrors] = useState({ first: "", second: "", energy: "" });

    const [inputLine, setInputLine] = useState("—");

    // 🔥 новые стейты под запрос/ответ
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");

    const [stage1, setStage1] = useState("-");
    const [decay, setDecay] = useState("-");
    const [values, setValues] = useState(null);

    const [consoleLines, setConsoleLines] = useState([]);
    const videoRef = useRef(null)

    // Чтобы можно было отменять прошлый запрос, если жмут несколько раз
    const abortRef = useRef(null);
    function handleRestartVideo() {
        if (videoRef.current && loading) {
            video.current.currentTime = 0
            videoRef.current.play()
        }
    }
    function log(line) {
        // всегда видно в DevTools
        console.log("[UI LOG]", line);

        // и пытаемся записать в UI
        try {
            setConsoleLines((prev) => {
                const next = [...prev, `[${new Date().toLocaleTimeString()}] ${line}`];
                return next.slice(-200);
            });
        } catch (e) {
            console.error("log() failed:", e);
        }
    }


    function getSelectedRawByName(name) {
        return particleOptions.find((o) => o.value === name)?.raw || null;
    }

    function getPDGId(raw) {
        if (!raw || typeof raw !== "object") return null;

        // У ВАС PDG id = mcid
        const id = raw.mcid;

        if (id === undefined || id === null) return null;

        const n = Number(id);
        return Number.isFinite(n) ? n : null;
    }


    function validate() {
        const next = { first: "", second: "", energy: "" };

        if (!first) next.first = "Выбери первую частицу";
        if (!second) next.second = "Выбери вторую частицу";

        const e = Number(String(energy).replace(",", "."));
        if (!String(energy).trim()) next.energy = "Введи энергию";
        else if (!Number.isFinite(e)) next.energy = "Энергия должна быть числом";
        else if (e <= 0) next.energy = "Энергия должна быть > 0";

        // проверка что PDG id реально есть в json
        const p1 = getSelectedRawByName(first);
        const p2 = getSelectedRawByName(second);
        const id1 = getPDGId(p1);
        const id2 = getPDGId(p2);

        if (first && id1 == null) next.first = "У этой частицы нет PDG id в JSON";
        if (second && id2 == null) next.second = "У этой частицы нет PDG id в JSON";

        setErrors(next);
        return !next.first && !next.second && !next.energy;
    }

    async function handleStart() {
        console.log("HANDLE START CALLED"); // <-- важно
        log("HANDLE START CALLED (ui)");

        log("Нажата кнопка: Запустить симуляцию");

        if (!validate()) {
            log("Валидация не прошла ❌");
            return;
        }

        const p1 = getSelectedRawByName(first);
        const p2 = getSelectedRawByName(second);

        const id_1 = getPDGId(p1);
        const id_2 = getPDGId(p2);
        const E = Number(String(energy).replace(",", "."));

        setInputLine(`${first} + ${second} (${E} GeV)`);

        setStage1("-");
        setDecay("-");
        setValues(null);

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        log(`Старт симуляции: id_1=${id_1}, id_2=${id_2}, Energy=${E}`);
        videoRef.current.style.display = 'block'
        videoRef.current.play()

        try {
            // ВАЖНО: если бек реально ждёт объект, а не массив — см. пункт 3 ниже
            const payload = [{ id_1, id_2, Energy: E }];

            const res = await fetch("/api/simulation/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            const text = await res.text().catch(() => "");
            log(`HTTP статус: ${res.status}`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}. Ответ: ${text.slice(0, 300)}`);
            }

            let data;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                throw new Error(`Сервер вернул НЕ JSON: ${text.slice(0, 300)}`);
            }

            // бек возвращает: [finals, first_finals, values] или объект
            const finals = Array.isArray(data) ? data[0] : data?.finals;
            const first_finals = Array.isArray(data) ? data[1] : data?.first_finals;
            const vals = Array.isArray(data) ? data[2] : data?.values;

            setStage1(formatStage(first_finals));
            setDecay(formatStage(finals));

            setValues(vals ?? null);

            log("Симуляция завершена успешно ✅");
        } catch (err) {
            if (err?.name === "AbortError") {
                log("Прошлый запрос отменён");
                return;
            }
            const msg = err?.message || "Неизвестная ошибка";
            setApiError(msg);
            log(`Ошибка: ${msg}`);
        } finally {
            setLoading(false);
            videoRef.current.pause();
            videoRef.current.style.display = "none"
        }
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
                                            setApiError("");
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
                                            setApiError("");
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
                                            setApiError("");
                                        }}
                                        placeholder="60"
                                    />
                                    {errors.energy ? (
                                        <div className={s.simulation__errorText}>{errors.energy}</div>
                                    ) : null}
                                </div>

                                {/* общая ошибка апи */}
                                {apiError ? (
                                    <div className={s.simulation__errorText}>
                                        Ошибка API: {apiError}
                                    </div>
                                ) : null}
                            </div>

                            <div className={s.simulation__inputs}>
                                <p className={s.simulation__parameters_text}>Входные параметры:</p>
                                <p className={s.simulation__inputs_input}>{inputLine}</p>
                            </div>

                            <button
                                type="button"
                                className={s.simulation__startButton}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleStart();
                                }}
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? "Считаю..." : "Запустить симуляцию"}
                            </button>

                            <div className={s.simulation__results}>
                                <p className={s.simulation__results_text}>Результат</p>
                                <hr className={s.simulation__results_hr} />

                                <div className={s.simulation__results_stages}>
                                    <div className={s.simulation__results_stage}>
                                        <p className={s.simulation__results_stageText}>Первая ступень:</p>
                                        <p className={s.simulation__results_stageRes}>
                                            {stage1}
                                        </p>
                                    </div>

                                    <div className={s.simulation__results_stage}>
                                        <p className={s.simulation__results_stageText}>Распад:</p>
                                        <p className={s.simulation__results_stageRes}>
                                            {decay}
                                        </p>
                                    </div>
                                </div>

                                {/* кнопка "Частицы" пока просто показывает values в лог */}
                                <button
                                    className={s.simulation__results_button}
                                    type="button"
                                    onClick={() => {
                                        if (!values) return log("values пустые (ещё нет результата)");
                                        log("values:");
                                        log(typeof values === "string" ? values : JSON.stringify(values));
                                    }}
                                >
                                    Частицы
                                </button>
                            </div>
                        </div>

                        <div className={s.simulation__big}>
                            <div className={s.simulation__bigMain}>
                                <video onEnded={handleRestartVideo} ref={videoRef} className={s.simulation__video} controls src="/video/loading.mp4"></video>
                            </div>

                            <div className={s.simulation__console}>
                                {/* если у тебя есть готовые стили под консоль — ок.
                            если нет, хотя бы текст будет виден */}
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "white" }}>
                                    {consoleLines.join("\n")}
                                </pre>
                            </div>
                        </div>
                    </div>
                </Container>
            </main>
        </>
    );
}
