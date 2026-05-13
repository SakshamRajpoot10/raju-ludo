/**
 * RAJU LUDO — PIECE RENDERER & ANIMATOR
 * Creates 3D game pieces and handles hop-by-hop GSAP animations.
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from './BoardRenderer.js';
import { getWorldPosition } from './CoordinateMap.js';

const PIECE_RADIUS = 0.22;
const PIECE_HEIGHT = 0.35;
const HOP_DURATION = 0.18;
const HOP_HEIGHT = 0.5;

/**
 * Creates a 3D game piece (pawn shape).
 * @param {string} playerColor - 'red', 'green', 'yellow', 'blue'
 * @param {number} pieceIndex - 0-3
 * @returns {THREE.Group}
 */
export function createPiece(playerColor, pieceIndex) {
  const group = new THREE.Group();
  const color = COLORS[playerColor].main;
  const lightColor = COLORS[playerColor].light;

  // Base cylinder
  const baseGeo = new THREE.CylinderGeometry(PIECE_RADIUS, PIECE_RADIUS * 1.1, 0.08, 16);
  const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.04;
  base.castShadow = true;
  group.add(base);

  // Body (tapered cylinder)
  const bodyGeo = new THREE.CylinderGeometry(PIECE_RADIUS * 0.5, PIECE_RADIUS * 0.9, PIECE_HEIGHT, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.05,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.08 + PIECE_HEIGHT / 2;
  body.castShadow = true;
  group.add(body);

  // Head (sphere)
  const headGeo = new THREE.SphereGeometry(PIECE_RADIUS * 0.55, 16, 12);
  const headMat = new THREE.MeshStandardMaterial({
    color: lightColor,
    roughness: 0.2,
    metalness: 0.4,
    emissive: lightColor,
    emissiveIntensity: 0.08,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.08 + PIECE_HEIGHT + PIECE_RADIUS * 0.3;
  head.castShadow = true;
  group.add(head);

  // Store metadata
  group.userData = {
    playerColor,
    pieceIndex,
    isAnimating: false,
  };

  return group;
}

/**
 * Animates a piece hopping along a path of cells.
 * Each hop is a visible jump to the next cell.
 * 
 * @param {THREE.Group} piece - The piece mesh group
 * @param {string[]} path - Array of cell IDs to hop through
 * @param {string} playerColor - Player color
 * @param {number} pieceIndex - Piece index (for base positioning)
 * @returns {Promise} Resolves when animation completes
 */
export function animateHopPath(piece, path, playerColor, pieceIndex) {
  return new Promise((resolve) => {
    if (!path || path.length === 0) {
      resolve();
      return;
    }

    piece.userData.isAnimating = true;
    const timeline = gsap.timeline({
      onComplete: () => {
        piece.userData.isAnimating = false;
        resolve();
      },
    });

    path.forEach((cellId, index) => {
      const target = getWorldPosition(cellId, playerColor, pieceIndex);
      if (!target) return;

      // Hop up
      timeline.to(piece.position, {
        y: target.y + HOP_HEIGHT,
        duration: HOP_DURATION * 0.4,
        ease: 'power2.out',
      }, index * HOP_DURATION);

      // Move horizontally + drop down
      timeline.to(piece.position, {
        x: target.x,
        z: target.z,
        duration: HOP_DURATION * 0.6,
        ease: 'power1.inOut',
      }, index * HOP_DURATION + HOP_DURATION * 0.2);

      timeline.to(piece.position, {
        y: target.y,
        duration: HOP_DURATION * 0.4,
        ease: 'bounce.out',
      }, index * HOP_DURATION + HOP_DURATION * 0.6);
    });
  });
}

/**
 * Animates a piece being killed (sent back to base).
 * @param {THREE.Group} piece
 * @param {string} playerColor
 * @param {number} pieceIndex
 * @returns {Promise}
 */
export function animateKill(piece, playerColor, pieceIndex) {
  return new Promise((resolve) => {
    const basePos = getWorldPosition(`${playerColor}_base`, playerColor, pieceIndex);
    if (!basePos) { resolve(); return; }

    piece.userData.isAnimating = true;

    gsap.timeline({ onComplete: () => { piece.userData.isAnimating = false; resolve(); } })
      // Spin and fly up
      .to(piece.position, { y: 2, duration: 0.3, ease: 'power2.out' })
      .to(piece.rotation, { y: Math.PI * 4, duration: 0.5, ease: 'power1.inOut' }, 0)
      // Shrink
      .to(piece.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 0.2 }, 0.1)
      // Move to base
      .to(piece.position, { x: basePos.x, z: basePos.z, duration: 0.4, ease: 'power2.inOut' }, 0.3)
      // Drop down
      .to(piece.position, { y: basePos.y, duration: 0.3, ease: 'bounce.out' }, 0.5)
      // Restore scale
      .to(piece.scale, { x: 1, y: 1, z: 1, duration: 0.2, ease: 'back.out(2)' }, 0.7);
  });
}

/**
 * Animates a piece being unlocked (base → start cell).
 * @param {THREE.Group} piece
 * @param {string} startCellId
 * @param {string} playerColor
 * @param {number} pieceIndex
 * @returns {Promise}
 */
export function animateUnlock(piece, startCellId, playerColor, pieceIndex) {
  return new Promise((resolve) => {
    const target = getWorldPosition(startCellId, playerColor, pieceIndex);
    if (!target) { resolve(); return; }

    piece.userData.isAnimating = true;

    gsap.timeline({ onComplete: () => { piece.userData.isAnimating = false; resolve(); } })
      // Pop up
      .to(piece.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.15, ease: 'back.out(3)' })
      .to(piece.position, { y: 1.2, duration: 0.25, ease: 'power2.out' }, 0)
      // Fly to start
      .to(piece.position, { x: target.x, z: target.z, duration: 0.35, ease: 'power2.inOut' }, 0.15)
      // Land
      .to(piece.position, { y: target.y, duration: 0.25, ease: 'bounce.out' }, 0.4)
      .to(piece.scale, { x: 1, y: 1, z: 1, duration: 0.15 }, 0.5);
  });
}

/**
 * Pulse glow effect to highlight selectable pieces.
 * @param {THREE.Group} piece
 * @param {boolean} active
 */
export function setHighlight(piece, active) {
  piece.traverse(child => {
    if (child.isMesh && child.material) {
      if (active) {
        child.material.emissiveIntensity = 0.3;
        if (!piece.userData._pulseAnim) {
          piece.userData._pulseAnim = gsap.to(child.material, {
            emissiveIntensity: 0.6,
            duration: 0.5,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
          });
        }
      } else {
        if (piece.userData._pulseAnim) {
          piece.userData._pulseAnim.kill();
          piece.userData._pulseAnim = null;
        }
        child.material.emissiveIntensity = 0.05;
      }
    }
  });
}
