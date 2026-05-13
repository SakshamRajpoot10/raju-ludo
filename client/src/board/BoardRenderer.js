/**
 * RAJU LUDO — THREE.JS BOARD RENDERER
 * Creates the 3D Ludo board with proper cell coloring, grid lines,
 * safe zone markers, home triangles, and base yards.
 */

import * as THREE from 'three';
import { CELL_COORDINATES, BASE_COORDINATES, gridToWorld } from './CoordinateMap.js';
import { SAFE_CELLS } from '../engine/constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// COLOR PALETTE
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  red: { main: 0xD32F2F, light: 0xFF5252, dark: 0xB71C1C, homeTrail: 0xE57373 },
  green: { main: 0x2E7D32, light: 0x4CAF50, dark: 0x1B5E20, homeTrail: 0x81C784 },
  yellow: { main: 0xF9A825, light: 0xFFD54F, dark: 0xF57F17, homeTrail: 0xFFE082 },
  blue: { main: 0x1565C0, light: 0x42A5F5, dark: 0x0D47A1, homeTrail: 0x64B5F6 },
  board: 0xF5E6CA,
  boardEdge: 0x4E342E,
  safeCell: 0xFFD600,
  trackCell: 0xFFF8E1,
  gridLine: 0xBCAAA4,
  center: 0x263238,
  white: 0xFFFDF7,
};

const BOARD_SIZE = 14;
const GRID = 15;
const CELL = BOARD_SIZE / GRID;

/**
 * Creates the complete 3D Ludo board.
 * @returns {THREE.Group} The board group to add to the scene
 */
export function createBoard() {
  const group = new THREE.Group();

  // Base board plane
  const boardGeo = new THREE.BoxGeometry(BOARD_SIZE + 0.4, 0.2, BOARD_SIZE + 0.4);
  const boardMat = new THREE.MeshStandardMaterial({
    color: COLORS.board,
    roughness: 0.3,
    metalness: 0.05,
  });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = -0.1;
  board.receiveShadow = true;
  group.add(board);

  // Board edge/frame
  const frameMat = new THREE.MeshStandardMaterial({
    color: COLORS.boardEdge,
    roughness: 0.6,
    metalness: 0.1,
  });
  const frameThickness = 0.15;
  const frameHeight = 0.35;
  const outerSize = BOARD_SIZE + 0.6;

  // Four frame sides
  [
    { w: outerSize, d: frameThickness, x: 0, z: -(outerSize / 2) },
    { w: outerSize, d: frameThickness, x: 0, z: (outerSize / 2) },
    { w: frameThickness, d: outerSize, x: -(outerSize / 2), z: 0 },
    { w: frameThickness, d: outerSize, x: (outerSize / 2), z: 0 },
  ].forEach(({ w, d, x, z }) => {
    const geo = new THREE.BoxGeometry(w, frameHeight, d);
    const mesh = new THREE.Mesh(geo, frameMat);
    mesh.position.set(x, frameHeight / 2 - 0.2, z);
    mesh.castShadow = true;
    group.add(mesh);
  });

  // Grid lines
  addGridLines(group);

  // Player bases (yards)
  addPlayerBases(group);

  // Track cells
  addTrackCells(group);

  // Home columns
  addHomeColumns(group);

  // Center home triangle
  addCenterHome(group);

  // Safe zone stars
  addSafeMarkers(group);

  return group;
}

function addGridLines(group) {
  const lineMat = new THREE.LineBasicMaterial({ color: COLORS.gridLine, transparent: true, opacity: 0.3 });
  const halfBoard = BOARD_SIZE / 2;

  for (let i = 0; i <= GRID; i++) {
    const pos = -halfBoard + i * CELL;

    // Horizontal
    const hGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfBoard, 0.01, pos),
      new THREE.Vector3(halfBoard, 0.01, pos),
    ]);
    group.add(new THREE.Line(hGeo, lineMat));

    // Vertical
    const vGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pos, 0.01, -halfBoard),
      new THREE.Vector3(pos, 0.01, halfBoard),
    ]);
    group.add(new THREE.Line(vGeo, lineMat));
  }
}

