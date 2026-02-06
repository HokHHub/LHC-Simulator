import Container from "../Container/Container";
import s from "./Simulation.module.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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
        const onDocDown = (e) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocDown);
        return () => document.removeEventListener("mousedown", onDocDown);
    }, []);

    useEffect(() => {
        if (!open) return;
        setActiveIndex(0);
        requestAnimationFrame(() => {
            inputRef.current?.focus?.();
        });
    }, [open]);

    function choose(v) {
        onChange(v);
        setOpen(false);
        setQuery("");
    }

    function onKeyDown(e) {
        if (!open) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            listRef.current?.children?.[Math.min(activeIndex + 1, filtered.length - 1)]?.scrollIntoView?.({
                block: "nearest",
            });
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
            listRef.current?.children?.[Math.max(activeIndex - 1, 0)]?.scrollIntoView?.({
                block: "nearest",
            });
        }
        if (e.key === "Enter") {
            e.preventDefault();
            const item = filtered[activeIndex];
            if (item) choose(item.value);
        }
        if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
        }
    }

    return (
        <div className={s.simulation__selectWrap} ref={wrapRef}>
            <label htmlFor={id} className={s.simulation__label}>
                {label}
            </label>

            <button
                type="button"
                id={id}
                name={name}
                className={`${s.simulation__select} ${error ? s.simulation__selectError : ""}`}
                onClick={() => setOpen((v) => !v)}
            >
                <span className={s.simulation__selectValue}>
                    {selected ? selected.label : <span className={s.simulation__placeholder}>{placeholder}</span>}
                </span>
                <span className={s.simulation__caret} aria-hidden>
                    ▾
                </span>
            </button>

            {open ? (
                <div className={s.simulation__dropdown} onKeyDown={onKeyDown}>
                    <input
                        ref={inputRef}
                        className={s.simulation__search}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск..."
                    />

                    <div ref={listRef} className={s.simulation__dropdownList}>
                        {filtered.length === 0 ? (
                            <div className={s.simulation__dropdownEmpty}>Ничего не найдено</div>
                        ) : (
                            filtered.map((o, idx) => (
                                <button
                                    type="button"
                                    key={o.value}
                                    className={`${s.simulation__dropdownItem} ${
                                        idx === activeIndex ? s.simulation__dropdownItemActive : ""
                                    }`}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => choose(o.value)}
                                >
                                    {o.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : null}

            {error ? <div className={s.simulation__error}>{error}</div> : null}
        </div>
    );
}

// ======================
// Three.js визуализация столкновения (вместо видео)
// Подготовлено под будущие данные с backend через runSimulation(config)
// ======================
const LHCAnimation = forwardRef(function LHCAnimation({ className = "", loading = false }, ref) {
    const mountRef = useRef(null);

    // Three.js refs
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const rafRef = useRef(0);

    // Objects refs
    const detectorGroupRef = useRef(null);
    const particlesRef = useRef([]);
    const tracksRef = useRef([]);
    const isAnimatingRef = useRef(false);
    const animationFrameRef = useRef(0);

    const currentDetectorRef = useRef("ATLAS");
    const eventDataRef = useRef({
        energy: 13.0,
        momentum: 1200,
        trackCount: 45,
        eventType: "Standard",
    });

    // Camera control (простая orbit-логика)
    const isDraggingRef = useRef(false);
    const prevMouseRef = useRef({ x: 0, y: 0 });
    const cameraRotRef = useRef({ x: 0.35, y: 0.8 });
    const cameraDistRef = useRef(30);

    function safeDispose(obj) {
        if (!obj) return;
        obj.traverse?.((child) => {
            if (child.geometry) child.geometry.dispose?.();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
                else child.material.dispose?.();
            }
        });
    }

    function clearDynamicObjects() {
        const scene = sceneRef.current;
        if (!scene) return;

        particlesRef.current.forEach((p) => scene.remove(p));
        tracksRef.current.forEach((t) => scene.remove(t));
        particlesRef.current = [];
        tracksRef.current = [];

        isAnimatingRef.current = false;
        animationFrameRef.current = 0;
    }

    function updateCamera() {
        const camera = cameraRef.current;
        if (!camera) return;

        const rot = cameraRotRef.current;
        const dist = cameraDistRef.current;

        camera.position.x = Math.sin(rot.y) * Math.cos(rot.x) * dist;
        camera.position.y = Math.sin(rot.x) * dist;
        camera.position.z = Math.cos(rot.y) * Math.cos(rot.x) * dist;
        camera.lookAt(0, 0, 0);
    }

    // ---------- Detector helpers (упрощённая версия из HTML) ----------
    function createCutawayRing(radius, height, color, opacity) {
        const group = new THREE.Group();

        // кольцо с "вырезом" (часть окружности отсутствует)
        const ringGeom = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI * 0.15, Math.PI * 1.7);
        const ringMat = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            shininess: 80,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.z = Math.PI / 2;
        group.add(ring);

        // тонкий контур
        const edgeGeom = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, Math.PI * 0.15, Math.PI * 1.7);
        const edge = new THREE.LineSegments(
            new THREE.EdgesGeometry(edgeGeom),
            new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity + 0.2) })
        );
        edge.rotation.z = Math.PI / 2;
        group.add(edge);

        return group;
    }

    function createDetectorLayer(radius, height, color, opacity) {
        const group = new THREE.Group();
        group.add(createCutawayRing(radius, height, color, opacity));

        // сетка/опоры (очень лёгкая)
        const gridMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 0.6 });
        const segments = 24;
        const geo = new THREE.BufferGeometry();
        const verts = [];
        for (let i = 0; i < segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            const y = Math.sin(a) * radius;
            const z = Math.cos(a) * radius;
            verts.push(-height / 2, y, z, height / 2, y, z);
        }
        geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        const lines = new THREE.LineSegments(geo, gridMat);
        group.add(lines);

        return group;
    }

    function buildDetector(detectorName) {
        const scene = sceneRef.current;
        if (!scene) return;

        // удалить старый
        if (detectorGroupRef.current) {
            scene.remove(detectorGroupRef.current);
            safeDispose(detectorGroupRef.current);
            detectorGroupRef.current = null;
        }

        const det = new THREE.Group();

        if (detectorName === "CMS") {
            det.add(createDetectorLayer(6, 18, 0x00d4ff, 0.18));
            det.add(createDetectorLayer(9, 20, 0xff6b6b, 0.12));
            det.add(createDetectorLayer(12, 22, 0x667eea, 0.10));
        } else if (detectorName === "ALICE") {
            det.add(createDetectorLayer(5.5, 16, 0xffd93d, 0.16));
            det.add(createDetectorLayer(8.5, 18, 0x6bcf63, 0.12));
            det.add(createDetectorLayer(11, 20, 0x667eea, 0.10));
        } else if (detectorName === "LHCb") {
            det.add(createDetectorLayer(6.5, 14, 0xff8c42, 0.16));
            det.add(createDetectorLayer(9.5, 16, 0x00d4ff, 0.12));
            det.add(createDetectorLayer(12, 18, 0x667eea, 0.10));
            det.rotation.y = Math.PI / 10;
        } else {
            // ATLAS default
            det.add(createDetectorLayer(6, 20, 0x00d4ff, 0.16));
            det.add(createDetectorLayer(10, 22, 0xff6b6b, 0.12));
            det.add(createDetectorLayer(13, 24, 0x667eea, 0.10));
        }

        // зона столкновения
        const collisionZone = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 24, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 })
        );
        det.add(collisionZone);

        detectorGroupRef.current = det;
        scene.add(det);
    }

    function createStarField() {
        const scene = sceneRef.current;
        if (!scene) return;

        const starsGeo = new THREE.BufferGeometry();
        const starCount = 1200;

        const positions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            // сфера вокруг сцены
            const r = 200 * Math.random() + 50;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        starsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const stars = new THREE.Points(
            starsGeo,
            new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.85 })
        );
        stars.name = "__stars";
        scene.add(stars);
    }

    // ---------- Collision animation ----------
    function createParticle(position, color, size = 0.35) {
        const geom = new THREE.SphereGeometry(size, 16, 16);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(position);
        return mesh;
    }

    function createTrack(direction, color, length = 35) {
        const points = [];
        const start = new THREE.Vector3(0, 0, 0);

        // слегка "кривим" трек
        const bend = new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8
        );

        for (let i = 0; i <= 80; i++) {
            const t = i / 80;
            const p = start
                .clone()
                .add(direction.clone().multiplyScalar(t * length))
                .add(bend.clone().multiplyScalar(t * t * length * 0.06));
            points.push(p);
        }

        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
        const line = new THREE.Line(geom, mat);
        return line;
    }

    function createExplosion() {
        const scene = sceneRef.current;
        if (!scene) return;

        // "вспышка" в центре
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(1.6, 24, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
        );
        flash.userData.__fade = { type: "flash", life: 0 };
        scene.add(flash);
        tracksRef.current.push(flash);

        // несколько "джетов" (конусов)
        const jets = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < jets; i++) {
            const cone = new THREE.Mesh(
                new THREE.ConeGeometry(1.4, 10, 24, 1, true),
                new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
            );
            const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
            cone.position.set(0, 0, 0);
            cone.lookAt(dir);
            cone.rotateX(Math.PI / 2);
            cone.userData.__fade = { type: "cone", life: 0, dir };
            scene.add(cone);
            tracksRef.current.push(cone);
        }
    }

    function start(config) {
        const scene = sceneRef.current;
        if (!scene) return;

        if (isAnimatingRef.current) return;

        clearDynamicObjects();

        // (под backend) сюда позже подставим реальные значения:
        // - eventType: тип события (Higgs Boson / Standard / ...)
        // - energy: энергия (TeV)
        // - momentum: импульс
        // - trackCount: число треков
        // - detector: ATLAS/CMS/ALICE/LHCb
        const cfg = {
            eventType: config?.eventType ?? "Standard",
            energy: typeof config?.energy === "number" ? config.energy : 13.0,
            momentum: typeof config?.momentum === "number" ? config.momentum : 1200,
            trackCount: typeof config?.trackCount === "number" ? config.trackCount : 45,
            detector: config?.detector ?? currentDetectorRef.current,
        };

        eventDataRef.current = cfg;

        if (cfg.detector && cfg.detector !== currentDetectorRef.current) {
            currentDetectorRef.current = cfg.detector;
            buildDetector(cfg.detector);
        }

        isAnimatingRef.current = true;
        animationFrameRef.current = 0;

        // два пучка навстречу
        const p1 = createParticle(new THREE.Vector3(-25, 0, 0), 0xaaaaaa, 0.35);
        const p2 = createParticle(new THREE.Vector3(25, 0, 0), 0x888888, 0.35);
        p1.userData.velocity = new THREE.Vector3(1.0, 0, 0);
        p2.userData.velocity = new THREE.Vector3(-1.0, 0, 0);

        scene.add(p1);
        scene.add(p2);
        particlesRef.current.push(p1, p2);
    }

    useImperativeHandle(ref, () => ({
        runSimulation: (config) => start(config),
        setDetector: (detector) => {
            if (!detector) return;
            currentDetectorRef.current = detector;
            buildDetector(detector);
        },
        clear: () => clearDynamicObjects(),
    }));

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.0012);

        const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000);
        camera.position.set(20, 10, 20);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0); // прозрачный, фон задаём CSS-ом

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;

        mount.appendChild(renderer.domElement);

        // light
        scene.add(new THREE.AmbientLight(0x404040, 1.5));
        const light1 = new THREE.PointLight(0x667eea, 1.2, 120);
        light1.position.set(20, 20, 20);
        scene.add(light1);

        const light2 = new THREE.PointLight(0xff6b6b, 0.9, 120);
        light2.position.set(-20, -10, -10);
        scene.add(light2);

        createStarField();
        buildDetector(currentDetectorRef.current);

        const ro = new ResizeObserver(() => {
            const w = mount.clientWidth || 1;
            const h = mount.clientHeight || 1;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            updateCamera();
        });
        ro.observe(mount);

        const onDown = (e) => {
            isDraggingRef.current = true;
            prevMouseRef.current = { x: e.clientX, y: e.clientY };
        };
        const onUp = () => {
            isDraggingRef.current = false;
        };
        const onMove = (e) => {
            if (!isDraggingRef.current) return;
            const dx = e.clientX - prevMouseRef.current.x;
            const dy = e.clientY - prevMouseRef.current.y;
            prevMouseRef.current = { x: e.clientX, y: e.clientY };

            cameraRotRef.current.y += dx * 0.006;
            cameraRotRef.current.x += dy * 0.006;
            cameraRotRef.current.x = Math.max(-1.15, Math.min(1.15, cameraRotRef.current.x));
            updateCamera();
        };
        const onWheel = (e) => {
            const delta = Math.sign(e.deltaY);
            cameraDistRef.current = Math.max(18, Math.min(55, cameraDistRef.current + delta * 1.6));
            updateCamera();
        };

        renderer.domElement.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointermove", onMove);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

        const tick = () => {
            rafRef.current = requestAnimationFrame(tick);

            // лёгкое авто-вращение, если не тащим мышью
            if (!isDraggingRef.current) {
                cameraRotRef.current.y += 0.0012;
                updateCamera();
            }

            // шаг анимации столкновения
            if (isAnimatingRef.current) {
                animationFrameRef.current += 1;

                // движение пучков к центру
                particlesRef.current.forEach((p) => {
                    if (!p.userData?.velocity) return;
                    p.position.add(p.userData.velocity);
                });

                // момент столкновения
                const p1 = particlesRef.current[0];
                const p2 = particlesRef.current[1];
                if (p1 && p2 && p1.position.x >= -1 && p2.position.x <= 1) {
                    // удалить пучки
                    particlesRef.current.forEach((p) => scene.remove(p));
                    particlesRef.current = [];

                    // треки
                    const cfg = eventDataRef.current;
                    const count = Math.max(8, Math.min(120, cfg.trackCount || 45));
                    for (let i = 0; i < count; i++) {
                        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
                        const col = i % 3 === 0 ? 0x00d4ff : i % 3 === 1 ? 0xff6b6b : 0x667eea;
                        const tr = createTrack(dir, col, 28 + Math.random() * 18);
                        scene.add(tr);
                        tracksRef.current.push(tr);
                    }
                    createExplosion();

                    // остановить "создание" через небольшую паузу
                    // (но рендер продолжается)
                    setTimeout(() => {
                        isAnimatingRef.current = false;
                    }, 600);
                }
            }

            // fade/scale для вспышек
            tracksRef.current.forEach((obj) => {
                const meta = obj?.userData?.__fade;
                if (!meta) return;
                meta.life += 1;

                if (meta.type === "flash") {
                    obj.scale.setScalar(1 + meta.life * 0.02);
                    obj.material.opacity = Math.max(0, 0.9 - meta.life * 0.03);
                    if (obj.material.opacity <= 0) {
                        scene.remove(obj);
                        safeDispose(obj);
                    }
                }
                if (meta.type === "cone") {
                    obj.material.opacity = Math.max(0, 0.15 - meta.life * 0.004);
                    if (obj.material.opacity <= 0) {
                        scene.remove(obj);
                        safeDispose(obj);
                    }
                }
            });
            tracksRef.current = tracksRef.current.filter((o) => o.parent);

            renderer.render(scene, camera);
        };

        updateCamera();
        tick();

        return () => {
            cancelAnimationFrame(rafRef.current);
            ro.disconnect();

            renderer.domElement.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointermove", onMove);
            renderer.domElement.removeEventListener("wheel", onWheel);

            clearDynamicObjects();

            // remove stars + detector etc
            scene.traverse((obj) => {
                if (obj.name === "__stars") {
                    scene.remove(obj);
                    safeDispose(obj);
                }
            });

            if (detectorGroupRef.current) {
                scene.remove(detectorGroupRef.current);
                safeDispose(detectorGroupRef.current);
                detectorGroupRef.current = null;
            }

            renderer.dispose?.();
            if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // по UX: когда loading начинается — можно чуть подсветить сцену/перезапустить
    useEffect(() => {
        if (!loading) return;
        // Ничего не делаем автоматически — запускаем из handleStart().
        // Но если захочешь “авто-демо” при загрузке, раскомментируй:
        // start({ eventType: "Standard", energy: 13.0, momentum: 1200, trackCount: 45, detector: currentDetectorRef.current });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    return (
        <div className={`${className} ${s.simulation__vizWrap}`}>
            <div ref={mountRef} className={s.simulation__vizCanvas} />
            <div className={s.simulation__vizHud}>
                <div className={s.simulation__vizHudTitle}>Event</div>
                <div className={s.simulation__vizHudRow}>
                    <span>Type:</span>
                    <b>{eventDataRef.current.eventType}</b>
                </div>
                <div className={s.simulation__vizHudRow}>
                    <span>Energy:</span>
                    <b>{Number(eventDataRef.current.energy).toFixed(2)} TeV</b>
                </div>
                <div className={s.simulation__vizHudRow}>
                    <span>Momentum:</span>
                    <b>{Math.floor(eventDataRef.current.momentum)} GeV/c</b>
                </div>
                <div className={s.simulation__vizHudRow}>
                    <span>Tracks:</span>
                    <b>{eventDataRef.current.trackCount}</b>
                </div>
            </div>

            {loading ? <div className={s.simulation__vizOverlay}>Running…</div> : null}
        </div>
    );
});

