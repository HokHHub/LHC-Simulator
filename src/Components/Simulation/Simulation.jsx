import Container from "../Container/Container";
import s from "./Simulation.module.css";
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import particlesData from "../../data/all_particles.json";
import ParticlesModal from "../ParticlesModal/ParticlesModal";

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

    const particlesById = useMemo(() => {
        const m = new Map();
        const arr = Array.isArray(particlesData) ? particlesData : [];
        for (const p of arr) {
            const id = Number(p?.mcid);
            if (Number.isFinite(id)) m.set(id, p);
        }
        return m;
    }, []);

    function formatStage(objOrArr) {
        if (!objOrArr) return "-";
        const arr = Array.isArray(objOrArr) ? objOrArr : [objOrArr];

        return arr
            .map((row) => {
                if (!row || typeof row !== "object") return String(row);

                const ids = Object.keys(row)
                    .filter((k) => /^id_\d+$/.test(k))
                    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
                    .map((k) => Number(row[k]))
                    .filter((n) => Number.isFinite(n));

                if (ids.length === 0) return JSON.stringify(row);

                const names = ids.map((id) => idToName.get(id) || `PDG ${id}`);
                return names.join(" + ");
            })
            .join("\n");
    }

    function extractIds(objOrArr) {
        if (!objOrArr) return [];
        const arr = Array.isArray(objOrArr) ? objOrArr : [objOrArr];

        const out = [];
        for (const row of arr) {
            if (!row || typeof row !== "object") continue;

            const ids = Object.keys(row)
                .filter((k) => /^id_\d+$/.test(k))
                .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
                .map((k) => Number(row[k]))
                .filter((n) => Number.isFinite(n));

            out.push(...ids);
        }
        return out;
    }

    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [energy, setEnergy] = useState("");

    const [errors, setErrors] = useState({ first: "", second: "", energy: "" });

    const [inputLine, setInputLine] = useState("—");

    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");

    const [stage1, setStage1] = useState("-");
    const [decay, setDecay] = useState("-");
    const [values, setValues] = useState(null);

    // для модалки частиц
    const [particlesModalOpen, setParticlesModalOpen] = useState(false);
    const [rawStages, setRawStages] = useState({ first: null, finals: null });

    const [hasOutputs, setHasOutputs] = useState(false);
    const [outputs, setOutputs] = useState({
        mass: "",
        baryon: "",
        sbc: "",
        charge: "",
    });



    const videoRef = useRef(null);
    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === "undefined") return true;
        return window.matchMedia("(min-width: 1281px)").matches;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mq = window.matchMedia("(min-width: 1281px)");
        const onChange = () => setIsDesktop(mq.matches);

        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else mq.addListener(onChange);

        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", onChange);
            else mq.removeListener(onChange);
        };
    }, []);

    const abortRef = useRef(null);

    function handleRestartVideo() {
        if (videoRef.current && loading) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    }

    function log(line) {
        console.log("[UI LOG]", line);
    }



    function getSelectedRawByName(name) {
        return particleOptions.find((o) => o.value === name)?.raw || null;
    }

    function getPDGId(raw) {
        if (!raw || typeof raw !== "object") return null;
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

        const p1 = getSelectedRawByName(first);
        const p2 = getSelectedRawByName(second);
        const id1 = getPDGId(p1);
        const id2 = getPDGId(p2);

        if (first && id1 == null) next.first = "У этой частицы нет PDG id в JSON";
        if (second && id2 == null) next.second = "У этой частицы нет PDG id в JSON";

        setErrors(next);
        return !next.first && !next.second && !next.energy;
    }

    function pickFirst(obj, keys) {
        for (const k of keys) {
            if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
        }
        return null;
    }

    function formatMaybeNumber(v, digits = 3) {
        const n = Number(v);
        if (!Number.isFinite(n)) return v == null ? "—" : String(v);
        // если надо до десятых — поставь digits=1
        return n.toFixed(digits);
    }

    function updateOutputsFromValues(vals) {
        // ожидаем: [{ Mass, BaryonNum, "S,B,C": [S,B,C], Charge }]
        const row = Array.isArray(vals) ? vals[0] : vals;

        if (!row || typeof row !== "object") {
            setHasOutputs(false);
            setOutputs({ mass: "", baryon: "", sbc: "", charge: "" });
            return;
        }

        const massNum = Number(row.Mass);
        const mass = Number.isFinite(massNum) ? massNum.toFixed(1) : "";

        const baryon = row.BaryonNum ?? "";
        const charge = row.Charge ?? "";

        const sbcArr = row["S,B,C"];
        const sbc = Array.isArray(sbcArr) ? sbcArr.join(", ") : "";

        setOutputs({
            mass,
            baryon: String(baryon),
            sbc,
            charge: String(charge),
        });

        setHasOutputs(true);
    }

    const modalStages = useMemo(() => {
        const firstIds = extractIds(rawStages.first);
        const finalIds = extractIds(rawStages.finals);

        return [
            { key: "stage1", label: "1 ступень", ids: firstIds },
            { key: "decay", label: "Распад", ids: finalIds },
        ].filter((x) => (x.ids?.length ?? 0) > 0);
    }, [rawStages]);

    async function handleStart() {
        console.log("HANDLE START CALLED");
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
        setHasOutputs(false);
        setOutputs({ mass: "", baryon: "", sbc: "", charge: "" });
        setRawStages({ first: null, finals: null });
        setApiError("");

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        log(`Старт симуляции: id_1=${id_1}, id_2=${id_2}, Energy=${E}`);

        if (videoRef.current) {
            if (isDesktop) {
                videoRef.current.muted = false;
                videoRef.current.playsInline = true;
                videoRef.current.style.display = "block";
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => { });
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
                videoRef.current.muted = true;
                videoRef.current.style.display = "none";
            }
        }

        try {
            const payload = [{ id_1, id_2, Energy: E }];

            function getCookie(name) {
                const v = `; ${document.cookie}`;
                const parts = v.split(`; ${name}=`);
                return parts.length === 2 ? parts.pop().split(';').shift() : null;
            }
            
            const res = await fetch("/api/simulation/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            const text = await res.text().catch(() => "");

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}. Ответ: ${text.slice(0, 300)}`);
            }

            let data;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                throw new Error(`Сервер вернул НЕ JSON: ${text.slice(0, 300)}`);
            }

            const finals = Array.isArray(data) ? data[0] : data?.finals;
            const first_finals = Array.isArray(data) ? data[1] : data?.first_finals;
            const vals = Array.isArray(data) ? data[2] : data?.values;

            setStage1(formatStage(first_finals));
            setDecay(formatStage(finals));
            setValues(vals ?? null);
            updateOutputsFromValues(vals ?? null);
            setHasOutputs(true);

            // сохраняем сырые стадии для модалки
            setRawStages({ first: first_finals ?? null, finals: finals ?? null });

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
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
                videoRef.current.muted = !isDesktop;
                videoRef.current.style.display = "none";
            }
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
                                <p className={s.simulation__parameters_title}>
                                    Параметры столкновения
                                </p>
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
                                    <label
                                        htmlFor="energy"
                                        className={s.simulation__parameters_text}
                                    >
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
                                        <p className={s.simulation__results_stageText}>
                                            Первая ступень:
                                        </p>
                                        <p className={s.simulation__results_stageRes}>{stage1}</p>
                                    </div>

                                    <div className={s.simulation__results_stage}>
                                        <p className={s.simulation__results_stageText}>Распад:</p>
                                        <p className={s.simulation__results_stageRes}>{decay}</p>
                                    </div>
                                </div>

                                <button
                                    className={s.simulation__results_button}
                                    type="button"
                                    onClick={() => {
                                        const hasAny = modalStages.length > 0;
                                        if (!hasAny)
                                            return log("Сначала запусти симуляцию — частиц пока нет");
                                        setParticlesModalOpen(true);
                                    }}
                                >
                                    Частицы
                                </button>
                            </div>
                        </div>

                        <div className={s.simulation__big}>
                            <div className={s.simulation__bigMain}>
                                <video
                                    onEnded={handleRestartVideo}
                                    ref={videoRef}
                                    className={s.simulation__video}
                                    controls
                                    src="/video/loading.mp4"
                                ></video>
                            </div>

                            <div className={s.simulation__console}>
                                <div className={s.simulation__console}>
                                    <p className={s.simulation__consoleTitle}>Outputs:</p>

                                    {hasOutputs ? (
                                        <div className={s.simulation__consoleOut}>
                                            <div>Mass = {outputs.mass}</div>
                                            <div>Baryon Num = {outputs.baryon}</div>
                                            <div>S, B, C = {outputs.sbc}</div>
                                            <div>Charge = {outputs.charge}</div>
                                        </div>
                                    ) : (
                                        <div className={s.simulation__consoleOut} />
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>

                    <ParticlesModal
                        isOpen={particlesModalOpen}
                        onClose={() => setParticlesModalOpen(false)}
                        stages={modalStages}
                        particlesById={particlesById}
                        initialStageKey="stage1"
                        title="Частицы"
                    />
                </Container>
            </main>
        </>
    );
}