function addPlayerBases(group) {
  const baseSize = 5.5 * CELL;
  const offset = BOARD_SIZE / 2 - baseSize / 2 - 0.15;

  const bases = [
    { color: COLORS.red.main, x: -offset, z: -offset },
    { color: COLORS.green.main, x: offset, z: -offset },
    { color: COLORS.yellow.main, x: offset, z: offset },
    { color: COLORS.blue.main, x: -offset, z: offset },
  ];

  bases.forEach(({ color, x, z }) => {
    // Base background
    const geo = new THREE.BoxGeometry(baseSize, 0.08, baseSize);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.15,
      transparent: true,
      opacity: 0.7,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.04, z);
    group.add(mesh);

    // Inner white circle area for pieces
    const innerSize = baseSize * 0.65;
    const innerGeo = new THREE.BoxGeometry(innerSize, 0.09, innerSize);
    const innerMat = new THREE.MeshStandardMaterial({
      color: COLORS.white,
      roughness: 0.3,
      metalness: 0.05,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(x, 0.05, z);
    group.add(inner);

    // Piece slots (circles)
    const slotGeo = new THREE.CylinderGeometry(CELL * 0.35, CELL * 0.35, 0.02, 16);
    const slotMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const slotOffsets = [
      [-CELL * 0.8, -CELL * 0.8], [CELL * 0.8, -CELL * 0.8],
      [-CELL * 0.8, CELL * 0.8], [CELL * 0.8, CELL * 0.8],
    ];
    slotOffsets.forEach(([dx, dz]) => {
      const slot = new THREE.Mesh(slotGeo, slotMat);
      slot.position.set(x + dx, 0.1, z + dz);
      group.add(slot);
    });
  });
}

function addTrackCells(group) {
  const cellGeo = new THREE.BoxGeometry(CELL * 0.92, 0.06, CELL * 0.92);
  const trackMat = new THREE.MeshStandardMaterial({
    color: COLORS.trackCell,
    roughness: 0.4,
    metalness: 0.05,
  });

  for (const [cellId, coord] of Object.entries(CELL_COORDINATES)) {
    if (cellId.includes('_home_')) continue; // Home columns handled separately
    const pos = gridToWorld(coord.col, coord.row, BOARD_SIZE);
    const cell = new THREE.Mesh(cellGeo, trackMat.clone());
    cell.position.set(pos.x, 0.03, pos.z);
    cell.receiveShadow = true;
    cell.userData = { cellId };
    group.add(cell);
  }
}

function addHomeColumns(group) {
  const cellGeo = new THREE.BoxGeometry(CELL * 0.92, 0.06, CELL * 0.92);
  const players = ['red', 'green', 'yellow', 'blue'];

  players.forEach(player => {
    for (let i = 0; i < 6; i++) {
      const cellId = `${player}_home_${i}`;
      const coord = CELL_COORDINATES[cellId];
      if (!coord) continue;
      const pos = gridToWorld(coord.col, coord.row, BOARD_SIZE);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS[player].homeTrail,
        roughness: 0.3,
        metalness: 0.1,
      });
      const cell = new THREE.Mesh(cellGeo, mat);
      cell.position.set(pos.x, 0.03, pos.z);
      cell.userData = { cellId };
      group.add(cell);
    }
  });
}

