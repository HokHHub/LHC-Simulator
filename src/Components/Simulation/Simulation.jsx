import Container from "../Container/Container";
import s from "./Simulation.module.css";
import { useEffect, useMemo, useRef, useState } from "react";

import particlesData from "../../data/all_particles.json";
import ParticlesModal from "../ParticlesModal/ParticlesModal";
import Modal from "../Modal/Modal";

/**
 * Load Three.js from CDN (no bundler import)
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
 * Injects LHC sim script once.
 * Exposes:
 *  - window.runSimulation(config)
 *  - window.clearAnimation()
 *  - window.__LHC_DISPOSE__()   // IMPORTANT cleanup
 */
function injectLhcScriptOnce() {
  if (window.__LHC_SIM_INIT__) return;
  window.__LHC_SIM_INIT__ = true;

  const code = `
  (function () {
    if (!window.THREE) {
      console.error("THREE not loaded");
      return;
    }

    const THREE = window.THREE;

    let scene = null, camera = null, renderer = null;
    let particles = [];
    let tracks = [];
    let isAnimating = false;
    let animationFrame = 0;
    let isPaused = false;

    let currentDetector = 'ATLAS';
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
      eventType: '—'
    };

    const MAGNETIC_FIELD = {
      'ATLAS': 2.0,
      'CMS': 3.8,
      'ALICE': 0.5,
      'LHCb': 1.1
    };

    // =====================================================================
    // ANIMATION PROFILES per eventType
    // Each profile defines: flash colors, track palette, jet config,
    // track generation logic, and special effects.
    // =====================================================================
    const ANIMATION_PROFILES = {
      'Muon Event': {
        flash: [
          { radius: 0.25, color: 0x00ffff, opacity: 0.6 },
          { radius: 0.6, color: 0x0088ff, opacity: 0.4 },
        ],
        numJets: 0,
        // Muons: few long straight tracks penetrating all layers
        generateTracks: function(collisionPoint, numTracks, B) {
          var result = [];
          // 2-4 prominent muon tracks
          var numMuons = 2 + Math.floor(Math.random() * 3);
          for (var i = 0; i < numMuons; i++) {
            var theta = Math.random() * Math.PI * 2;
            var phi = 0.3 + Math.random() * 2.5;
            var direction = new THREE.Vector3(
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta),
              Math.sin(phi) * Math.cos(theta)
            );
            result.push({
              direction: direction,
              color: 0x00ffff,
              charge: (Math.random() > 0.5 ? 1 : -1),
              momentum: 40 + Math.random() * 60,
              length: 25 + Math.random() * 15,
              isMuon: true
            });
          }
          // A few soft hadronic tracks
          var numSoft = Math.min(numTracks - numMuons, 6 + Math.floor(Math.random() * 6));
          for (var j = 0; j < numSoft; j++) {
            var theta2 = Math.random() * Math.PI * 2;
            var phi2 = Math.random() * Math.PI;
            var dir = new THREE.Vector3(
              Math.cos(phi2),
              Math.sin(phi2) * Math.sin(theta2),
              Math.sin(phi2) * Math.cos(theta2)
            );
            result.push({
              direction: dir,
              color: (Math.random() > 0.5 ? 0xff8800 : 0xffaa00),
              charge: (Math.random() > 0.5 ? 1 : -1),
              momentum: 2 + Math.random() * 10,
              length: 5 + Math.random() * 10,
              isMuon: false
            });
          }
          return result;
        }
      },

      'Higgs Boson': {
        flash: [
          { radius: 0.4, color: 0xffffff, opacity: 0.9 },
          { radius: 1.0, color: 0xffdd44, opacity: 0.7 },
          { radius: 1.8, color: 0xff8800, opacity: 0.5 },
          { radius: 2.5, color: 0xff4400, opacity: 0.3 },
        ],
        numJets: 2,
        jetColors: [0xffcc00, 0xffaa00],
        jetLength: [10, 14],
        // H -> ZZ -> 4 leptons: 4 bright tracks + hadronic activity
        generateTracks: function(collisionPoint, numTracks, B) {
          var result = [];
          // 4 prominent lepton tracks (H -> ZZ -> 4l signature)
          var leptonColors = [0xff00ff, 0xff44ff, 0x00ffff, 0x44ffff];
          for (var i = 0; i < 4; i++) {
            var spread = (Math.PI / 3) + Math.random() * (Math.PI / 4);
            var azimuth = (i / 4) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            var direction = new THREE.Vector3(
              Math.cos(spread) * 0.6,
              Math.sin(azimuth) * Math.sin(spread),
              Math.cos(azimuth) * Math.sin(spread)
            ).normalize();
            result.push({
              direction: direction,
              color: leptonColors[i],
              charge: (i < 2 ? 1 : -1),
              momentum: 20 + Math.random() * 30,
              length: 18 + Math.random() * 12,
              isMuon: (i < 2) // first pair are muons
            });
          }
          // Hadronic activity
          var numHadronic = Math.min(numTracks - 4, 20 + Math.floor(Math.random() * 15));
          for (var j = 0; j < numHadronic; j++) {
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.random() * Math.PI;
            var dir = new THREE.Vector3(
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta),
              Math.sin(phi) * Math.cos(theta)
            );
            var rand = Math.random();
            var color, charge, mom;
            if (rand < 0.5) {
              color = 0xffaa00;
              charge = (Math.random() > 0.5 ? 1 : -1);
              mom = 2 + Math.random() * 12;
            } else if (rand < 0.8) {
              color = 0x00ff88;
              charge = (Math.random() > 0.5 ? 1 : -1);
              mom = 5 + Math.random() * 15;
            } else {
              color = 0xff3300;
              charge = 0;
              mom = 8 + Math.random() * 15;
            }
            result.push({
              direction: dir,
              color: color,
              charge: charge,
              momentum: mom,
              length: 8 + Math.random() * 12,
              isMuon: false
            });
          }
          return result;
        }
      },

      'W/Z Boson': {
        flash: [
          { radius: 0.3, color: 0xffffff, opacity: 0.7 },
          { radius: 0.8, color: 0xcc44ff, opacity: 0.5 },
          { radius: 1.4, color: 0x8844ff, opacity: 0.35 },
        ],
        numJets: 1,
        jetColors: [0xcc66ff],
        jetLength: [8, 11],
        // W/Z: 1-2 high-pT leptons + missing energy (dashed neutrino) + jets
        generateTracks: function(collisionPoint, numTracks, B) {
          var result = [];
          // 1-2 high-pT lepton tracks
          var numLeptons = 1 + Math.floor(Math.random() * 2);
          for (var i = 0; i < numLeptons; i++) {
            var theta = Math.random() * Math.PI * 2;
            var phi = 0.4 + Math.random() * 2.3;
            var direction = new THREE.Vector3(
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta),
              Math.sin(phi) * Math.cos(theta)
            );
            result.push({
              direction: direction,
              color: 0xff00ff,
              charge: (Math.random() > 0.5 ? 1 : -1),
              momentum: 25 + Math.random() * 35,
              length: 20 + Math.random() * 10,
              isMuon: true
            });
          }
          // "Missing energy" track — neutrino (dashed visual, neutral)
          var nuTheta = Math.random() * Math.PI * 2;
          var nuPhi = 0.5 + Math.random() * 2.0;
          result.push({
            direction: new THREE.Vector3(
              Math.cos(nuPhi),
              Math.sin(nuPhi) * Math.sin(nuTheta),
              Math.sin(nuPhi) * Math.cos(nuTheta)
            ),
            color: 0x666688,
            charge: 0,
            momentum: 30 + Math.random() * 30,
            length: 22 + Math.random() * 8,
            isMuon: false,
            isDashed: true
          });
          // Hadronic tracks
          var numHadronic = Math.min(numTracks - numLeptons - 1, 15 + Math.floor(Math.random() * 10));
          for (var j = 0; j < numHadronic; j++) {
            var t2 = Math.random() * Math.PI * 2;
            var p2 = Math.random() * Math.PI;
            var dir = new THREE.Vector3(
              Math.cos(p2),
              Math.sin(p2) * Math.sin(t2),
              Math.sin(p2) * Math.cos(t2)
            );
            var rand = Math.random();
            result.push({
              direction: dir,
              color: (rand < 0.6 ? 0xffaa00 : 0x00ff88),
              charge: (Math.random() > 0.5 ? 1 : -1),
              momentum: 2 + Math.random() * 12,
              length: 6 + Math.random() * 12,
              isMuon: false
            });
          }
          return result;
        }
      },

      'Jet Event': {
        flash: [
          { radius: 0.3, color: 0xffffff, opacity: 0.6 },
          { radius: 0.7, color: 0xff8800, opacity: 0.5 },
          { radius: 1.1, color: 0xff4400, opacity: 0.35 },
        ],
        numJets: null, // will be computed: 3-6 jets
        jetColors: [0xffaa00, 0xff8800, 0xff6600, 0x00ff88, 0xffcc00, 0xff4400],
        jetLength: [9, 15],
        // Jet event: many collimated tracks in jet cones
        generateTracks: function(collisionPoint, numTracks, B) {
          var result = [];
          // Generate jet axes (3-6)
          var numJetAxes = 3 + Math.floor(Math.random() * 4);
          var jetAxes = [];
          for (var j = 0; j < numJetAxes; j++) {
            var jTheta = Math.random() * Math.PI * 2;
            var jPhi = 0.3 + Math.random() * 2.5;
            jetAxes.push(new THREE.Vector3(
              Math.cos(jPhi),
              Math.sin(jPhi) * Math.sin(jTheta),
              Math.sin(jPhi) * Math.cos(jTheta)
            ).normalize());
          }
          // Distribute tracks among jets
          var tracksPerJet = Math.floor(numTracks / numJetAxes);
          for (var ji = 0; ji < numJetAxes; ji++) {
            var axis = jetAxes[ji];
            var jetColor = [0xffaa00, 0xff8800, 0xffcc00, 0x00ff88][ji % 4];
            for (var ti = 0; ti < tracksPerJet; ti++) {
              // Collimated: small angle from jet axis
              var spread = (Math.random() - 0.5) * 0.4;
              var spread2 = (Math.random() - 0.5) * 0.4;
              var dir = new THREE.Vector3(
                axis.x + spread,
                axis.y + spread2,
                axis.z + (Math.random() - 0.5) * 0.4
              ).normalize();
              result.push({
                direction: dir,
                color: jetColor,
                charge: (Math.random() > 0.5 ? 1 : -1),
                momentum: 3 + Math.random() * 18,
                length: 10 + Math.random() * 15,
                isMuon: false
              });
            }
          }
          // A few uncollimated soft tracks
          for (var s = 0; s < 5; s++) {
            var st = Math.random() * Math.PI * 2;
            var sp = Math.random() * Math.PI;
            result.push({
              direction: new THREE.Vector3(
                Math.cos(sp),
                Math.sin(sp) * Math.sin(st),
                Math.sin(sp) * Math.cos(st)
              ),
              color: 0xff3300,
              charge: 0,
              momentum: 5 + Math.random() * 10,
              length: 5 + Math.random() * 8,
              isMuon: false
            });
          }
          return result;
        }
      },

      'Standard': {
        flash: [
          { radius: 0.3, color: 0xffffff, opacity: 0.7 },
          { radius: 0.8, color: 0xff66ff, opacity: 0.5 },
          { radius: 1.2, color: 0x00ffff, opacity: 0.4 },
        ],
        numJets: null, // random 2-4
        generateTracks: function(collisionPoint, numTracks, B) {
          var result = [];
          for (var i = 0; i < numTracks; i++) {
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.random() * Math.PI;
            var direction = new THREE.Vector3(
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta),
              Math.sin(phi) * Math.cos(theta)
            );
            var color, charge, momentum;
            var rand = Math.random();
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
            result.push({
              direction: direction,
              color: color,
              charge: charge,
              momentum: momentum,
              length: 15 + Math.random() * 15,
              isMuon: false
            });
          }
          return result;
        }
      }
    };

    let rafId = null;
    let disposed = false;

    function getEl(id) {
      return document.getElementById(id);
    }

    function disposeObject(obj) {
      if (!obj) return;
      obj.traverse && obj.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
          child.geometry = null;
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m && m.dispose && m.dispose());
          } else if (child.material.dispose) {
            child.material.dispose();
          }
          child.material = null;
        }
      });
    }

    // -------- Detector geometry helpers --------

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
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = Math.PI / 2;
      mesh.userData.layerName = layerName;
      mesh.userData.baseOpacity = opacity * 0.12;

      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: opacity * 1.5
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
        color, transparent: true, opacity: opacity * 0.18, wireframe: true, side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = position;
      mesh.rotation.y = Math.PI / 2;
      mesh.userData.baseOpacity = opacity * 0.18;

      const edges = new THREE.EdgesGeometry(geometry);
      const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 1.1 });
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

        vertices.push(-height/2, x1, y1);
        vertices.push(height/2, x1, y1);
      }

      const numRings = 4;
      for (let i = 0; i < numRings; i++) {
        const z = -height/2 + (i / (numRings-1)) * height;
        for (let j = 0; j < 28; j++) {
          const angle1 = (j / 28) * Math.PI * 2;
          const angle2 = ((j+1) / 28) * Math.PI * 2;

          vertices.push(z, Math.cos(angle1) * radius, Math.sin(angle1) * radius);
          vertices.push(z, Math.cos(angle2) * radius, Math.sin(angle2) * radius);
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

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
        group.add(createEndCap(radius, height, height/2, color, opacity));
        group.add(createEndCap(radius, height, -height/2, color, opacity));
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
        color, emissive: color, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3
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
      linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linesVertices, 3));
      const linesMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
      group.add(new THREE.LineSegments(linesGeometry, linesMaterial));

      return group;
    }

    // -------- Detector builders --------

    function buildATLAS() {
      const lbl = getEl('detectorLabel');
      if (lbl) lbl.textContent = 'ATLAS';

      const layers = [
        { radius: 12, height: 48, color: 0x2a5a8a, opacity: 0.12, name: 'Muon System' },
        { radius: 10, height: 40, color: 0x3a6a9a, opacity: 0.15, name: 'Calorimeter' },
        { radius: 7, height: 32, color: 0x4a7aaa, opacity: 0.18, name: 'TRT' },
        { radius: 4, height: 24, color: 0x5a8aba, opacity: 0.22, name: 'SCT' },
        { radius: 1.8, height: 18, color: 0x6a9aca, opacity: 0.26, name: 'Pixel Detector' }
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
      const lbl = getEl('detectorLabel');
      if (lbl) lbl.textContent = 'CMS';

      const layers = [
        { radius: 11, height: 42, color: 0x8a2a3a, opacity: 0.12, name: 'Muon Chambers' },
        { radius: 9, height: 36, color: 0x9a3a4a, opacity: 0.15, name: 'HCAL' },
        { radius: 6.5, height: 30, color: 0xaa4a5a, opacity: 0.18, name: 'ECAL' },
        { radius: 4, height: 24, color: 0xba5a6a, opacity: 0.22, name: 'Tracker' },
        { radius: 1.8, height: 18, color: 0xca6a7a, opacity: 0.26, name: 'Silicon Tracker' }
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
      const lbl = getEl('detectorLabel');
      if (lbl) lbl.textContent = 'ALICE';

      const layers = [
        { radius: 10, height: 50, color: 0x2a8a5a, opacity: 0.12, name: 'TPC' },
        { radius: 7, height: 42, color: 0x3a9a6a, opacity: 0.15, name: 'TRD' },
        { radius: 5, height: 35, color: 0x4aaa7a, opacity: 0.18, name: 'TOF' },
        { radius: 3, height: 28, color: 0x5aba8a, opacity: 0.22, name: 'ITS' }
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
      const lbl = getEl('detectorLabel');
      if (lbl) lbl.textContent = 'LHCb';

      const components = [
        { radius: 2, height: 4, z: 16, color: 0x9a6aca, opacity: 0.30, name: 'VELO' },
        { radius: 4, height: 6, z: 8, color: 0x6a3a9a, opacity: 0.25, name: 'RICH1' },
        { radius: 5, height: 8, z: 2, color: 0x7a4aaa, opacity: 0.20, name: 'Trackers' },
        { radius: 6, height: 10, z: -6, color: 0x5a2a8a, opacity: 0.18, name: 'Magnet' },
        { radius: 7, height: 10, z: -15, color: 0x6a3a9a, opacity: 0.15, name: 'RICH2' },
        { radius: 8, height: 12, z: -26, color: 0x4a1a7a, opacity: 0.12, name: 'Calorimeters' }
      ];

      components.forEach((comp) => {
        const g = createDetectorLayer(comp.radius, comp.height, comp.color, comp.opacity, comp.name);
        g.position.x = comp.z;
        scene.add(g);
        detectorGeometry.push(g);
      });
    }

    function buildDetector(detectorType) {
      detectorGeometry.forEach(obj => { scene.remove(obj); disposeObject(obj); });
      detectorGeometry = [];

      const labelsContainer = getEl('labelsContainer');
      if (labelsContainer) labelsContainer.innerHTML = '';
      labelElements = [];

      if (detectorType === 'ATLAS') buildATLAS();
      else if (detectorType === 'CMS') buildCMS();
      else if (detectorType === 'ALICE') buildALICE();
      else if (detectorType === 'LHCb') buildLHCb();

      createLabels();

      const mf = MAGNETIC_FIELD[currentDetector] || 2.0;
      const hudMf = getEl('magneticField');
      if (hudMf) hudMf.textContent = mf + ' T';
    }

    function createLabels() {
      const labelsContainer = getEl('labelsContainer');
      if (!labelsContainer) return;

      detectorGeometry.forEach((obj) => {
        if (obj.userData.layerName) {
          const d = document.createElement('div');
          d.className = 'detector-label';
          d.textContent = obj.userData.layerName;
          d.addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("lhc:labelClick", {
              detail: { layerName: obj.userData.layerName, detector: currentDetector }
            }));
          });
          labelsContainer.appendChild(d);
          labelElements.push({ element: d, object: obj });
        }
      });
    }

    function updateLabels() {
      if (!showDetectorLabels) {
        labelElements.forEach(label => label.element.classList.remove('visible'));
        return;
      }

      const mount = getEl('canvas');
      const rect = mount ? mount.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };

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
          label.element.classList.remove('visible');
          return;
        }

        const x = (screenPos.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (screenPos.y * -0.5 + 0.5) * rect.height + rect.top;

        label.element.style.left = x + 'px';
        label.element.style.top = y + 'px';
        label.element.classList.add('visible');

        if (hoveredObject && hoveredObject === obj) label.element.classList.add('highlighted');
        else label.element.classList.remove('highlighted');
      });
    }

    // -------- Particles / tracks --------

    function createParticle(position, color, size) {
      const geometry = new THREE.SphereGeometry(size, 12, 12);
      const material = new THREE.MeshPhongMaterial({
        color, emissive: color, emissiveIntensity: 0.8, shininess: 100
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
        color, emissive: color, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.65, side: THREE.DoubleSide,
        shininess: 120, specular: 0x444444, depthWrite: false
      });

      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.renderOrder = 100;
      cone.position.copy(origin);

      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      cone.quaternion.copy(quaternion);

      cone.userData = { age: 0, maxAge: 120, growthProgress: 0, spawnDelay: 0, initialOpacity: 0.65 };
      cone.scale.set(0, 0, 0);

      tracks.push(cone);
      scene.add(cone);
    }

    function createDashedTrack(startPos, direction, color, length) {
      // Visual "missing energy" / neutrino — dashed line
      const points = [];
      const segments = 40;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        points.push(new THREE.Vector3(
          startPos.x + direction.x * t * length,
          startPos.y + direction.y * t * length,
          startPos.z + direction.z * t * length
        ));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: color,
        dashSize: 0.8,
        gapSize: 0.5,
        transparent: true,
        opacity: 0.5,
        linewidth: 1
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      line.userData = { age: 0, maxAge: 150, spawnDelay: Math.random() * 5, growthProgress: 0, initialOpacity: 0.5 };
      line.scale.set(0, 0, 0);
      tracks.push(line);
      scene.add(line);
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

      const curve = new THREE.CatmullRomCurve3(points);
      const tubeRadius = isMuon ? 0.06 : (hasTrail ? 0.055 : 0.045);
      const tubeGeometry = new THREE.TubeGeometry(curve, 56, tubeRadius, 7, false);
      const tubeMaterial = new THREE.MeshPhongMaterial({
        color, emissive: color,
        emissiveIntensity: isMuon ? 1.2 : (hasTrail ? 0.9 : 0.7),
        transparent: true, opacity: 0.98, shininess: 120, specular: 0x222222
      });

      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.userData = { age: 0, maxAge: isMuon ? 180 : 150, direction: direction.clone(), initialOpacity: 0.98, isMuon, charge, momentum };
      return tube;
    }

    function updateHUD() {
      const energy = getEl('energy');
      const momentum = getEl('momentum');
      const trackCount = getEl('trackCount');
      const eventType = getEl('eventType');
      if (energy) energy.textContent = eventData.energy + ' TeV';
      if (momentum) momentum.textContent = eventData.momentum + ' GeV/c';
      if (trackCount) trackCount.textContent = eventData.trackCount;
      if (eventType) eventType.textContent = eventData.eventType;
    }

    function clearAnimation() {
      particles.forEach(p => { scene && scene.remove(p); disposeObject(p); });
      tracks.forEach(t => { scene && scene.remove(t); disposeObject(t); });
      particles = [];
      tracks = [];
      isAnimating = false;
      animationFrame = 0;
      eventData = { energy: 0, momentum: 0, trackCount: 0, eventType: '—' };
      updateHUD();
    }

    // =================================================================
    // createExplosion — now uses ANIMATION_PROFILES based on eventType
    // =================================================================
    function createExplosion() {
      let numTracks = eventData.trackCount || 50;
      const collisionPoint = new THREE.Vector3(0, 0, 0);
      const evType = eventData.eventType || 'Standard';
      const profile = ANIMATION_PROFILES[evType] || ANIMATION_PROFILES['Standard'];
      const B = MAGNETIC_FIELD[currentDetector] || 2.0;

      // --- Flash effect ---
      const flashLayers = [];
      var flashConfigs = profile.flash || [
        { radius: 0.3, color: 0xffffff, opacity: 0.7 },
      ];

      flashConfigs.forEach(function(cfg) {
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
        if (disposed) { clearInterval(flashInterval); return; }
        flashFrame++;
        flashLayers.forEach((flash, index) => {
          const speed = 1 + index * 0.2;
          flash.scale.multiplyScalar(1 + 0.12 * speed);
          flash.material.opacity *= 0.94;
        });
        if (flashFrame > 15) {
          clearInterval(flashInterval);
          flashLayers.forEach(f => { scene.remove(f); disposeObject(f); });
        }
      }, 20);

      // --- Jets ---
      var numJets = profile.numJets;
      if (numJets === null || numJets === undefined) {
        numJets = Math.random() < 0.4 ? 2 : (Math.random() < 0.7 ? 3 : 4);
      }
      if (numJets > 0) {
        var jetColors = profile.jetColors || [0xffaa00, 0x00ff88];
        var jetLenRange = profile.jetLength || [8, 12];
        for (var j = 0; j < numJets; j++) {
          var jetAngle = (j / numJets) * Math.PI * 2 + Math.random() * 0.5;
          var jetColor = jetColors[j % jetColors.length];

          var jetDirection = new THREE.Vector3(
            Math.cos(jetAngle * 0.3),
            Math.sin(jetAngle) * 0.4,
            Math.cos(jetAngle) * 0.4
          ).normalize();

          var jetLen = jetLenRange[0] + Math.random() * (jetLenRange[1] - jetLenRange[0]);
          createJetCone(collisionPoint, jetDirection, jetColor, jetLen);
        }
      }

      // --- Tracks (profile-specific) ---
      var trackDefs = profile.generateTracks(collisionPoint, numTracks, B);

      trackDefs.forEach(function(def) {
        if (def.isDashed) {
          // Dashed line for "missing energy" (neutrino)
          createDashedTrack(collisionPoint, def.direction, def.color, def.length || 20);
        } else {
          var track = createTrack(
            collisionPoint,
            def.direction,
            def.color,
            def.length || 20,
            def.isMuon || false,
            false,
            def.charge || 0,
            def.momentum || 1000
          );
          track.userData.spawnDelay = Math.random() * 10;
          track.userData.growthProgress = 0;
          track.scale.set(0, 0, 0);

          tracks.push(track);
          scene.add(track);
        }
      });
    }

    function runSimulation(config) {
      if (!scene || !camera || !renderer) {
        console.warn("Simulation not ready yet");
        return;
      }

      if (isAnimating) {
        console.warn('Simulation already running.');
        return;
      }

      clearAnimation();

      eventData.eventType = (config && config.eventType) ? config.eventType : 'Standard';
      eventData.energy = Number((config && config.energy) ? config.energy : 13.0).toFixed(2);
      eventData.momentum = Math.floor((config && config.momentum) ? config.momentum : 1000);
      eventData.trackCount = (config && config.trackCount) ? config.trackCount : 50;

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

    function animate() {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);

      if (isAnimating && !isPaused) {
        animationFrame++;

        if (animationFrame < 25) {
          particles.forEach(p => {
            if (p.userData.velocity) p.position.add(p.userData.velocity);
          });
        }

        if (animationFrame === 25) {
          particles.forEach(p => { scene.remove(p); disposeObject(p); });
          particles = [];
          createExplosion();
        }

        if (animationFrame > 25) {
          let allGrown = true;

          tracks.forEach((track) => {
            if (track.userData && track.userData.spawnDelay !== undefined) {
              if (track.userData.spawnDelay > 0) {
                track.userData.spawnDelay--;
                allGrown = false;
              } else if (track.userData.growthProgress < 1) {
                track.userData.growthProgress += 0.12;
                const progress = Math.min(1, track.userData.growthProgress);
                const easeProgress = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
                track.scale.set(easeProgress, easeProgress, easeProgress);
                allGrown = false;
              }
            }
            if (track.userData) track.userData.age = (track.userData.age || 0) + 1;
          });

          if (allGrown && animationFrame > 50) isAnimating = false;
        }
      }

      updateCamera();
      updateLabels();
      renderer && scene && camera && renderer.render(scene, camera);
    }

    // -------- Input handlers --------

    function onMouseDown(e) {
      if (e.button === 0) {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        clickStartPos = { x: e.clientX, y: e.clientY };
      }
    }

    function onMouseMove(e) {
      const mount = getEl('canvas');
      const rect = mount ? mount.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };

      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      if (showDetectorLabels && !isDragging) {
        raycaster.setFromCamera(mouse, camera);
        raycaster.params.Line.threshold = 0.5;
        raycaster.params.Points.threshold = 0.5;

        const intersects = raycaster.intersectObjects(detectorGeometry, true);

        if (hoveredObject) {
          const layerGroup = hoveredObject.parent && hoveredObject.parent.userData.layerName
            ? hoveredObject.parent
            : hoveredObject;

          layerGroup.traverse((child) => {
            if (child.material && child.userData.baseOpacity !== undefined) {
              child.material.opacity = child.userData.baseOpacity;
            }
          });
          hoveredObject = null;
        }

        if (intersects.length > 0) {
          let layerGroup = intersects[0].object;
          while (layerGroup.parent && !layerGroup.userData.layerName) {
            layerGroup = layerGroup.parent;
          }

          if (layerGroup.userData.layerName) {
            hoveredObject = layerGroup;
            layerGroup.traverse((child) => {
              if (child.material && child.userData.baseOpacity !== undefined) {
                child.material.opacity = child.userData.baseOpacity * 2.0;
              }
            });
            if (renderer && renderer.domElement) renderer.domElement.style.cursor = 'pointer';
          } else {
            if (renderer && renderer.domElement) renderer.domElement.style.cursor = 'default';
          }
        } else {
          if (renderer && renderer.domElement) renderer.domElement.style.cursor = 'default';
        }
      } else {
        if (renderer && renderer.domElement) renderer.domElement.style.cursor = 'default';
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
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - clickStartPos.x, 2) +
        Math.pow(e.clientY - clickStartPos.y, 2)
      );
      if (!showDetectorLabels || dragDistance >= 5) return;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(detectorGeometry, true);
      if (!intersects.length) return;

      let layerGroup = intersects[0].object;
      while (layerGroup.parent && !layerGroup.userData.layerName) {
        layerGroup = layerGroup.parent;
      }
      if (!layerGroup.userData.layerName) return;

      window.dispatchEvent(new CustomEvent("lhc:labelClick", {
        detail: { layerName: layerGroup.userData.layerName, detector: currentDetector }
      }));
    }

    function onMouseWheel(e) {
      const mount = getEl('canvas');
      if (mount && !mount.contains(e.target)) return;

      e.preventDefault();
      cameraDistance += e.deltaY * 0.05;
      cameraDistance = Math.max(15, Math.min(60, cameraDistance));
    }

    function onKeyDown(e) {
      if (e.code === 'Space') {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
      const mount = getEl('canvas');
      if (!mount || !camera || !renderer) return;

      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    // -------- init / dispose --------

    function init() {
      if (disposed) return;

      const mount = getEl('canvas');
      if (!mount) return;

      while (mount.firstChild) mount.removeChild(mount.firstChild);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x000000, 0.001);

      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;

      camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
      camera.position.set(20, 10, 20);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
      scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0x667eea, 1, 100);
      pointLight1.position.set(20, 20, 20);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0x764ba2, 0.8, 100);
      pointLight2.position.set(-20, -10, -20);
      scene.add(pointLight2);

      buildDetector(currentDetector);

      window.addEventListener('resize', onWindowResize);
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('click', onMouseClick);
      document.addEventListener('wheel', onMouseWheel, { passive: false });
      document.addEventListener('keydown', onKeyDown);

      const clearBtn = getEl('clearBtn');
      clearBtn && clearBtn.addEventListener('click', clearAnimation);

      const showLabels = getEl('showLabels');
      showLabels && showLabels.addEventListener('change', function(e) {
        showDetectorLabels = e.target.checked;
        if (showDetectorLabels) updateLabels();
        if (!showDetectorLabels) labelElements.forEach(label => label.element.classList.remove('visible'));
      });

      const legendToggle = getEl('legendToggle');
      legendToggle && legendToggle.addEventListener('click', function() {
        showLegend = !showLegend;
        const legend = getEl('legend');
        const t = getEl('legendToggle');
        if (!legend || !t) return;

        if (showLegend) {
          legend.classList.remove('hidden');
          t.style.display = 'none';
        } else {
          legend.classList.add('hidden');
          t.style.display = 'block';
        }
      });

      const legend = getEl('legend');
      legend && legend.addEventListener('click', function() {
        showLegend = false;
        this.classList.add('hidden');
        const t = getEl('legendToggle');
        if (t) t.style.display = 'block';
      });

      document.querySelectorAll('.detector-btn').forEach(btn => {
  btn.addEventListener('click', function() {

    if (currentDetector === this.dataset.detector) return;

    document.querySelectorAll('.detector-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');

    currentDetector = this.dataset.detector;
    buildDetector(currentDetector);

    clearAnimation();
  });
});

      animate();
    }

    function disposeAll() {
      if (disposed) return;
      disposed = true;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onMouseClick);
      document.removeEventListener('wheel', onMouseWheel);
      document.removeEventListener('keydown', onKeyDown);

      try { clearAnimation(); } catch {}

      try {
        detectorGeometry.forEach(obj => { scene && scene.remove(obj); disposeObject(obj); });
      } catch {}
      detectorGeometry = [];

      try {
        const labelsContainer = getEl('labelsContainer');
        if (labelsContainer) labelsContainer.innerHTML = '';
      } catch {}

      if (renderer) {
        try { renderer.dispose(); } catch {}
        try { renderer.forceContextLoss && renderer.forceContextLoss(); } catch {}
        try {
          const dom = renderer.domElement;
          dom && dom.parentNode && dom.parentNode.removeChild(dom);
        } catch {}
        renderer = null;
      }

      if (scene) {
        try {
          scene.traverse((obj) => disposeObject(obj));
        } catch {}
        scene = null;
      }

      camera = null;
      particles = [];
      tracks = [];
      labelElements = [];
      hoveredObject = null;
    }

    // expose API
    window.runSimulation = runSimulation;
    window.clearAnimation = clearAnimation;
    window.__LHC_DISPOSE__ = disposeAll;

    init();
  })();
  `;

  const script = document.createElement("script");
  script.dataset.lhc = "embedded";
  script.textContent = code;
  document.body.appendChild(script);
}

