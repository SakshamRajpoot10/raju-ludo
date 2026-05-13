/**
 * RAJU LUDO — COORDINATE MAP
 * Translates logical cell IDs (from the engine) into 2D board coordinates.
 * These coordinates are then used by Three.js to position pieces in 3D space.
 * 
 * The board is a 15×15 grid. Each cell maps to a (col, row) pair.
 * Three.js will convert (col, row) → (x, y, z) world coordinates.
 */

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TRACK COORDINATES (cell_0 through cell_51)
// ─────────────────────────────────────────────────────────────────────────────
// The Ludo board is a cross-shaped path around a 15×15 grid.
// We define each cell's position as [col, row] where (0,0) is top-left.

const MAIN_TRACK = [
  // cell_0 to cell_4: Red's column going UP (left side of top arm)
  [1, 6], [1, 5], [1, 4], [1, 3], [1, 2], [1, 1],
  // cell_5: corner turn
  // cell_6 to cell_11: Top row going RIGHT
  [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
  // cell_11: corner right of top
  [6, 1],
  // cell_12: entering right column
  [6, 2],
  // cell_13 to cell_17: Green's column going DOWN (top of right arm)
  [6, 3], [6, 4], [6, 5],
  // Actually let me redo this properly as the standard Ludo track

  // I need to be very precise. Let me map the standard 52-cell track.
];

// Better approach: Define the track procedurally based on the standard Ludo layout
// The 15×15 grid has a cross-shaped path. Let me define each of the 52 cells.

export const CELL_COORDINATES = {};

// The standard Ludo board track (52 cells) mapped to a 15×15 grid
// Starting from Red's start (cell_0) going clockwise

const trackPositions = [
  // Red start zone → upward (cells 0-5)
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  // Turn up into top arm (cells 5-10) 
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  // Turn right across top (cells 11-12)
  [7, 0], [8, 0],
  // Green start zone → downward (cells 13-18)
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  // Turn right into right arm (cells 18-23)
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  // Turn down (cells 24-25)
  [14, 7], [14, 8],
  // Yellow start zone → leftward (cells 26-31)
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  // Turn down into bottom arm (cells 31-36)
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  // Turn left across bottom (cells 37-38)
  [7, 14], [6, 14],
  // Blue start zone → upward (cells 39-44)
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  // Turn left into left arm (cells 44-49)
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  // Turn up (cells 50-51)
  [0, 7], [0, 6],
];

// Map cell IDs to coordinates
trackPositions.forEach((pos, index) => {
  CELL_COORDINATES[`cell_${index}`] = { col: pos[0], row: pos[1] };
});

// ─────────────────────────────────────────────────────────────────────────────
// HOME COLUMNS (6 cells each, leading to center)
// ─────────────────────────────────────────────────────────────────────────────

const homeColumns = {
  red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
};

for (const [player, cells] of Object.entries(homeColumns)) {
  cells.forEach((pos, index) => {
    CELL_COORDINATES[`${player}_home_${index}`] = { col: pos[0], row: pos[1] };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE (YARD) POSITIONS — 4 pieces per base
// ─────────────────────────────────────────────────────────────────────────────

// Base piece positions must match the slot circles rendered in BoardRenderer.
// BoardRenderer places bases at: offset = BOARD_SIZE/2 - baseSize/2 - 0.15
// where baseSize = 5.5 * CELL, CELL = BOARD_SIZE/15.
// We reverse-engineer the grid coordinates from the renderer's world positions.
//
// BOARD_SIZE = 14, CELL = 14/15 ≈ 0.9333
// baseSize = 5.5 * 0.9333 = 5.1333
// offset = 7 - 2.5667 - 0.15 = 4.2833
// Renderer slot circles are at base_center ± (CELL * 0.8) in world space.
// CELL * 0.8 = 0.7467 world units
//
// To convert from world X to grid col: col = (worldX + halfBoard) / cellSize - 0.5
// We get the base center grid coord from: (halfBoard - offset) / cellSize - 0.5
//   = (7 - 4.2833) / 0.9333 - 0.5 = 2.911 - 0.5 = 2.411
// And the slot offset in grid = 0.8 (as used by renderer)
//
// For the far side: (halfBoard + offset) / cellSize - 0.5
//   = (7 + 4.2833) / 0.9333 - 0.5 = 12.089 - 0.5 = 11.589

const BC = 2.411; // base center grid coord for near side
const BF = 11.589; // base center grid coord for far side
const SO = 0.8; // slot offset in grid units

export const BASE_COORDINATES = {
  red: [
    { col: BC - SO, row: BC - SO }, { col: BC + SO, row: BC - SO },
    { col: BC - SO, row: BC + SO }, { col: BC + SO, row: BC + SO },
  ],
  green: [
    { col: BF - SO, row: BC - SO }, { col: BF + SO, row: BC - SO },
    { col: BF - SO, row: BC + SO }, { col: BF + SO, row: BC + SO },
  ],
  yellow: [
    { col: BF - SO, row: BF - SO }, { col: BF + SO, row: BF - SO },
    { col: BF - SO, row: BF + SO }, { col: BF + SO, row: BF + SO },
  ],
  blue: [
    { col: BC - SO, row: BF - SO }, { col: BC + SO, row: BF - SO },
    { col: BC - SO, row: BF + SO }, { col: BC + SO, row: BF + SO },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FINISHED POSITION (center of board)
// ─────────────────────────────────────────────────────────────────────────────

export const FINISHED_COORDINATE = { col: 7, row: 7 };

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE CONVERTER
// ─────────────────────────────────────────────────────────────────────────────

const BOARD_GRID_SIZE = 15;

/**
 * Converts a grid coordinate (col, row) to world position (x, y, z).
 * @param {number} col - Column (0-14)
 * @param {number} row - Row (0-14)
 * @param {number} boardSize - Total board size in world units
 * @returns {{ x: number, y: number, z: number }}
 */
export function gridToWorld(col, row, boardSize = 14) {
  const cellSize = boardSize / BOARD_GRID_SIZE;
  const halfBoard = boardSize / 2;
  return {
    x: (col * cellSize) - halfBoard + (cellSize / 2),
    y: 0.15, // Slightly above board surface
    z: (row * cellSize) - halfBoard + (cellSize / 2),
  };
}

/**
 * Gets the world position for a logical cell ID.
 * @param {string} cellId - e.g. 'cell_13', 'red_home_3', 'red_base'
 * @param {string} player - Player color (needed for base positions)
 * @param {number} pieceIndex - Piece index (needed for base offset)
 * @param {number} boardSize - Board world size
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function getWorldPosition(cellId, player = null, pieceIndex = 0, boardSize = 14) {
  // Finished
  if (cellId === 'finished') {
    const pos = gridToWorld(FINISHED_COORDINATE.col, FINISHED_COORDINATE.row, boardSize);
    // Offset finished pieces slightly so they don't stack
    const angle = (pieceIndex / 4) * Math.PI * 2;
    pos.x += Math.cos(angle) * 0.2;
    pos.z += Math.sin(angle) * 0.2;
    pos.y = 0.2;
    return pos;
  }

  // Base
  if (cellId && cellId.endsWith('_base') && player) {
    const basePos = BASE_COORDINATES[player];
    if (basePos && basePos[pieceIndex]) {
      return gridToWorld(basePos[pieceIndex].col, basePos[pieceIndex].row, boardSize);
    }
  }

  // Main track or home column
  const coord = CELL_COORDINATES[cellId];
  if (coord) {
    return gridToWorld(coord.col, coord.row, boardSize);
  }

  return null;
}

/**
 * Gets the board grid size.
 */
export function getBoardGridSize() {
  return BOARD_GRID_SIZE;
}