function addCenterHome(group) {
  // Premium Ludo King-style center: 4 colored triangles forming a pinwheel.
  // Each triangle tip meets at the center, base along the side where the home lane enters.
  // Shape XY plane → rotated to world XZ (X→worldX, Y→world -Z).
  const centerSize = 3 * CELL;
  const h = centerSize / 2;

  // White base platform (slightly larger, sits underneath for clean contrast)
  const basePlatGeo = new THREE.BoxGeometry(centerSize + 0.08, 0.06, centerSize + 0.08);
  const basePlatMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e8,
    roughness: 0.25,
    metalness: 0.05,
  });
  const basePlat = new THREE.Mesh(basePlatGeo, basePlatMat);
  basePlat.position.set(0, 0.03, 0);
  group.add(basePlat);

  // 4 triangles — each tip at center (0,0), base along its side
  const triangles = [
    // Red: LEFT — base on left edge, tip at center
    { color: COLORS.red.main, verts: [[0, 0], [-h, h], [-h, -h]] },
    // Green: TOP — base on top edge (world -Z = shape +Y), tip at center
    { color: COLORS.green.main, verts: [[0, 0], [h, h], [-h, h]] },
    // Yellow: RIGHT — base on right edge, tip at center
    { color: COLORS.yellow.main, verts: [[0, 0], [h, -h], [h, h]] },
    // Blue: BOTTOM — base on bottom edge (world +Z = shape -Y), tip at center
    { color: COLORS.blue.main, verts: [[0, 0], [-h, -h], [h, -h]] },
  ];

  triangles.forEach(({ color, verts }) => {
    const shape = new THREE.Shape();
    shape.moveTo(verts[0][0], verts[0][1]);
    shape.lineTo(verts[1][0], verts[1][1]);
    shape.lineTo(verts[2][0], verts[2][1]);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.2,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.06;
    group.add(mesh);
  });

  // Thin white cross lines between the triangles (diagonal separators)
  const lineThickness = 0.04;
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.05 });

  // Horizontal line (left-right)
  const hLineGeo = new THREE.BoxGeometry(centerSize, 0.12, lineThickness);
  const hLine = new THREE.Mesh(hLineGeo, lineMat);
  hLine.position.set(0, 0.12, 0);
  group.add(hLine);

  // Vertical line (top-bottom)
  const vLineGeo = new THREE.BoxGeometry(lineThickness, 0.12, centerSize);
  const vLine = new THREE.Mesh(vLineGeo, lineMat);
  vLine.position.set(0, 0.12, 0);
  group.add(vLine);

  // Golden center jewel/circle
  const jewelGeo = new THREE.CylinderGeometry(CELL * 0.22, CELL * 0.22, 0.14, 24);
  const jewelMat = new THREE.MeshStandardMaterial({
    color: 0xFFD700,
    roughness: 0.15,
    metalness: 0.6,
    emissive: 0x443300,
    emissiveIntensity: 0.2,
  });
  const jewel = new THREE.Mesh(jewelGeo, jewelMat);
  jewel.position.set(0, 0.17, 0);
  group.add(jewel);
}

function addSafeMarkers(group) {
  const starGeo = createStarGeometry(CELL * 0.3, CELL * 0.15, 5, 0.03);

  SAFE_CELLS.forEach(cellId => {
    const coord = CELL_COORDINATES[cellId];
    if (!coord) return;
    const pos = gridToWorld(coord.col, coord.row, BOARD_SIZE);

    // Determine color based on which player's start/star this is
    let color = COLORS.safeCell;
    for (const [player, config] of Object.entries({
      red: { start: 'cell_0', star: 'cell_8' },
      green: { start: 'cell_13', star: 'cell_21' },
      yellow: { start: 'cell_26', star: 'cell_34' },
      blue: { start: 'cell_39', star: 'cell_47' },
    })) {
      if (cellId === config.start || cellId === config.star) {
        color = COLORS[player].main;
        break;
      }
    }

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
    const star = new THREE.Mesh(starGeo, mat);
    star.position.set(pos.x, 0.08, pos.z);
    star.rotation.x = -Math.PI / 2;
    group.add(star);
  });
}

function createStarGeometry(outerRadius, innerRadius, points, depth) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}
