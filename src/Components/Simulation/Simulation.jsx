import Container from "../Container/Container";
import s from "./Simulation.module.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import particlesData from "../../data/all_particles.json";
import ParticlesModal from "../ParticlesModal/ParticlesModal";

/**
 * Подгружаем Three.js с CDN (без import "three", чтобы Vite не падал).
 */
function loadThreeFromCdn() {
  return new Promise((resolve, reject) => {
    if (window.THREE) return resolve(window.THREE);

    const existing = document.querySelector('script[data-three="r128"]');
    if (existing) {
      if (window.THREE) return resolve(window.THREE);
      existing.addEventListener("load", () => resolve(window.THREE));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.async = true;
    script.dataset.three = "r128";
    script.onload = () => resolve(window.THREE);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/**
 * Создаёт LHC-симуляцию, привязанную к конкретному mount-элементу.
 * Возвращает объект с методами управления и dispose() для очистки.
 */
function createLhcSimulation(mountEl) {
  if (!window.THREE || !mountEl) return null;

  const THREE = window.THREE;

  let scene, camera, renderer;
  let particles = [];
  let tracks = [];
  let isAnimating = false;
  let animationFrame = 0;
  let isPaused = false;
  let disposed = false;
  let rafId = null;

  let currentDetector = "ATLAS";
  let detectorGeometry = [];
  let labelElements = [];
  let showDetectorLabels = false;

  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();
  let hoveredObject = null;
  let clickStartPos = { x: 0, y: 0 };

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let cameraRotation = { x: 0, y: 0 };
  let cameraDistance = 30;

  let showLegend = true;

  let eventData = {
    energy: 0,
    momentum: 0,
    trackCount: 0,
    eventType: "—",
  };

  const MAGNETIC_FIELD = {
    ATLAS: 2.0,
    CMS: 3.8,
    ALICE: 0.5,
    LHCb: 1.1,
  };

  function getEl(id) {
    return mountEl.querySelector("#" + id) || document.getElementById(id);
  }

  // ───────────────────────────────────────────
  // 🔥 ВАЖНО: правильная уборка объектов Three.js
  // ───────────────────────────────────────────
  function disposeMaterial(mat) {
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else mat.dispose?.();
  }

  function disposeObject3D(obj) {
    if (!obj) return;

    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) disposeMaterial(child.material);
      if (child.texture) child.texture.dispose?.();
    });

    if (obj.parent) obj.parent.remove(obj);
  }

  function clearMeshes(arr) {
    arr.forEach((m) => disposeObject3D(m));
    arr.length = 0;
  }

  // ───── detector geometry helpers ─────
  function createCutawayRing(radius, height, color, opacity, layerName) {
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
    return group;
  }

  function createEndCap(radius, height, position, color, opacity) {
    const geometry = new THREE.RingGeometry(radius * 0.3, radius, 28);
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

  function createSupportGrid(radius, height, color, opacity) {
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
        const angle1 = (j / 28) * Math.PI * 2;
        const angle2 = ((j + 1) / 28) * Math.PI * 2;
        vertices.push(z, Math.cos(angle1) * radius, Math.sin(angle1) * radius);
        vertices.push(z, Math.cos(angle2) * radius, Math.sin(angle2) * radius);
      }
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 1.2 });
    const lineSegments = new THREE.LineSegments(geometry, material);
    lineSegments.userData.baseOpacity = opacity * 1.2;
    return lineSegments;
  }

  function createDetectorLayer(radius, height, color, opacity, layerName) {
    const group = new THREE.Group();
    const ring = createCutawayRing(radius, height, color, opacity, layerName);
    group.add(ring);

    if (radius > 5) {
      group.add(createEndCap(radius, height, height / 2, color, opacity));
      group.add(createEndCap(radius, height, -height / 2, color, opacity));
    }

    group.add(createSupportGrid(radius, height, color, opacity * 0.8));
    group.userData.layerName = layerName;
    group.userData.radius = radius;
    group.userData.height = height;
    return group;
  }

  function createCollisionZone(color = 0xffffff) {
    const group = new THREE.Group();

    const pointGeometry = new THREE.SphereGeometry(0.2, 12, 12);
    const pointMaterial = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.3,
    });
    group.add(new THREE.Mesh(pointGeometry, pointMaterial));

    const linesGeometry = new THREE.BufferGeometry();
    const linesVertices = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const length = 1.5;
      linesVertices.push(0, 0, 0);
      linesVertices.push(Math.cos(angle) * length, Math.sin(angle) * length, 0);
    }
    linesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linesVertices, 3));
    const linesMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
    group.add(new THREE.LineSegments(linesGeometry, linesMaterial));

    return group;
  }

  // ───── detector builders ─────
  function buildATLAS() {
    const lbl = getEl("detectorLabel");
    if (lbl) lbl.textContent = "ATLAS";

    const layers = [
      { radius: 12, height: 48, color: 0x2a5a8a, opacity: 0.12, name: "Muon System" },
      { radius: 10, height: 40, color: 0x3a6a9a, opacity: 0.15, name: "Calorimeter" },
      { radius: 7, height: 32, color: 0x4a7aaa, opacity: 0.18, name: "TRT" },
      { radius: 4, height: 24, color: 0x5a8aba, opacity: 0.22, name: "SCT" },
      { radius: 1.8, height: 18, color: 0x6a9aca, opacity: 0.26, name: "Pixel Detector" },
    ];

    layers.forEach((layer) => {
      const g = createDetectorLayer(layer.radius, layer.height, layer.color, layer.opacity, layer.name);
      scene.add(g);
      detectorGeometry.push(g);
    });

    const cz = createCollisionZone();
    scene.add(cz);
    detectorGeometry.push(cz);
  }

  function buildCMS() {
    const lbl = getEl("detectorLabel");
    if (lbl) lbl.textContent = "CMS";

    const layers = [
      { radius: 11, height: 42, color: 0x8a2a3a, opacity: 0.12, name: "Muon Chambers" },
      { radius: 9, height: 36, color: 0x9a3a4a, opacity: 0.15, name: "HCAL" },
      { radius: 6.5, height: 30, color: 0xaa4a5a, opacity: 0.18, name: "ECAL" },
      { radius: 4, height: 24, color: 0xba5a6a, opacity: 0.22, name: "Tracker" },
      { radius: 1.8, height: 18, color: 0xca6a7a, opacity: 0.26, name: "Silicon Tracker" },
    ];

    layers.forEach((layer) => {
      const g = createDetectorLayer(layer.radius, layer.height, layer.color, layer.opacity, layer.name);
      scene.add(g);
      detectorGeometry.push(g);
    });

    const cz = createCollisionZone(0x8a2a3a);
    scene.add(cz);
    detectorGeometry.push(cz);
  }

  function buildALICE() {
    const lbl = getEl("detectorLabel");
    if (lbl) lbl.textContent = "ALICE";

    const layers = [
      { radius: 10, height: 50, color: 0x2a8a5a, opacity: 0.12, name: "TPC" },
      { radius: 7, height: 42, color: 0x3a9a6a, opacity: 0.15, name: "TRD" },
      { radius: 5, height: 35, color: 0x4aaa7a, opacity: 0.18, name: "TOF" },
      { radius: 3, height: 28, color: 0x5aba8a, opacity: 0.22, name: "ITS" },
    ];

    layers.forEach((layer) => {
      const g = createDetectorLayer(layer.radius, layer.height, layer.color, layer.opacity, layer.name);
      scene.add(g);
      detectorGeometry.push(g);
    });

    const cz = createCollisionZone(0x2a8a5a);
    scene.add(cz);
    detectorGeometry.push(cz);
  }

  function buildLHCb() {
    const lbl = getEl("detectorLabel");
    if (lbl) lbl.textContent = "LHCb";

    const components = [
      { radius: 2, height: 4, z: 16, color: 0x9a6aca, opacity: 0.30, name: "VELO" },
      { radius: 4, height: 6, z: 8, color: 0x6a3a9a, opacity: 0.25, name: "RICH1" },
      { radius: 5, height: 8, z: 2, color: 0x7a4aaa, opacity: 0.20, name: "Trackers" },
      { radius: 6, height: 10, z: -6, color: 0x5a2a8a, opacity: 0.18, name: "Magnet" },
      { radius: 7, height: 10, z: -15, color: 0x6a3a9a, opacity: 0.15, name: "RICH2" },
      { radius: 8, height: 12, z: -26, color: 0x4a1a7a, opacity: 0.12, name: "Calorimeters" },
    ];

    components.forEach((comp) => {
      const g = createDetectorLayer(comp.radius, comp.height, comp.color, comp.opacity, comp.name);
      g.position.x = comp.z;
      scene.add(g);
      detectorGeometry.push(g);
    });
  }

  function buildDetector(detectorType) {
    detectorGeometry.forEach((obj) => disposeObject3D(obj));
    detectorGeometry = [];

    const labelsContainer = getEl("labelsContainer");
    if (labelsContainer) labelsContainer.innerHTML = "";
    labelElements = [];

    if (detectorType === "ATLAS") buildATLAS();
    else if (detectorType === "CMS") buildCMS();
    else if (detectorType === "ALICE") buildALICE();
    else if (detectorType === "LHCb") buildLHCb();

    createLabels();

    const mf = MAGNETIC_FIELD[currentDetector] || 2.0;
    const hudMf = getEl("magneticField");
    if (hudMf) hudMf.textContent = mf + " T";
  }

  function createLabels() {
    const labelsContainer = getEl("labelsContainer");
    if (!labelsContainer) return;

    detectorGeometry.forEach((obj) => {
      if (obj.userData.layerName) {
        const d = document.createElement("div");
        d.className = "detector-label";
        d.textContent = obj.userData.layerName;
        d.addEventListener("click", () => {
          window.dispatchEvent(
            new CustomEvent("lhc:labelClick", {
              detail: { layerName: obj.userData.layerName, detector: currentDetector },
            })
          );
        });
        labelsContainer.appendChild(d);
        labelElements.push({ element: d, object: obj });
      }
    });
  }

  function updateLabels() {
    if (!showDetectorLabels) {
      labelElements.forEach((label) => label.element.classList.remove("visible"));
      return;
    }

    const canvasEl = getEl("canvas");
    const rect = canvasEl
      ? canvasEl.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };

    labelElements.forEach((label, index) => {
      const obj = label.object;
      const radius = obj.userData.radius || 8;
      const height = obj.userData.height || 40;

      const side = index % 2 === 0 ? 1 : -1;
      const xOffset = (height / 2 + 3) * side;
      const yOffset = radius * 0.3 + (index % 3) * 1.5;

      const labelPos = new THREE.Vector3(obj.position.x + xOffset, yOffset, 0);
      const screenPos = labelPos.clone().project(camera);

      if (screenPos.z > 1 || screenPos.z < -1) {
        label.element.classList.remove("visible");
        return;
      }

      const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
      const y = (screenPos.y * -0.5 + 0.5) * rect.height + rect.top;

      label.element.style.left = x + "px";
      label.element.style.top = y + "px";
      label.element.classList.add("visible");

      if (hoveredObject && hoveredObject === obj) label.element.classList.add("highlighted");
      else label.element.classList.remove("highlighted");
    });
  }

  // ───── particles / tracks ─────
  function createParticle(position, color, size) {
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

  function createJetCone(origin, direction, color, length) {
    const coneRadius = length * 0.35;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, length, 16, 1, false);
    coneGeometry.translate(0, -length / 2, 0);

    const coneMaterial = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      shininess: 120,
      specular: 0x444444,
      depthWrite: false,
    });

    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.renderOrder = 100;
    cone.position.copy(origin);

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    cone.quaternion.copy(quaternion);

    cone.userData = {
      age: 0,
      maxAge: 120,
      growthProgress: 0,
      spawnDelay: 0,
      initialOpacity: 0.65,
    };
    cone.scale.set(0, 0, 0);

    tracks.push(cone);
    scene.add(cone);
  }

  function createTrack(startPos, direction, color, length = 20, isMuon = false, hasTrail = false, charge = 1, momentum = 1000) {
    const points = [];
    const segments = 70;

    const B = MAGNETIC_FIELD[currentDetector] || 2.0;
    let curvature = 0;

    if (charge !== 0) {
      const radiusOfCurvature = momentum / (0.3 * Math.abs(charge) * B);
      const normalizedRadius = radiusOfCurvature / 10;
      curvature = (length * 20) / normalizedRadius;
      curvature *= Math.sign(charge);
      curvature = Math.max(-2.0, Math.min(2.0, curvature));
    }

    if (isMuon) curvature *= 0.3;

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

    const curvePath = new THREE.CatmullRomCurve3(points);
    const tubeRadius = isMuon ? 0.06 : hasTrail ? 0.055 : 0.045;
    const tubeGeometry = new THREE.TubeGeometry(curvePath, 56, tubeRadius, 7, false);
    const tubeMaterial = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: isMuon ? 1.2 : hasTrail ? 0.9 : 0.7,
      transparent: true,
      opacity: 0.98,
      shininess: 120,
      specular: 0x222222,
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.userData = {
      age: 0,
      maxAge: isMuon ? 180 : 150,
      direction: direction.clone(),
      initialOpacity: 0.98,
      isMuon,
      charge,
      momentum,
      spawnDelay: 0,
      growthProgress: 0,
    };
    return tube;
  }

  function updateHUD() {
    const el = (id) => getEl(id);
    const energy = el("simEnergy");
    const momentum = el("simMomentum");
    const trackCount = el("simTrackCount");
    const eventType = el("simEventType");
    if (energy) energy.textContent = eventData.energy + " TeV";
    if (momentum) momentum.textContent = eventData.momentum + " GeV/c";
    if (trackCount) trackCount.textContent = eventData.trackCount;
    if (eventType) eventType.textContent = eventData.eventType;
  }

  function clearAnimation() {
    clearMeshes(particles);
    clearMeshes(tracks);
    isAnimating = false;
    animationFrame = 0;
    eventData = { energy: 0, momentum: 0, trackCount: 0, eventType: "—" };
    updateHUD();
  }

  function createExplosion() {
    const numTracks = eventData.trackCount || 50;
    const collisionPoint = new THREE.Vector3(0, 0, 0);

    // flash
    const flashLayers = [];
    const flashConfigs = [
      { radius: 0.3, color: 0xffffff, opacity: 0.7 },
      { radius: 0.8, color: 0xff66ff, opacity: 0.5 },
      { radius: 1.2, color: 0x00ffff, opacity: 0.4 },
    ];

    flashConfigs.forEach((cfg) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.radius, 12, 12),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity })
      );
      mesh.position.copy(collisionPoint);
      scene.add(mesh);
      flashLayers.push(mesh);
    });

    let flashFrame = 0;
    const flashInterval = setInterval(() => {
      if (disposed) {
        clearInterval(flashInterval);
        flashLayers.forEach((m) => disposeObject3D(m));
        return;
      }
      flashFrame++;
      flashLayers.forEach((flash, index) => {
        const speed = 1 + index * 0.2;
        flash.scale.multiplyScalar(1 + 0.12 * speed);
        flash.material.opacity *= 0.94;
      });
      if (flashFrame > 15) {
        clearInterval(flashInterval);
        flashLayers.forEach((m) => disposeObject3D(m));
      }
    }, 20);

    // jets
    const numJets = Math.random() < 0.4 ? 2 : Math.random() < 0.7 ? 3 : 4;
    for (let j = 0; j < numJets; j++) {
      const jetAngle = (j / numJets) * Math.PI * 2 + Math.random() * 0.5;
      const jetColor = j % 2 === 0 ? 0xffaa00 : 0x00ff88;
      const jetDirection = new THREE.Vector3(Math.cos(jetAngle * 0.3), Math.sin(jetAngle) * 0.4, Math.cos(jetAngle) * 0.4).normalize();
      createJetCone(collisionPoint, jetDirection, jetColor, 8 + Math.random() * 4);
    }

    // tracks
    for (let i = 0; i < numTracks; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const direction = new THREE.Vector3(Math.cos(phi), Math.sin(phi) * Math.sin(theta), Math.sin(phi) * Math.cos(theta));

      let color, charge, momentum;
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
      const track = createTrack(collisionPoint, direction, color, length, false, false, charge, momentum);
      track.userData.spawnDelay = Math.random() * 10;
      track.userData.growthProgress = 0;
      track.scale.set(0, 0, 0);

      tracks.push(track);
      scene.add(track);
    }
  }

  function runSimulation(config) {
    // если уже анимируем — лучше сначала чистить, а не отказываться
    if (isAnimating) {
      clearAnimation();
    }

    if (config && config.detector && config.detector !== currentDetector) {
      currentDetector = config.detector;
      buildDetector(currentDetector);

      mountEl.querySelectorAll(".detector-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.detector === currentDetector);
      });
    }

    // 🔥 чистим и DISPOSE старые меши
    clearMeshes(particles);
    clearMeshes(tracks);

    eventData.eventType = config?.eventType || "Standard";
    eventData.energy = Number(config?.energy || 13.0).toFixed(2);
    eventData.momentum = Math.floor(config?.momentum || 1000);
    eventData.trackCount = config?.trackCount || 50;
    updateHUD();

    isAnimating = true;
    animationFrame = 0;

    const particle1 = createParticle(new THREE.Vector3(-25, 0, 0), 0x888888, 0.4);
    const particle2 = createParticle(new THREE.Vector3(25, 0, 0), 0xaaaaaa, 0.4);
    particle1.userData = { velocity: new THREE.Vector3(1.0, 0, 0) };
    particle2.userData = { velocity: new THREE.Vector3(-1.0, 0, 0) };
    particles.push(particle1, particle2);
    scene.add(particle1);
    scene.add(particle2);
  }

  // ───── animation loop ─────
  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);

    if (isAnimating && !isPaused) {
      animationFrame++;

      if (animationFrame < 25) {
        particles.forEach((p) => {
          if (p.userData.velocity) p.position.add(p.userData.velocity);
        });
      }

      if (animationFrame === 25) {
        clearMeshes(particles);
        createExplosion();
      }

      if (animationFrame > 25) {
        // 🔥 ВАЖНО: старые треки должны умирать и освобождать память
        for (let i = tracks.length - 1; i >= 0; i--) {
          const t = tracks[i];
          const ud = t.userData || {};
          ud.age = (ud.age || 0) + 1;

          if (ud.spawnDelay > 0) ud.spawnDelay--;

          if (ud.spawnDelay <= 0 && ud.growthProgress < 1) {
            ud.growthProgress += 0.12;
            const progress = Math.min(1, ud.growthProgress);
            const ease = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
            t.scale.set(ease, ease, ease);
          }

          // if expired -> remove & dispose
          if (ud.maxAge && ud.age > ud.maxAge) {
            disposeObject3D(t);
            tracks.splice(i, 1);
          }
        }

        if (tracks.length === 0 && animationFrame > 50) isAnimating = false;
      }
    }

    updateCamera();
    updateLabels();
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  // ───── event handlers ─────
  function onMouseDown(e) {
    if (e.button === 0) {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      clickStartPos = { x: e.clientX, y: e.clientY };
    }
  }

  function onMouseMove(e) {
    const canvasEl = getEl("canvas");
    const rect = canvasEl
      ? canvasEl.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    if (showDetectorLabels && !isDragging) {
      raycaster.setFromCamera(mouse, camera);
      raycaster.params.Line.threshold = 0.5;
      raycaster.params.Points.threshold = 0.5;

      const intersects = raycaster.intersectObjects(detectorGeometry, true);

      if (hoveredObject) {
        const layerGroup = hoveredObject.parent && hoveredObject.parent.userData.layerName ? hoveredObject.parent : hoveredObject;
        layerGroup.traverse((child) => {
          if (child.material && child.userData.baseOpacity !== undefined) child.material.opacity = child.userData.baseOpacity;
        });
        hoveredObject = null;
      }

      if (intersects.length > 0) {
        let layerGroup = intersects[0].object;
        while (layerGroup.parent && !layerGroup.userData.layerName) layerGroup = layerGroup.parent;

        if (layerGroup.userData.layerName) {
          hoveredObject = layerGroup;
          layerGroup.traverse((child) => {
            if (child.material && child.userData.baseOpacity !== undefined) child.material.opacity = child.userData.baseOpacity * 2.0;
          });
          if (renderer?.domElement) renderer.domElement.style.cursor = "pointer";
        } else {
          if (renderer?.domElement) renderer.domElement.style.cursor = "default";
        }
      } else {
        if (renderer?.domElement) renderer.domElement.style.cursor = "default";
      }
    } else {
      if (renderer?.domElement) renderer.domElement.style.cursor = "default";
    }

    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      cameraRotation.y += deltaX * 0.005;
      cameraRotation.x += deltaY * 0.005;
      cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotation.x));
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) isDragging = false;
  }

  function onMouseClick(e) {
    const dragDistance = Math.sqrt(Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2));
    if (!showDetectorLabels || dragDistance >= 5) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(detectorGeometry, true);
    if (!intersects.length) return;

    let layerGroup = intersects[0].object;
    while (layerGroup.parent && !layerGroup.userData.layerName) layerGroup = layerGroup.parent;
    if (!layerGroup.userData.layerName) return;

    window.dispatchEvent(
      new CustomEvent("lhc:labelClick", {
        detail: { layerName: layerGroup.userData.layerName, detector: currentDetector },
      })
    );
  }

  function onMouseWheel(e) {
    const canvasEl = getEl("canvas");
    if (canvasEl && !canvasEl.contains(e.target)) return;
    e.preventDefault();
    cameraDistance += e.deltaY * 0.05;
    cameraDistance = Math.max(15, Math.min(60, cameraDistance));
  }

  function onKeyDown(e) {
    if (e.code === "Space") {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      isPaused = !isPaused;
    }
  }

  function updateCamera() {
    if (!camera) return;
    camera.position.x = Math.sin(cameraRotation.y) * Math.cos(cameraRotation.x) * cameraDistance;
    camera.position.y = Math.sin(cameraRotation.x) * cameraDistance;
    camera.position.z = Math.cos(cameraRotation.y) * Math.cos(cameraRotation.x) * cameraDistance;
    camera.lookAt(0, 0, 0);
  }

  function onWindowResize() {
    const canvasEl = getEl("canvas");
    if (!canvasEl || !camera || !renderer) return;
    const w = canvasEl.clientWidth || window.innerWidth;
    const h = canvasEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ───── init ─────
  function init() {
    const canvasEl = getEl("canvas");
    if (!canvasEl) return;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.001);

    const w = canvasEl.clientWidth || window.innerWidth;
    const h = canvasEl.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(20, 10, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasEl.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x667eea, 1, 100);
    pointLight1.position.set(20, 20, 20);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x764ba2, 0.8, 100);
    pointLight2.position.set(-20, -10, -20);
    scene.add(pointLight2);

    buildDetector(currentDetector);

    window.addEventListener("resize", onWindowResize);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("click", onMouseClick);
    document.addEventListener("wheel", onMouseWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);

    const clearBtn = getEl("clearBtn");
    clearBtn && clearBtn.addEventListener("click", clearAnimation);

    const showLabelsEl = getEl("showLabels");
    showLabelsEl &&
      showLabelsEl.addEventListener("change", function (e) {
        showDetectorLabels = e.target.checked;
        if (showDetectorLabels) updateLabels();
        else labelElements.forEach((label) => label.element.classList.remove("visible"));
      });

    const legendToggle = getEl("legendToggle");
    legendToggle &&
      legendToggle.addEventListener("click", function () {
        showLegend = !showLegend;
        const legend = getEl("legend");
        if (!legend || !legendToggle) return;
        if (showLegend) {
          legend.classList.remove("hidden");
          legendToggle.style.display = "none";
        } else {
          legend.classList.add("hidden");
          legendToggle.style.display = "block";
        }
      });

    const legend = getEl("legend");
    legend &&
      legend.addEventListener("click", function () {
        showLegend = false;
        this.classList.add("hidden");
        const t = getEl("legendToggle");
        if (t) t.style.display = "block";
      });

    mountEl.querySelectorAll(".detector-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        if (currentDetector === this.dataset.detector) return;
        mountEl.querySelectorAll(".detector-btn").forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        currentDetector = this.dataset.detector;
        buildDetector(currentDetector);
      });
    });

    animate();
  }

  // ───── dispose ─────
  function dispose() {
    disposed = true;

    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("click", onMouseClick);
    document.removeEventListener("wheel", onMouseWheel);
    document.removeEventListener("keydown", onKeyDown);

    clearMeshes(particles);
    clearMeshes(tracks);

    detectorGeometry.forEach((o) => disposeObject3D(o));
    detectorGeometry = [];
    labelElements = [];

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss?.();
      const domEl = renderer.domElement;
      if (domEl && domEl.parentNode) domEl.parentNode.removeChild(domEl);
      renderer = null;
    }

    if (scene) {
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) disposeMaterial(obj.material);
      });
      scene = null;
    }

    camera = null;
  }

  init();
  return { runSimulation, clearAnimation, dispose };
}