// -----------------------------
// SearchableSelect (unchanged)
// -----------------------------
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
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); const opt = filtered[activeIndex]; if (opt) choose(opt); }
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

// -----------------------------
// Main component
// -----------------------------
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
      .join("n");
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

  const [showViz] = useState(true);
  const [simTrigger, setSimTrigger] = useState(0);

  const abortRef = useRef(null);

  const [detectorModalOpen, setDetectorModalOpen] = useState(false);
  const [detectorLayer, setDetectorLayer] = useState(null);

  const autoRanRef = useRef(false);

  const [particleInfoOpen, setParticleInfoOpen] = useState(false);
  const [particleInfoData, setParticleInfoData] = useState(null);

  function buildParticleModalData(raw, card) {
    const name = raw?.name ?? card?.name ?? "Particle";
    const symbol = raw?.symbol ?? card?.symbol ?? name?.[0] ?? "?";

    const massVal = raw?.mass ?? raw?.mass_GeV ?? card?.mass ?? null;
    const massText = Number.isFinite(Number(massVal)) ? `${Number(massVal).toFixed(3)} GeV` : "—";

    const chargeVal = raw?.charge ?? card?.charge ?? null;
    const chargeText = chargeVal == null ? "—" : String(chargeVal);

    const spinVal = raw?.spin ?? raw?.J ?? card?.spin ?? null;
    const spinText = spinVal == null ? "—" : String(spinVal);

    const family = raw?.type ?? raw?.family ?? "—";
    const stable = raw?.stable ?? raw?.stability ?? null;

    const descr =
      raw?.descr ||
      raw?.description ||
      `${name} (PDG: ${raw?.mcid ?? "—"})`;

    return {
      title: name,
      descr,
      iconText: symbol,
      color: raw?.color ?? card?.color ?? "#4E3F8F",
      stats: [
        { label: "Семья", value: String(family) },
        { label: "PDG id", value: String(raw?.mcid ?? "—") },
        { label: "Масса", value: massText },
        { label: "Спин", value: spinText },
        { label: "Заряд", value: chargeText },
        { label: "Стабильность", value: stable == null ? "—" : String(stable) },
      ],
    };
  }

  // Store eventType from backend for viz
  const eventTypeRef = useRef("Standard");

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

  useEffect(() => {
    return () => {
      try {
        if (window.__LHC_DISPOSE__) window.__LHC_DISPOSE__();
      } catch { }
      autoRanRef.current = false;
    };
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

  useEffect(() => {
    if (!showViz) return;

    let cancelled = false;

    (async () => {
      try {
        await loadThreeFromCdn();

        const waitForCanvas = () =>
          new Promise((resolve) => {
            const check = () => {
              const el = document.getElementById("canvas");
              if (el) resolve();
              else requestAnimationFrame(check);
            };
            check();
          });

        await waitForCanvas();
        if (cancelled) return;

        injectLhcScriptOnce();
      } catch (e) {
        console.error("Failed to init visualization:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [showViz]);

  function startVizAutoRun() {
    if (!window.runSimulation) return;

    const eNum = Number(String(energy).replace(",", ".")) || 13.0;

    // Use the actual eventType from backend (stored in ref)
    const evType = eventTypeRef.current || "Standard";

    // Extract track_count and momentum from values if available
    const row = Array.isArray(values) ? values[0] : values;
    const trackCount = (row && Number.isFinite(Number(row.track_count)) && Number(row.track_count) > 0)
      ? Number(row.track_count)
      : 45;
    const mom = (row && row.momentum != null)
      ? (typeof row.momentum === 'object' ? Number(row.momentum.parsedValue) : Number(row.momentum))
      : 1200;

    // Получаем текущий выбранный детектор из активной кнопки
    const activeDetectorBtn = document.querySelector('.detector-btn.active');
    const currentDetector = activeDetectorBtn?.dataset.detector || "ATLAS";

    window.runSimulation({
      eventType: evType,
      energy: Math.max(10, Math.min(14, eNum / 10)) || 13.0,
      momentum: Number.isFinite(mom) ? Math.floor(mom) : 1200,
      trackCount: Math.max(10, trackCount),
      detector: currentDetector,
    });
  }

  function safeJsonParse(maybeString) {
    if (typeof maybeString !== "string") return maybeString;
    try { return JSON.parse(maybeString); } catch { return maybeString; }
  }

  async function handleStart() {
    if (!validate()) {
      log("Валидация не прошла ❌");
      return;
    }

    autoRanRef.current = false;

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
      if (!res.ok) throw new Error(`HTTP ${res.status}. Ответ: ${text.slice(0, 300)}`);

      let data;
      try { data = text ? JSON.parse(text) : null; }
      catch { throw new Error(`Сервер вернул НЕ JSON: ${text.slice(0, 300)}`); }

      let finals = Array.isArray(data) ? data[0] : data?.finals;
      let first_finals = Array.isArray(data) ? data[1] : data?.first_finals;

      finals = safeJsonParse(finals);
      first_finals = safeJsonParse(first_finals);

      const vals = Array.isArray(data) ? data[2] : data?.values;

      setStage1(formatStage(first_finals));
      setDecay(formatStage(finals));
      setValues(vals ?? null);
      updateOutputsFromValues(vals ?? null);
      setRawStages({ first: first_finals ?? null, finals: finals ?? null });

      // Extract eventType from backend values and store in ref
      const valsRow = Array.isArray(vals) ? vals[0] : vals;
      eventTypeRef.current = (valsRow && valsRow.type) ? String(valsRow.type) : "Standard";

      setSimTrigger(prev => prev + 1); // Триггерим useEffect для запуска симуляции

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

  useEffect(() => {
    if (!showViz) return;
    if (simTrigger === 0) return; // Не запускаем при первом рендере
    if (autoRanRef.current) return;

    const wait = () => {
      if (autoRanRef.current) return;
      if (window.runSimulation) {
        autoRanRef.current = true;
        startVizAutoRun();
      } else {
        requestAnimationFrame(wait);
      }
    };
    wait();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simTrigger]);

  // Оборачиваем window.clearAnimation для сброса состояния
  useEffect(() => {
    if (!showViz) return;

    const originalClearAnimation = window.clearAnimation;
    if (!originalClearAnimation) return;

    // Переопределяем clearAnimation, добавляя сброс флагов
    window.clearAnimation = () => {
      originalClearAnimation();
      autoRanRef.current = false;
      // canvas остается видимым, но пустым
    };

    return () => {
      // Восстанавливаем оригинальную функцию при размонтировании
      window.clearAnimation = originalClearAnimation;
    };
  }, [showViz]);

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


              <div className={s.simulation__vizWrap}>
                <div id="canvas" className={s.simulation__vizCanvas} />

                <div id="detectorLabel" style={{display: "none"}}>ATLAS</div>

                <div id="detectorSelection">
                  <button className="detector-btn active" data-detector="ATLAS">ATLAS</button>
                  <button className="detector-btn" data-detector="CMS">CMS</button>
                  <button className="detector-btn" data-detector="ALICE">ALICE</button>
                  <button className="detector-btn" data-detector="LHCb">LHCb</button>
                </div>

                <div id="hud">
                  <div><span className="label">Энергия:</span> <span className="value" id="energy">0 TeV</span></div>
                  <div><span className="label">Импульс:</span> <span className="value" id="momentum">0 GeV/c</span></div>
                  <div><span className="label">Треки:</span> <span className="value" id="trackCount">0</span></div>
                  <div><span className="label">Событие:</span> <span className="value" id="eventType">—</span></div>
                  <div><span className="label">🧲 Магн. поле:</span> <span className="value" id="magneticField">2.0 T</span></div>
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
                  <div className="legend-item">
                    <div className="legend-color" style={{ background: "#666688", boxShadow: "0 0 5px #666688" }}></div>
                    <span className="legend-label">Missing energy (ν)</span>
                  </div>
                </div>

                <button id="legendToggle">📊 Легенда</button>

                {loading ? (
                  <div className={s.simulation__vizOverlay}>

                    <section className="am-container">
                      <style>{`
        .am-container {
          background: linear-gradient(173deg,#050505 43.63%,#080c0e 97.19%);
          width: 100%;
          min-height: 500px;
          height: 100%;
          display: flex;
          flex-wrap: wrap;
          place-content: center;
          place-items: center;
        }
        .am-container .scene {
          width: 100%;
          perspective: 500vmax;
          transform-style: preserve-3d;
        }
        .am-container .wrapper {
          width: 100%;
          height: 100%;
          transform: rotateY(0) translateZ(0);
          transform-style: preserve-3d;
        }
        .am-container .container-rings-2 {
          width: 6.52vmax;
          height: 6.52vmax;
          position: relative;
          margin-inline: auto;
          animation: amMove 9s ease infinite alternate;
          transform-style: preserve-3d;
        }
        .am-container .ring {
          width: 100%;
          height: 100%;
          border: 0.13vmax dotted currentColor;
          position: absolute;
          left: 0;
          top: 0;
          transform-origin: 50% 50%;
        }
        @keyframes amMove {
          from { transform: scale(0.7) rotateX(0deg) rotateY(0deg); }
          to { transform: scale(0.7) rotateX(360deg) rotateY(360deg); }
        }
      `}</style>
                      <aside className="scene">
                        <section className="wrapper">
                          <article className="container-rings-2">
                            <div className="ring" style={{ color: 'rgb(255,0,0)', transform: 'rotateX(0deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,6,0)', transform: 'rotateX(1.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,12,0)', transform: 'rotateX(2.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,18,0)', transform: 'rotateX(4.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,24,0)', transform: 'rotateX(5.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,30,0)', transform: 'rotateX(7deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,36,0)', transform: 'rotateX(8.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,42,0)', transform: 'rotateX(9.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,48,0)', transform: 'rotateX(11.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,54,0)', transform: 'rotateX(12.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,59,0)', transform: 'rotateX(14deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,65,0)', transform: 'rotateX(15.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,71,0)', transform: 'rotateX(16.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,77,0)', transform: 'rotateX(18.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,83,0)', transform: 'rotateX(19.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,89,0)', transform: 'rotateX(21deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,95,0)', transform: 'rotateX(22.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,101,0)', transform: 'rotateX(23.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,107,0)', transform: 'rotateX(25.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,113,0)', transform: 'rotateX(26.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,119,0)', transform: 'rotateX(28deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,125,0)', transform: 'rotateX(29.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,131,0)', transform: 'rotateX(30.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,137,0)', transform: 'rotateX(32.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,143,0)', transform: 'rotateX(33.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,149,0)', transform: 'rotateX(35deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,155,0)', transform: 'rotateX(36.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,161,0)', transform: 'rotateX(37.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,167,0)', transform: 'rotateX(39.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,173,0)', transform: 'rotateX(40.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,178,0)', transform: 'rotateX(42deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,184,0)', transform: 'rotateX(43.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,190,0)', transform: 'rotateX(44.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,196,0)', transform: 'rotateX(46.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,202,0)', transform: 'rotateX(47.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,208,0)', transform: 'rotateX(49deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,214,0)', transform: 'rotateX(50.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,220,0)', transform: 'rotateX(51.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,226,0)', transform: 'rotateX(53.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,232,0)', transform: 'rotateX(54.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,238,0)', transform: 'rotateX(56deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,244,0)', transform: 'rotateX(57.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,250,0)', transform: 'rotateX(58.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(254,255,0)', transform: 'rotateX(60.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(248,255,0)', transform: 'rotateX(61.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(242,255,0)', transform: 'rotateX(63deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(236,255,0)', transform: 'rotateX(64.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(230,255,0)', transform: 'rotateX(65.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(224,255,0)', transform: 'rotateX(67.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(218,255,0)', transform: 'rotateX(68.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(213,255,0)', transform: 'rotateX(70deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(207,255,0)', transform: 'rotateX(71.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(201,255,0)', transform: 'rotateX(72.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(195,255,0)', transform: 'rotateX(74.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(189,255,0)', transform: 'rotateX(75.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(183,255,0)', transform: 'rotateX(77deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(177,255,0)', transform: 'rotateX(78.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(171,255,0)', transform: 'rotateX(79.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(165,255,0)', transform: 'rotateX(81.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(159,255,0)', transform: 'rotateX(82.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(153,255,0)', transform: 'rotateX(84deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(147,255,0)', transform: 'rotateX(85.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(141,255,0)', transform: 'rotateX(86.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(135,255,0)', transform: 'rotateX(88.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(129,255,0)', transform: 'rotateX(89.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(123,255,0)', transform: 'rotateX(91deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(117,255,0)', transform: 'rotateX(92.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(111,255,0)', transform: 'rotateX(93.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(105,255,0)', transform: 'rotateX(95.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(99,255,0)', transform: 'rotateX(96.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(94,255,0)', transform: 'rotateX(98deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(88,255,0)', transform: 'rotateX(99.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(82,255,0)', transform: 'rotateX(100.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(76,255,0)', transform: 'rotateX(102.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(70,255,0)', transform: 'rotateX(103.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(64,255,0)', transform: 'rotateX(105deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(58,255,0)', transform: 'rotateX(106.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(52,255,0)', transform: 'rotateX(107.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(46,255,0)', transform: 'rotateX(109.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(40,255,0)', transform: 'rotateX(110.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(34,255,0)', transform: 'rotateX(112deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(28,255,0)', transform: 'rotateX(113.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(22,255,0)', transform: 'rotateX(114.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(16,255,0)', transform: 'rotateX(116.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(10,255,0)', transform: 'rotateX(117.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(4,255,0)', transform: 'rotateX(119deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,2)', transform: 'rotateX(120.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,8)', transform: 'rotateX(121.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,14)', transform: 'rotateX(123.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,20)', transform: 'rotateX(124.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,26)', transform: 'rotateX(126deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,31)', transform: 'rotateX(127.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,37)', transform: 'rotateX(128.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,43)', transform: 'rotateX(130.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,49)', transform: 'rotateX(131.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,55)', transform: 'rotateX(133deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,61)', transform: 'rotateX(134.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,67)', transform: 'rotateX(135.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,73)', transform: 'rotateX(137.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,79)', transform: 'rotateX(138.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,85)', transform: 'rotateX(140deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,91)', transform: 'rotateX(141.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,97)', transform: 'rotateX(142.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,103)', transform: 'rotateX(144.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,109)', transform: 'rotateX(145.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,115)', transform: 'rotateX(147deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,121)', transform: 'rotateX(148.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,127)', transform: 'rotateX(149.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,133)', transform: 'rotateX(151.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,139)', transform: 'rotateX(152.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,145)', transform: 'rotateX(154deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,150)', transform: 'rotateX(155.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,156)', transform: 'rotateX(156.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,162)', transform: 'rotateX(158.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,168)', transform: 'rotateX(159.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,174)', transform: 'rotateX(161deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,180)', transform: 'rotateX(162.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,186)', transform: 'rotateX(163.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,192)', transform: 'rotateX(165.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,198)', transform: 'rotateX(166.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,204)', transform: 'rotateX(168deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,210)', transform: 'rotateX(169.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,216)', transform: 'rotateX(170.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,222)', transform: 'rotateX(172.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,228)', transform: 'rotateX(173.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,234)', transform: 'rotateX(175deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,240)', transform: 'rotateX(176.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,246)', transform: 'rotateX(177.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,255,252)', transform: 'rotateX(179.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,252,255)', transform: 'rotateX(180.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,247,255)', transform: 'rotateX(182deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,241,255)', transform: 'rotateX(183.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,235,255)', transform: 'rotateX(184.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,229,255)', transform: 'rotateX(186.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,223,255)', transform: 'rotateX(187.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,217,255)', transform: 'rotateX(189deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,211,255)', transform: 'rotateX(190.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,205,255)', transform: 'rotateX(191.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,199,255)', transform: 'rotateX(193.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,193,255)', transform: 'rotateX(194.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,187,255)', transform: 'rotateX(196deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,181,255)', transform: 'rotateX(197.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,175,255)', transform: 'rotateX(198.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,169,255)', transform: 'rotateX(200.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,163,255)', transform: 'rotateX(201.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,157,255)', transform: 'rotateX(203deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,151,255)', transform: 'rotateX(204.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,145,255)', transform: 'rotateX(205.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,139,255)', transform: 'rotateX(207.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,133,255)', transform: 'rotateX(208.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,128,255)', transform: 'rotateX(210deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,122,255)', transform: 'rotateX(211.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,116,255)', transform: 'rotateX(212.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,110,255)', transform: 'rotateX(214.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,104,255)', transform: 'rotateX(215.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,98,255)', transform: 'rotateX(217deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,92,255)', transform: 'rotateX(218.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,86,255)', transform: 'rotateX(219.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,80,255)', transform: 'rotateX(221.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,74,255)', transform: 'rotateX(222.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,68,255)', transform: 'rotateX(224deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,62,255)', transform: 'rotateX(225.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,56,255)', transform: 'rotateX(226.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,50,255)', transform: 'rotateX(228.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,44,255)', transform: 'rotateX(229.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,38,255)', transform: 'rotateX(231deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,32,255)', transform: 'rotateX(232.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,26,255)', transform: 'rotateX(233.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,20,255)', transform: 'rotateX(235.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,14,255)', transform: 'rotateX(236.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,9,255)', transform: 'rotateX(238deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(0,3,255)', transform: 'rotateX(239.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(3,0,255)', transform: 'rotateX(240.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(9,0,255)', transform: 'rotateX(242.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(15,0,255)', transform: 'rotateX(243.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(21,0,255)', transform: 'rotateX(245deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(27,0,255)', transform: 'rotateX(246.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(33,0,255)', transform: 'rotateX(247.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(39,0,255)', transform: 'rotateX(249.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(45,0,255)', transform: 'rotateX(250.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(51,0,255)', transform: 'rotateX(252deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(57,0,255)', transform: 'rotateX(253.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(63,0,255)', transform: 'rotateX(254.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(69,0,255)', transform: 'rotateX(256.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(75,0,255)', transform: 'rotateX(257.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(81,0,255)', transform: 'rotateX(259deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(87,0,255)', transform: 'rotateX(260.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(93,0,255)', transform: 'rotateX(261.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(99,0,255)', transform: 'rotateX(263.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(105,0,255)', transform: 'rotateX(264.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(111,0,255)', transform: 'rotateX(266deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(116,0,255)', transform: 'rotateX(267.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(122,0,255)', transform: 'rotateX(268.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(128,0,255)', transform: 'rotateX(270.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(134,0,255)', transform: 'rotateX(271.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(140,0,255)', transform: 'rotateX(273deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(146,0,255)', transform: 'rotateX(274.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(152,0,255)', transform: 'rotateX(275.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(158,0,255)', transform: 'rotateX(277.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(164,0,255)', transform: 'rotateX(278.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(170,0,255)', transform: 'rotateX(280deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(176,0,255)', transform: 'rotateX(281.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(182,0,255)', transform: 'rotateX(282.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(188,0,255)', transform: 'rotateX(284.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(194,0,255)', transform: 'rotateX(285.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(200,0,255)', transform: 'rotateX(287deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(206,0,255)', transform: 'rotateX(288.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(212,0,255)', transform: 'rotateX(289.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(218,0,255)', transform: 'rotateX(291.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(224,0,255)', transform: 'rotateX(292.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(230,0,255)', transform: 'rotateX(294deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(235,0,255)', transform: 'rotateX(295.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(241,0,255)', transform: 'rotateX(296.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(247,0,255)', transform: 'rotateX(298.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(253,0,255)', transform: 'rotateX(299.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,251)', transform: 'rotateX(301deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,245)', transform: 'rotateX(302.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,239)', transform: 'rotateX(303.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,233)', transform: 'rotateX(305.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,227)', transform: 'rotateX(306.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,221)', transform: 'rotateX(308deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,215)', transform: 'rotateX(309.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,209)', transform: 'rotateX(310.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,203)', transform: 'rotateX(312.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,197)', transform: 'rotateX(313.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,191)', transform: 'rotateX(315deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,185)', transform: 'rotateX(316.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,179)', transform: 'rotateX(317.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,173)', transform: 'rotateX(319.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,167)', transform: 'rotateX(320.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,162)', transform: 'rotateX(322deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,156)', transform: 'rotateX(323.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,150)', transform: 'rotateX(324.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,144)', transform: 'rotateX(326.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,138)', transform: 'rotateX(327.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,132)', transform: 'rotateX(329deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,126)', transform: 'rotateX(330.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,120)', transform: 'rotateX(331.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,114)', transform: 'rotateX(333.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,108)', transform: 'rotateX(334.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,102)', transform: 'rotateX(336deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,96)', transform: 'rotateX(337.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,90)', transform: 'rotateX(338.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,84)', transform: 'rotateX(340.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,78)', transform: 'rotateX(341.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,72)', transform: 'rotateX(343deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,66)', transform: 'rotateX(344.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,60)', transform: 'rotateX(345.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,54)', transform: 'rotateX(347.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,48)', transform: 'rotateX(348.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,42)', transform: 'rotateX(350deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,37)', transform: 'rotateX(351.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,31)', transform: 'rotateX(352.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,25)', transform: 'rotateX(354.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,19)', transform: 'rotateX(355.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,13)', transform: 'rotateX(357deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,7)', transform: 'rotateX(358.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,0,1)', transform: 'rotateX(359.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,5,0)', transform: 'rotateX(361.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,11,0)', transform: 'rotateX(362.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,17,0)', transform: 'rotateX(364deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,23,0)', transform: 'rotateX(365.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,29,0)', transform: 'rotateX(366.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,35,0)', transform: 'rotateX(368.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,41,0)', transform: 'rotateX(369.6deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,47,0)', transform: 'rotateX(371deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,53,0)', transform: 'rotateX(372.4deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,59,0)', transform: 'rotateX(373.8deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,65,0)', transform: 'rotateX(375.2deg) translateY(-13.02vmax)' }}></div>
                            <div className="ring" style={{ color: 'rgb(255,71,0)', transform: 'rotateX(376.6deg) translateY(-13.02vmax)' }}></div>
                          </article>
                        </section>
                      </aside>
                    </section>
                  </div>
                ) : null}
              </div>

            </div>

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

        <ParticlesModal
          isOpen={particlesModalOpen}
          onClose={() => setParticlesModalOpen(false)}
          stages={modalStages}
          particlesById={particlesById}
          initialStageKey="stage1"
          title="Частицы"
          onParticleClick={({ raw, card }) => {
            // ✅ закрываем остальные модалки
            setParticlesModalOpen(false);
            setDetectorModalOpen(false);

            // ✅ открываем инфо-модалку
            setParticleInfoData(buildParticleModalData(raw, card));
            setParticleInfoOpen(true);
          }}
        />

        <Modal
          isOpen={particleInfoOpen}
          onClose={() => setParticleInfoOpen(false)}
          data={particleInfoData}
        />

        {detectorModalOpen && (
          <div
            className={s.detectorModalBackdrop}
            onMouseDown={() => setDetectorModalOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className={s.detectorModal} onMouseDown={(e) => e.stopPropagation()}>
              <div className={s.detectorModalHeader}>
                <div className={s.detectorModalTitle}>Слой детектора</div>
                <button
                  className={s.detectorModalClose}
                  onClick={() => setDetectorModalOpen(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div className={s.detectorModalBody}>
                <div><b>Детектор:</b> {detectorLayer?.detector}</div>
                <div><b>Слой:</b> {detectorLayer?.layerName}</div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}