export default function Simulation() {
    // ------------------ ТВОЙ ИСХОДНЫЙ КОД ДАЛЬШЕ ------------------
    // (я оставил твою бизнес-логику и просто заменил видео на LHCAnimation)
    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [energy, setEnergy] = useState("");

    const [stage1, setStage1] = useState("-");
    const [decay, setDecay] = useState("-");
    const [values, setValues] = useState(null);

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const [consoleLog, setConsoleLog] = useState("Outputs:\n");
    const [hasOutputs, setHasOutputs] = useState(false);
    const [inputLine, setInputLine] = useState("");
    const [apiError, setApiError] = useState("");

    const [outputs, setOutputs] = useState({
        mass: "",
        baryon: "",
        sbc: "",
        charge: "",
    });

    const [rawStages, setRawStages] = useState({ first: null, finals: null });
    const [isModalOpen, setIsModalOpen] = useState(false);

    const abortRef = useRef(null);
    const animationRef = useRef(null);

    const options = useMemo(() => {
        return Object.keys(particlesData || {}).map((k) => ({
            value: k,
            label: k,
        }));
    }, []);

    function log(msg) {
        setConsoleLog((prev) => (prev ? `${prev}\n${msg}` : msg));
    }

    function getSelectedRawByName(name) {
        if (!name) return null;
        return particlesData?.[name] ?? null;
    }

    function getPDGId(p) {
        // data/all_particles.json: у тебя там ID может называться по-разному
        if (!p) return null;
        return p?.Id ?? p?.id ?? p?.PDG ?? p?.pdg ?? p?.pdgId ?? null;
    }

    function validate() {
        const next = {};
        if (!first) next.first = "Выберите первую частицу";
        if (!second) next.second = "Выберите вторую частицу";

        const E = Number(String(energy).replace(",", "."));
        if (!energy) next.energy = "Введите энергию";
        else if (!Number.isFinite(E) || E <= 0) next.energy = "Энергия должна быть числом > 0";

        setErrors(next);
        return Object.keys(next).length === 0;
    }

    function formatStage(stage) {
        if (!stage) return "-";
        if (Array.isArray(stage)) return stage.map((x) => String(x)).join(" + ");
        if (typeof stage === "object") return JSON.stringify(stage);
        return String(stage);
    }

    function extractIds(stage) {
        if (!stage) return [];
        if (Array.isArray(stage)) return stage;
        if (typeof stage === "object") {
            // если вдруг backend вернет { ids: [...] }
            if (Array.isArray(stage.ids)) return stage.ids;
        }
        return [];
    }

    function updateOutputsFromValues(vals) {
        if (!vals) return;

        // Подстроено под твою прежнюю логику: ожидаем объект с полями
        const mass = vals?.Mass ?? vals?.mass ?? "";
        const baryon = vals?.BaryonNum ?? vals?.baryon ?? "";
        const sbc = vals?.["S,B,C"] ?? vals?.sbc ?? "";
        const charge = vals?.Charge ?? vals?.charge ?? "";

        setOutputs({
            mass: String(mass),
            baryon: String(baryon),
            sbc: Array.isArray(sbc) ? sbc.join(", ") : String(sbc),
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
        // Запускаем визуализацию (пока на статике / на основе ввода).
        // TODO (backend): подставить реальные eventType/trackCount/momentum из ответа API.
        animationRef.current?.runSimulation({
            eventType: "Standard",
            energy: Number.isFinite(E) ? E / 1000 : 13.0, // GeV -> TeV (пример)
            momentum: Number.isFinite(E) ? Math.round(E * 10) : 1200,
            trackCount: 45,
            detector: "ATLAS", // опционально: ATLAS/CMS/ALICE/LHCb
        });
        log(`Старт симуляции: id_1=${id_1}, id_2=${id_2}, Energy=${E}`);

        try {
            const payload = [{ id_1, id_2, Energy: E }];

            function getCookie(name) {
                const v = `; ${document.cookie}`;
                const parts = v.split(`; ${name}=`);
                return parts.length === 2 ? parts.pop().split(";").shift() : null;
            }

            const res = await fetch("/api/simulation/", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
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

            // TODO (backend): если backend начнёт отдавать параметры события для визуалки —
            // дерни анимацию тут, уже с реальными значениями:
            //
            // animationRef.current?.runSimulation({
            //   eventType: vals?.eventType ?? "Higgs Boson",
            //   energy: vals?.energyTeV ?? 13.0,
            //   momentum: vals?.momentum ?? 1200,
            //   trackCount: vals?.trackCount ?? 45,
            //   detector: vals?.detector ?? "ATLAS",
            // });

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
        }
    }

    return (
        <Container>
            <section className={s.simulation}>
                <div className={s.simulation__wrapper}>
                    <h1 className={s.simulation__title}>🎯 СИМУЛЯЦИЯ СТОЛКНОВНОВЕНИЯ</h1>

                    <div className={s.simulation__content}>
                        <div className={s.simulation__inputs}>
                            <SearchableSelect
                                id="first"
                                name="first"
                                label="Частица 1"
                                options={options}
                                value={first}
                                onChange={setFirst}
                                error={errors.first}
                            />
                            <SearchableSelect
                                id="second"
                                name="second"
                                label="Частица 2"
                                options={options}
                                value={second}
                                onChange={setSecond}
                                error={errors.second}
                            />

                            <div className={s.simulation__inputWrap}>
                                <label className={s.simulation__label} htmlFor="energy">
                                    Энергия пучка (GeV)
                                </label>
                                <input
                                    id="energy"
                                    className={`${s.simulation__input} ${errors.energy ? s.simulation__inputError : ""}`}
                                    value={energy}
                                    onChange={(e) => setEnergy(e.target.value)}
                                    placeholder="Напр. 100"
                                />
                                {errors.energy ? <div className={s.simulation__error}>{errors.energy}</div> : null}
                            </div>

                            <div className={s.simulation__buttons}>
                                <button className={s.simulation__btn} onClick={handleStart} disabled={loading}>
                                    {loading ? "Симуляция..." : "Запустить"}
                                </button>

                                {modalStages.length > 0 ? (
                                    <button
                                        className={s.simulation__btnSecondary}
                                        onClick={() => setIsModalOpen(true)}
                                        type="button"
                                    >
                                        Частицы
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className={s.simulation__big}>
                            <div className={s.simulation__bigMain}>
                                <LHCAnimation ref={animationRef} loading={loading} />
                            </div>

                            <div className={s.simulation__console}>
                                <div className={s.simulation__console}>
                                    <p className={s.simulation__consoleTitle}>Console</p>
                                    {inputLine ? <p className={s.simulation__consoleInput}>{inputLine}</p> : null}
                                    {apiError ? <p className={s.simulation__consoleError}>{apiError}</p> : null}
                                    <pre className={s.simulation__consoleText}>{consoleLog}</pre>
                                </div>

                                <div className={s.simulation__outputs}>
                                    <div className={s.simulation__outputsRow}>
                                        <span>Mass =</span>
                                        <b>{outputs.mass}</b>
                                    </div>
                                    <div className={s.simulation__outputsRow}>
                                        <span>Baryon Num =</span>
                                        <b>{outputs.baryon}</b>
                                    </div>
                                    <div className={s.simulation__outputsRow}>
                                        <span>S, B, C =</span>
                                        <b>{outputs.sbc}</b>
                                    </div>
                                    <div className={s.simulation__outputsRow}>
                                        <span>Charge =</span>
                                        <b>{outputs.charge}</b>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <ParticlesModal
                    open={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    stages={modalStages}
                />
            </section>
        </Container>
    );
}
