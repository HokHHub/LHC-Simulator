import Container from "../Container/Container";
import s from "./Simulation.module.css";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    forwardRef,
    useImperativeHandle,
} from "react";
import axios from "axios";

import particlesData from "../../data/all_particles.json";
import ParticlesModal from "../ParticlesModal/ParticlesModal";

/**
 * ====== LHC Animation (Three.js via CDN, NO npm import) ======
 * Важно: НЕ импортим "three", чтобы Vite/Rollup не ломался.
 * Загружаем https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
 * и используем window.THREE.
 *
 * API:
 * animationRef.current.runSimulation({
 *   eventType: 'Higgs Boson',
 *   energy: 13.0,        // TeV
 *   momentum: 1200,      // GeV/c
 *   trackCount: 45,
 *   detector: 'ATLAS'    // опционально: ATLAS/CMS/ALICE/LHCb
 * });
 */
const LHCAnimation = forwardRef(function LHCAnimation(_, ref) {
    const rootRef = useRef(null);

    const threeReadyRef = useRef(false);

    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);

    const detectorGeometryRef = useRef([]);
    const particlesRef = useRef([]);
    const tracksRef = useRef([]);

    const isAnimatingRef = useRef(false);
    const animationFrameRef = useRef(0);
    const isPausedRef = useRef(false);

    const currentDetectorRef = useRef("ATLAS");

    const cameraRotationRef = useRef({ x: 0, y: 0 });
    const cameraDistanceRef = useRef(30);
    const isDraggingRef = useRef(false);
    const prevMouseRef = useRef({ x: 0, y: 0 });

    const eventDataRef = useRef({
        energy: 13.0,
        momentum: 1200,
        trackCount: 45,
        eventType: "Standard",
    });

    const MAGNETIC_FIELD = useMemo(
        () => ({
            ATLAS: 2.0,
            CMS: 3.8,
            ALICE: 0.5,
            LHCb: 1.1,
        }),
        []
    );

    function loadThreeCDN() {
        return new Promise((resolve, reject) => {
            if (window.THREE) return resolve(window.THREE);

            const exist = document.querySelector('script[data-three-cdn="true"]');
            if (exist) {
                // уже вставили — ждём появления window.THREE
                const t = setInterval(() => {
                    if (window.THREE) {
                        clearInterval(t);
                        resolve(window.THREE);
                    }
                }, 50);
                setTimeout(() => {
                    clearInterval(t);
                    if (!window.THREE) reject(new Error("THREE не загрузился с CDN"));
                }, 8000);
                return;
            }

            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
            script.async = true;
            script.dataset.threeCdn = "true";
            script.onload = () => resolve(window.THREE);
            script.onerror = () => reject(new Error("Не удалось загрузить THREE.js с CDN"));
            document.head.appendChild(script);
        });
    }

    function disposeObject(obj) {
        if (!obj) return;
        obj.traverse?.((child) => {
            if (child.geometry) child.geometry.dispose?.();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
                else child.material.dispose?.();
            }
        });
    }

    function clearAnimation() {
        const scene = sceneRef.current;
        if (!scene) return;

        particlesRef.current.forEach((p) => scene.remove(p));
        tracksRef.current.forEach((t) => scene.remove(t));
        particlesRef.current = [];
        tracksRef.current = [];

        isAnimatingRef.current = false;
        animationFrameRef.current = 0;

        eventDataRef.current = {
            energy: 0,
            momentum: 0,
            trackCount: 0,
            eventType: "—",
        };
    }

    function updateCamera() {
        const camera = cameraRef.current;
        if (!camera) return;

        const rot = cameraRotationRef.current;
        const dist = cameraDistanceRef.current;

        camera.position.x = Math.sin(rot.y) * Math.cos(rot.x) * dist;
        camera.position.y = Math.sin(rot.x) * dist;
        camera.position.z = Math.cos(rot.y) * Math.cos(rot.x) * dist;
        camera.lookAt(0, 0, 0);
    }

    function createCutawayRing(THREE, radius, height, color, opacity, layerName) {
        const shape = new THREE.Shape();
        const innerRadius = radius * 0.92;
        const startAngle = -Math.PI / 6;
        const endAngle = startAngle + Math.PI / 3;

        for (let angle = endAngle; angle < Math.PI * 2 + startAngle; angle += 0.08) {
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (angle === endAngle) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }

        for (let angle = Math.PI * 2 + startAngle; angle > endAngle; angle -= 0.08) {
            const x = Math.cos(angle) * innerRadius;
            const y = Math.sin(angle) * innerRadius;
            shape.lineTo(x, y);
        }

        shape.closePath();

        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();

        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: opacity * 0.12,
            wireframe: true,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = Math.PI / 2;
        mesh.userData.layerName = layerName;
        mesh.userData.baseOpacity = opacity * 0.12;

        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: opacity * 1.5,
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        wireframe.rotation.y = Math.PI / 2;
        wireframe.userData.baseOpacity = opacity * 1.5;

        const group = new THREE.Group();
        group.add(mesh);
        group.add(wireframe);
        group.userData.layerName = layerName;

        return group;
    }

    function createEndCap(THREE, radius, position, color, opacity) {
        const segments = 28;
        const geometry = new THREE.RingGeometry(radius * 0.3, radius, segments);

        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: opacity * 0.18,
            wireframe: true,
            side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = position;
        mesh.rotation.y = Math.PI / 2;
        mesh.userData.baseOpacity = opacity * 0.18;

        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: opacity * 1.1,
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        wireframe.position.x = position;
        wireframe.rotation.y = Math.PI / 2;
        wireframe.userData.baseOpacity = opacity * 1.1;

        const group = new THREE.Group();
        group.add(mesh);
        group.add(wireframe);
        return group;
    }

    function createSupportGrid(THREE, radius, height, color, opacity) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];

        const numSupports = 10;
        for (let i = 0; i < numSupports; i++) {
            const angle = (i / numSupports) * Math.PI * 2;
            const x1 = Math.cos(angle) * radius;
            const y1 = Math.sin(angle) * radius;
            vertices.push(-height / 2, x1, y1);
            vertices.push(height / 2, x1, y1);
        }

        const numRings = 4;
        for (let i = 0; i < numRings; i++) {
            const z = -height / 2 + (i / (numRings - 1)) * height;
            for (let j = 0; j < 28; j++) {
                const a1 = (j / 28) * Math.PI * 2;
                const a2 = ((j + 1) / 28) * Math.PI * 2;
                vertices.push(z, Math.cos(a1) * radius, Math.sin(a1) * radius);
                vertices.push(z, Math.cos(a2) * radius, Math.sin(a2) * radius);
            }
        }

        geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: opacity * 1.2,
        });

        const lineSegments = new THREE.LineSegments(geometry, material);
        lineSegments.userData.baseOpacity = opacity * 1.2;
        return lineSegments;
    }

    function createDetectorLayer(THREE, radius, height, color, opacity, layerName) {
        const group = new THREE.Group();

        const ring = createCutawayRing(THREE, radius, height, color, opacity, layerName);
        group.add(ring);

        if (radius > 5) {
            group.add(createEndCap(THREE, radius, height / 2, color, opacity));
            group.add(createEndCap(THREE, radius, -height / 2, color, opacity));
        }

        group.add(createSupportGrid(THREE, radius, height, color, opacity * 0.8));

        group.userData.layerName = layerName;
        group.userData.radius = radius;
        group.userData.height = height;

        return group;
    }

    function createCollisionZone(THREE, color = 0xffffff) {
        const group = new THREE.Group();

        const pointGeometry = new THREE.SphereGeometry(0.2, 12, 12);
        const pointMaterial = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.5,
            metalness: 0.5,
            roughness: 0.3,
        });
        const collisionPoint = new THREE.Mesh(pointGeometry, pointMaterial);
        group.add(collisionPoint);

        return group;
    }

    function buildDetector(detectorType) {
        const THREE = window.THREE;
        const scene = sceneRef.current;
        if (!scene || !THREE) return;

        detectorGeometryRef.current.forEach((obj) => {
            scene.remove(obj);
            disposeObject(obj);
        });
        detectorGeometryRef.current = [];

        const addLayer = (radius, height, color, opacity, name, x = 0) => {
            const layer = createDetectorLayer(THREE, radius, height, color, opacity, name);
            layer.position.x = x;
            scene.add(layer);
            detectorGeometryRef.current.push(layer);
        };

        if (detectorType === "ATLAS") {
            addLayer(12, 48, 0x2a5a8a, 0.12, "Muon System");
            addLayer(10, 40, 0x3a6a9a, 0.15, "Calorimeter");
            addLayer(7, 32, 0x4a7aaa, 0.18, "TRT");
            addLayer(4, 24, 0x5a8aba, 0.22, "SCT");
            addLayer(1.8, 18, 0x6a9aca, 0.26, "Pixel Detector");

            const cz = createCollisionZone(THREE);
            scene.add(cz);
            detectorGeometryRef.current.push(cz);
        } else if (detectorType === "CMS") {
            addLayer(11, 42, 0x8a2a3a, 0.12, "Muon Chambers");
            addLayer(9, 36, 0x9a3a4a, 0.15, "HCAL");
            addLayer(6.5, 30, 0xaa4a5a, 0.18, "ECAL");
            addLayer(4, 24, 0xba5a6a, 0.22, "Tracker");
            addLayer(1.8, 18, 0xca6a7a, 0.26, "Silicon Tracker");

            const cz = createCollisionZone(THREE, 0x8a2a3a);
            scene.add(cz);
            detectorGeometryRef.current.push(cz);
        } else if (detectorType === "ALICE") {
            addLayer(10, 50, 0x2a8a5a, 0.12, "TPC");
            addLayer(7, 42, 0x3a9a6a, 0.15, "TRD");
            addLayer(5, 35, 0x4aaa7a, 0.18, "TOF");
            addLayer(3, 28, 0x5aba8a, 0.22, "ITS");

            const cz = createCollisionZone(THREE, 0x2a8a5a);
            scene.add(cz);
            detectorGeometryRef.current.push(cz);
        } else {
            // LHCb
            addLayer(2, 4, 0x9a6aca, 0.30, "VELO", 16);
            addLayer(4, 6, 0x6a3a9a, 0.25, "RICH1", 8);
            addLayer(5, 8, 0x7a4aaa, 0.20, "Trackers", 2);
            addLayer(6, 10, 0x5a2a8a, 0.18, "Magnet", -6);
            addLayer(7, 10, 0x6a3a9a, 0.15, "RICH2", -15);
            addLayer(8, 12, 0x4a1a7a, 0.12, "Calorimeters", -26);

            const cz = createCollisionZone(THREE, 0xffffff);
            scene.add(cz);
            detectorGeometryRef.current.push(cz);
        }
    }

    function createParticle(THREE, position, color, size) {
        const geometry = new THREE.SphereGeometry(size, 12, 12);
        const material = new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.8,
            shininess: 100,
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        return particle;
    }

    function createTrack(THREE, startPos, direction, color, length = 20, charge = 1, momentum = 20) {
        const points = [];
        const segments = 70;

        const B = MAGNETIC_FIELD[currentDetectorRef.current] || 2.0;

        let curvature = 0;
        if (charge !== 0) {
            const radiusOfCurvature = momentum / (0.3 * Math.abs(charge) * B);
            const normalizedRadius = radiusOfCurvature / 10;
            curvature = (length * 20) / normalizedRadius;
            curvature *= Math.sign(charge);
            curvature = Math.max(-2.0, Math.min(2.0, curvature));
        }

        const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const curve = t * t * curvature * length;

            const pos = new THREE.Vector3(
                startPos.x + direction.x * t * length + perpendicular.x * curve,
                startPos.y + direction.y * t * length + perpendicular.y * curve,
                startPos.z + direction.z * t * length + perpendicular.z * curve
            );
            points.push(pos);
        }

        const curveObj = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curveObj, 56, 0.045, 7, false);
        const tubeMaterial = new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.98,
            shininess: 120,
            specular: 0x222222,
        });

        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tube.userData = {
            spawnDelay: Math.random() * 10,
            growthProgress: 0,
            initialOpacity: 0.98,
            age: 0,
            maxAge: 150,
        };
        tube.scale.set(0, 0, 0);
        return tube;
    }

    function createExplosion() {
        const THREE = window.THREE;
        const scene = sceneRef.current;
        if (!scene || !THREE) return;

        const collisionPoint = new THREE.Vector3(0, 0, 0);

        // треки: если trackCount задан — используем, иначе дефолт
        const numTracks = eventDataRef.current.trackCount || 50;

        // небольшая вспышка
        const coreGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.copy(collisionPoint);
        core.userData = { flash: true, life: 0 };
        scene.add(core);
        tracksRef.current.push(core);

        // треки
        for (let i = 0; i < numTracks; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            const direction = new THREE.Vector3(
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta),
                Math.sin(phi) * Math.cos(theta)
            ).normalize();

            let color;
            let charge;
            let momentum;
            const rand = Math.random();

            if (rand < 0.6) {
                color = Math.random() > 0.5 ? 0xffaa00 : 0xff8800;
                charge = Math.random() > 0.5 ? 1 : -1;
                momentum = 2 + Math.random() * 15;
            } else if (rand < 0.85) {
                color = 0x00ff88;
                charge = Math.random() > 0.5 ? 1 : -1;
                momentum = 5 + Math.random() * 20;
            } else {
                color = 0xff3300;
                charge = 0;
                momentum = 10 + Math.random() * 20;
            }

            const length = 15 + Math.random() * 15;
            const tr = createTrack(THREE, collisionPoint, direction, color, length, charge, momentum);
            scene.add(tr);
            tracksRef.current.push(tr);
        }
    }

    function runSimulation(config) {
        const THREE = window.THREE;
        const scene = sceneRef.current;
        if (!scene || !THREE) return;

        if (isAnimatingRef.current) return;

        // detector
        if (config?.detector && config.detector !== currentDetectorRef.current) {
            currentDetectorRef.current = config.detector;
            buildDetector(currentDetectorRef.current);
        }

        // чистим старое
        particlesRef.current.forEach((p) => scene.remove(p));
        tracksRef.current.forEach((t) => scene.remove(t));
        particlesRef.current = [];
        tracksRef.current = [];

        // данные события
        eventDataRef.current = {
            eventType: config?.eventType || "Standard",
            energy: Number(config?.energy ?? 13.0),
            momentum: Math.floor(config?.momentum ?? 1200),
            trackCount: Math.floor(config?.trackCount ?? 50),
        };

        isAnimatingRef.current = true;
        animationFrameRef.current = 0;

        const p1 = createParticle(THREE, new THREE.Vector3(-25, 0, 0), 0x888888, 0.4);
        const p2 = createParticle(THREE, new THREE.Vector3(25, 0, 0), 0xaaaaaa, 0.4);

        p1.userData = { velocity: new THREE.Vector3(1.0, 0, 0) };
        p2.userData = { velocity: new THREE.Vector3(-1.0, 0, 0) };

        particlesRef.current.push(p1, p2);
        scene.add(p1);
        scene.add(p2);
    }

    useImperativeHandle(ref, () => ({
        runSimulation,
        clearAnimation,
        setDetector: (det) => {
            if (!det) return;
            currentDetectorRef.current = det;
            buildDetector(det);
        },
        setPaused: (v) => {
            isPausedRef.current = !!v;
        },
    }));

    useEffect(() => {
        let raf = 0;
        let ro = null;

        let onDown, onUp, onMove, onWheel, onKey;

        loadThreeCDN()
            .then((THREE) => {
                threeReadyRef.current = true;
                const root = rootRef.current;
                if (!root) return;

                const scene = new THREE.Scene();
                scene.fog = new THREE.FogExp2(0x000000, 0.001);

                const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                camera.position.set(20, 10, 20);
                camera.lookAt(0, 0, 0);

                const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                renderer.setClearColor(0x000000, 0);

                root.appendChild(renderer.domElement);

                const ambient = new THREE.AmbientLight(0x404040, 1.5);
                scene.add(ambient);

                const point1 = new THREE.PointLight(0x667eea, 1, 100);
                point1.position.set(20, 20, 20);
                scene.add(point1);

                const point2 = new THREE.PointLight(0x764ba2, 0.8, 100);
                point2.position.set(-20, -10, -20);
                scene.add(point2);

                sceneRef.current = scene;
                cameraRef.current = camera;
                rendererRef.current = renderer;

                buildDetector(currentDetectorRef.current);
                updateCamera();

                ro = new ResizeObserver(() => {
                    const w = root.clientWidth || 1;
                    const h = root.clientHeight || 1;
                    renderer.setSize(w, h, false);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                });
                ro.observe(root);

                onDown = (e) => {
                    if (e.button !== 0) return;
                    isDraggingRef.current = true;
                    prevMouseRef.current = { x: e.clientX, y: e.clientY };
                };

                onUp = (e) => {
                    if (e.button !== 0) return;
                    isDraggingRef.current = false;
                };

                onMove = (e) => {
                    if (!isDraggingRef.current) return;
                    const dx = e.clientX - prevMouseRef.current.x;
                    const dy = e.clientY - prevMouseRef.current.y;

                    prevMouseRef.current = { x: e.clientX, y: e.clientY };

                    cameraRotationRef.current.y += dx * 0.005;
                    cameraRotationRef.current.x += dy * 0.005;

                    cameraRotationRef.current.x = Math.max(
                        -Math.PI / 2,
                        Math.min(Math.PI / 2, cameraRotationRef.current.x)
                    );
                };

                onWheel = (e) => {
                    e.preventDefault();
                    cameraDistanceRef.current += e.deltaY * 0.05;
                    cameraDistanceRef.current = Math.max(15, Math.min(60, cameraDistanceRef.current));
                };

                onKey = (e) => {
                    if (e.code === "Space") {
                        e.preventDefault();
                        isPausedRef.current = !isPausedRef.current;
                    }
                };

                renderer.domElement.addEventListener("mousedown", onDown);
                window.addEventListener("mouseup", onUp);
                window.addEventListener("mousemove", onMove);
                renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
                window.addEventListener("keydown", onKey);

                const tick = () => {
                    raf = requestAnimationFrame(tick);

                    const scene = sceneRef.current;
                    const camera = cameraRef.current;
                    const renderer = rendererRef.current;
                    const THREE = window.THREE;

                    if (!scene || !camera || !renderer || !THREE) return;

                    if (isAnimatingRef.current && !isPausedRef.current) {
                        animationFrameRef.current += 1;

                        if (animationFrameRef.current < 25) {
                            particlesRef.current.forEach((p) => {
                                if (p.userData?.velocity) p.position.add(p.userData.velocity);
                            });
                        }

                        if (animationFrameRef.current === 25) {
                            particlesRef.current.forEach((p) => scene.remove(p));
                            particlesRef.current = [];
                            createExplosion();
                        }

                        if (animationFrameRef.current > 25) {
                            let allGrown = true;

                            tracksRef.current.forEach((obj) => {
                                if (obj.userData?.flash) {
                                    obj.userData.life += 1;
                                    obj.scale.multiplyScalar(1.12);
                                    obj.material.opacity *= 0.94;
                                    if (obj.material.opacity < 0.02) {
                                        scene.remove(obj);
                                    }
                                    allGrown = false;
                                    return;
                                }

                                if (obj.userData?.spawnDelay > 0) {
                                    obj.userData.spawnDelay -= 1;
                                    allGrown = false;
                                    return;
                                }

                                if (obj.userData?.growthProgress < 1) {
                                    obj.userData.growthProgress += 0.12;
                                    const progress = Math.min(1, obj.userData.growthProgress);
                                    const ease = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
                                    obj.scale.set(ease, ease, ease);
                                    if (progress >= 1) obj.material.opacity = obj.userData.initialOpacity ?? 0.98;
                                    allGrown = false;
                                }
                            });

                            // чистим удалённые
                            tracksRef.current = tracksRef.current.filter((t) => t.parent);

                            if (allGrown && animationFrameRef.current > 50) {
                                isAnimatingRef.current = false;
                            }
                        }
                    }

                    updateCamera();
                    renderer.render(scene, camera);
                };

                tick();
            })
            .catch(() => {
                // если CDN вдруг не доступен — просто ничего не рендерим
            });

        return () => {
            cancelAnimationFrame(raf);
            if (ro) ro.disconnect();

            const renderer = rendererRef.current;
            const scene = sceneRef.current;

            if (renderer?.domElement) {
                try {
                    renderer.domElement.removeEventListener("mousedown", onDown);
                    renderer.domElement.removeEventListener("wheel", onWheel);
                } catch {}
            }
            window.removeEventListener("mouseup", onUp);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("keydown", onKey);

            if (scene) {
                clearAnimation();
                detectorGeometryRef.current.forEach((obj) => {
                    scene.remove(obj);
                    disposeObject(obj);
                });
                detectorGeometryRef.current = [];
            }

            if (renderer) {
                renderer.dispose?.();
                const canvas = renderer.domElement;
                if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
            }

            sceneRef.current = null;
            cameraRef.current = null;
            rendererRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div className={s.simulation__animRoot} ref={rootRef} />;
});

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
                className={`${s.simulation__parameters_select} ${
                    error ? s.simulation__fieldError : ""
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
                                    className={`${s.simulation__dropdownItem} ${
                                        idx === activeIndex
                                            ? s.simulation__dropdownItemActive
                                            : ""
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

    const abortRef = useRef(null);

    // NEW: ref на анимацию (вместо videoRef)
    const animationRef = useRef(null);

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

        // ✅ ВМЕСТО ВИДЕО: запускаем анимацию
        // TODO backend: как только backend начнет отдавать eventType/momentum/trackCount/detector —
        // подставляй сюда реальные значения из ответа.
        animationRef.current?.runSimulation({
            eventType: "Standard",
            energy: 13.0,         // TeV (пока статикой)
            momentum: 1200,       // GeV/c (пока статикой)
            trackCount: 45,       // пока статикой
            detector: "ATLAS",    // опционально
        });

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

            // TODO backend:
            // Если backend начнет отдавать данные для визуалки, делай так:
            // animationRef.current?.runSimulation({
            //   eventType: vals?.eventType ?? 'Standard',
            //   energy: vals?.energy ?? 13.0,
            //   momentum: vals?.momentum ?? 1200,
            //   trackCount: vals?.trackCount ?? 45,
            //   detector: vals?.detector ?? 'ATLAS',
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
                                        className={`${s.simulation__parameters_input} ${
                                            errors.energy ? s.simulation__fieldError : ""
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
                                {/* ❌ видео удалено */}
                                {/* ✅ анимация вставлена вместо видео */}
                                <LHCAnimation ref={animationRef} />
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