// ───────────────────────────────────────────
// SearchableSelect (как было)
// ───────────────────────────────────────────
function SearchableSelect({ id, name, label, options, value, onChange, placeholder = "Выберите...", error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

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
        <span className={s.simulation__selectValue}>{selected ? selected.label : placeholder}</span>
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
          <ul ref={listRef} className={s.simulation__dropdownList} role="listbox" aria-label="options">
            {filtered.length === 0 ? (
              <li className={s.simulation__dropdownEmpty}>Ничего не найдено</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  data-idx={idx}
                  className={`${s.simulation__dropdownItem}
                    ${idx === activeIndex ? s.simulation__dropdownItemActive : ""}
                    ${opt.value === value ? s.simulation__dropdownItemSelected : ""}`}
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

// ───────────────────────────────────────────
// Main component
// ───────────────────────────────────────────
export default function Simulation() {
  const particleOptions = useMemo(() => {
    const arr = Array.isArray(particlesData) ? particlesData : [];
    return arr
      .filter((p) => p && typeof p.name === "string")
      .map((p) => ({ value: p.name, label: p.name, type: p.type || "", raw: p }))
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

  const [particlesModalOpen, setParticlesModalOpen] = useState(false);
  const [rawStages, setRawStages] = useState({ first: null, finals: null });

  const [hasOutputs, setHasOutputs] = useState(false);
  const [outputs, setOutputs] = useState({ mass: "", baryon: "", sbc: "", charge: "" });

  const [showViz, setShowViz] = useState(false);

  const simRef = useRef(null);
  const vizWrapRef = useRef(null);

  const abortRef = useRef(null);
  const [detectorModalOpen, setDetectorModalOpen] = useState(false);
  const [detectorLayer, setDetectorLayer] = useState(null);

  useEffect(() => {
    const onClick = (e) => {
      const { layerName, detector } = e.detail || {};
      if (!layerName) return;
      setDetectorLayer({ layerName, detector });
      setDetectorModalOpen(true);
    };
    window.addEventListener("lhc:labelClick", onClick);
    return () => window.removeEventListener("lhc:labelClick", onClick);
  }, []);

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
    setOutputs({ mass, baryon: String(baryon), sbc, charge: String(charge) });
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

  // ───── Initialize / dispose Three.js visualization ─────
  useEffect(() => {
    if (!showViz) return;

    let cancelled = false;

    (async () => {
      try {
        await loadThreeFromCdn();
      } catch (e) {
        console.error("Failed to load Three.js:", e);
        return;
      }

      if (cancelled) return;

      requestAnimationFrame(() => {
        if (cancelled) return;

        const mountEl = vizWrapRef.current;
        if (!mountEl) return;

        // если вдруг уже есть инстанс — убьём
        if (simRef.current) {
          simRef.current.dispose();
          simRef.current = null;
        }

        const sim = createLhcSimulation(mountEl);
        if (sim) simRef.current = sim;
      });
    })();

    return () => {
      cancelled = true;
      if (simRef.current) {
        simRef.current.dispose();
        simRef.current = null;
      }
    };
  }, [showViz]);

  const startVizAutoRun = useCallback(() => {
    if (!simRef.current) return;

    const eNum = Number(String(energy).replace(",", ".")) || 13.0;
    const massGuess = Number(outputs.mass);
    const eventType = Number.isFinite(massGuess) && massGuess > 10 ? "Higgs Boson" : "Standard";

    simRef.current.runSimulation({
      eventType,
      energy: Math.max(10, Math.min(14, eNum / 10)) || 13.0,
      momentum: 1200,
      trackCount: 45,
      detector: "ATLAS",
    });
  }, [energy, outputs.mass]);

  function safeJsonParse(maybeString) {
    if (typeof maybeString !== "string") return maybeString;
    try {
      return JSON.parse(maybeString);
    } catch {
      return maybeString;
    }
  }

  async function handleStart() {
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

    try {
      const payload = [{ id_1, id_2, Energy: E }];

      function getCookie(name) {
        const v = `; ${document.cookie}`;
        const parts = v.split(`; ${name}=`);
        return parts.length === 2 ? parts.pop().split(";").shift() : null;
      }

      const token = localStorage.getItem("access_token");

      const res = await fetch("/api/simulation/", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
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

      let finals = Array.isArray(data) ? data[0] : data?.finals;
      let first_finals = Array.isArray(data) ? data[1] : data?.first_finals;

      finals = safeJsonParse(finals);
      first_finals = safeJsonParse(first_finals);

      const vals = Array.isArray(data) ? data[2] : data?.values;

      setStage1(formatStage(first_finals));
      setDecay(formatStage(finals));
      setValues(vals ?? null);
      updateOutputsFromValues(vals ?? null);
      setHasOutputs(true);
      setRawStages({ first: first_finals ?? null, finals: finals ?? null });

      setShowViz(true);

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

  // Auto-run visualization after results arrive
  useEffect(() => {
    if (!showViz) return;

    const t = setTimeout(() => {
      startVizAutoRun();
    }, 300);

    return () => clearTimeout(t);
  }, [showViz, stage1, decay, startVizAutoRun]);

  useEffect(() => {
    return () => {
      if (simRef.current) {
        simRef.current.dispose();
        simRef.current = null;
      }
    };
  }, []);

  return (
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
                  className={`${s.simulation__parameters_input} ${errors.energy ? s.simulation__fieldError : ""}`}
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
                {errors.energy ? <div className={s.simulation__errorText}>{errors.energy}</div> : null}
              </div>

              {apiError ? <div className={s.simulation__errorText}>Ошибка API: {apiError}</div> : null}
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
                  if (!hasAny) return log("Сначала запусти симуляцию — частиц пока нет");
                  setParticlesModalOpen(true);
                }}
              >
                Частицы
              </button>
            </div>
          </div>

          <div className={s.simulation__big}>
            <div className={s.simulation__bigMain}>
              {!showViz ? (
                <div className={s.simulation__vizPlaceholder}>
                  <div className={s.simulation__vizPlaceholderTitle}>Visualization</div>
                  <div className={s.simulation__vizPlaceholderText}>Появится после успешной симуляции</div>
                </div>
              ) : (
                <div className={s.simulation__vizWrap} ref={vizWrapRef}>
                  <div id="canvas" className={s.simulation__vizCanvas} />

                  <div id="detectorLabel">ATLAS</div>

                  <div id="detectorSelection">
                    <button className="detector-btn active" data-detector="ATLAS">
                      ATLAS
                    </button>
                    <button className="detector-btn" data-detector="CMS">
                      CMS
                    </button>
                    <button className="detector-btn" data-detector="ALICE">
                      ALICE
                    </button>
                    <button className="detector-btn" data-detector="LHCb">
                      LHCb
                    </button>
                  </div>

                  <div id="controls">
                    <button id="startBtn" style={{ display: "none" }}>
                      Запустить коллайдер
                    </button>
                    <button id="clearBtn">Очистить</button>
                  </div>

                  <div id="hud">
                    <div>
                      <span className="label">Энергия:</span>
                      <span className="value" id="simEnergy">
                        0 TeV
                      </span>
                    </div>
                    <div>
                      <span className="label">Импульс:</span>
                      <span className="value" id="simMomentum">
                        0 GeV/c
                      </span>
                    </div>
                    <div>
                      <span className="label">Треки:</span>
                      <span className="value" id="simTrackCount">
                        0
                      </span>
                    </div>
                    <div>
                      <span className="label">Событие:</span>
                      <span className="value" id="simEventType">
                        —
                      </span>
                    </div>
                    <div>
                      <span className="label">🧲 Магн. поле:</span>
                      <span className="value" id="magneticField">
                        2.0 T
                      </span>
                    </div>
                  </div>

                  <div id="instructions">
                    <div>🖱️ ЛКМ - вращение</div>
                    <div>🔍 Колесико - зум</div>
                    <div>⏸️ Space - пауза</div>
                  </div>

                  <label id="labelsToggle">
                    <input type="checkbox" id="showLabels" />
                    Подписи детектора
                  </label>

                  <div id="labelsContainer"></div>

                  <div id="legend">
                    <h3>🎨 Легенда треков</h3>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: "#ff8800", boxShadow: "0 0 5px #ff8800" }}></div>
                      <span className="legend-label">Джеты (адроны)</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: "#ff00ff", boxShadow: "0 0 5px #ff00ff" }}></div>
                      <span className="legend-label">Лептоны (e, μ)</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: "#00ff00", boxShadow: "0 0 5px #00ff00" }}></div>
                      <span className="legend-label">Фотоны (γ)</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: "#00ffff", boxShadow: "0 0 5px #00ffff" }}></div>
                      <span className="legend-label">Мюоны (μ)</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: "#00ff88", boxShadow: "0 0 5px #00ff88" }}></div>
                      <span className="legend-label">Заряженные частицы</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ background: "#ff3300", boxShadow: "0 0 5px #ff3300" }}></div>
                      <span className="legend-label">Нейтральные частицы</span>
                    </div>
                  </div>

                  <button id="legendToggle">📊 Легенда</button>
                </div>
              )}
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

        {detectorModalOpen && (
          <div className={s.detectorModalBackdrop} onMouseDown={() => setDetectorModalOpen(false)} role="dialog" aria-modal="true">
            <div className={s.detectorModal} onMouseDown={(e) => e.stopPropagation()}>
              <div className={s.detectorModalHeader}>
                <div className={s.detectorModalTitle}>Слой детектора</div>
                <button className={s.detectorModalClose} onClick={() => setDetectorModalOpen(false)} type="button">
                  ✕
                </button>
              </div>
              <div className={s.detectorModalBody}>
                <div>
                  <b>Детектор:</b> {detectorLayer?.detector}
                </div>
                <div>
                  <b>Слой:</b> {detectorLayer?.layerName}
                </div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}
