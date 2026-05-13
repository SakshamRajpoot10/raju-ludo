/**
 * ============================================================================
 * RAJU LUDO — GAME CONSTANTS
 * ============================================================================
 * 
 * All board schemas, cell mappings, safe zones, and configuration constants.
 * This file is the single source of truth for board topology.
 * 
 * Design Principle: NO absolute coordinates. Every position is a logical ID.
 * The UI layer (Module 2) is solely responsible for translating these IDs
 * into screen coordinates.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER COLORS
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYERS = Object.freeze({
  RED: 'red',
  GREEN: 'green',
  YELLOW: 'yellow',
  BLUE: 'blue',
});

export const PLAYER_LIST = Object.freeze([
  PLAYERS.RED,
  PLAYERS.GREEN,
  PLAYERS.YELLOW,
  PLAYERS.BLUE,
]);

export const PIECES_PER_PLAYER = 4;

// ─────────────────────────────────────────────────────────────────────────────
// LUDO MAIN TRACK
// ─────────────────────────────────────────────────────────────────────────────
// The main track consists of 52 cells (cell_0 through cell_51) arranged in a
// clockwise loop. Each player enters the track at their start cell and must
// traverse exactly 51 cells on the main track before entering their home column.

export const MAIN_TRACK_LENGTH = 52;
export const HOME_COLUMN_LENGTH = 6;

// Total distance a piece must travel to finish (51 main + 6 home = 57)
export const TOTAL_DISTANCE_TO_FINISH = MAIN_TRACK_LENGTH - 1 + HOME_COLUMN_LENGTH; // 57

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
// Each player has:
//   - startCell: The cell a piece moves to when unlocked (rolled a 6)
//   - homeTurnCell: The last main-track cell before entering the home column
//   - homeColumnPrefix: Prefix for home column cell IDs
//   - starCell: The "safe star" cell unique to this player's quadrant
//   - startIndex: Numerical index of the start cell on the main track

export const PLAYER_CONFIG = Object.freeze({
  [PLAYERS.RED]: {
    startCell: 'cell_0',
    startIndex: 0,
    homeTurnCell: 'cell_50',
    homeTurnIndex: 50,
    homeColumnPrefix: 'red_home',
    starCell: 'cell_8',
    base: 'red_base',
  },
  [PLAYERS.GREEN]: {
    startCell: 'cell_13',
    startIndex: 13,
    homeTurnCell: 'cell_11',
    homeTurnIndex: 11,
    homeColumnPrefix: 'green_home',
    starCell: 'cell_21',
    base: 'green_base',
  },
  [PLAYERS.YELLOW]: {
    startCell: 'cell_26',
    startIndex: 26,
    homeTurnCell: 'cell_24',
    homeTurnIndex: 24,
    homeColumnPrefix: 'yellow_home',
    starCell: 'cell_34',
    base: 'yellow_base',
  },
  [PLAYERS.BLUE]: {
    startCell: 'cell_39',
    startIndex: 39,
    homeTurnCell: 'cell_37',
    homeTurnIndex: 37,
    homeColumnPrefix: 'blue_home',
    starCell: 'cell_47',
    base: 'blue_base',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SAFE ZONES
// ─────────────────────────────────────────────────────────────────────────────
// Pieces on these cells CANNOT be killed by opponents.
// Includes: all start cells + all star cells.

export const SAFE_CELLS = Object.freeze(new Set([
  'cell_0',   // Red start
  'cell_8',   // Red star (safe)
  'cell_13',  // Green start
  'cell_21',  // Green star (safe)
  'cell_26',  // Yellow start
  'cell_34',  // Yellow star (safe)
  'cell_39',  // Blue start
  'cell_47',  // Blue star (safe)
]));

// ─────────────────────────────────────────────────────────────────────────────
// GAME TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const GAME_TYPE = Object.freeze({
  LUDO: 'LUDO',
  SNAKE_LADDER: 'SNAKE_LADDER',
});

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const GAME_STATUS = Object.freeze({
  WAITING: 'WAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_TYPE = Object.freeze({
  ROLL_DICE: 'ROLL_DICE',
  MOVE_PIECE: 'MOVE_PIECE',
  UNLOCK_PIECE: 'UNLOCK_PIECE',
  SKIP_TURN: 'SKIP_TURN',
});

// ─────────────────────────────────────────────────────────────────────────────
// DICE
// ─────────────────────────────────────────────────────────────────────────────

export const DICE_MIN = 1;
export const DICE_MAX = 6;
export const UNLOCK_VALUE = 6;
export const MAX_CONSECUTIVE_SIXES = 3;

// ─────────────────────────────────────────────────────────────────────────────
// SNAKES & LADDERS BOARD
// ─────────────────────────────────────────────────────────────────────────────
// Classic 10×10 board with cells sl_1 through sl_100.

export const SL_BOARD_SIZE = 100;
export const SL_START = 0; // Off-board start position
export const SL_FINISH = 100;

// Snakes: { head: tail } — landing on head slides you to tail
export const SNAKES = Object.freeze({
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
});

// Ladders: { bottom: top } — landing on bottom climbs you to top
export const LADDERS = Object.freeze({
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
});

// Maximum players for Snakes & Ladders
export const SL_MAX_PLAYERS = 4;

// ─────────────────────────────────────────────────────────────────────────────
// POSITION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const POSITION = Object.freeze({
  BASE: 'base',       // Suffix — actual value is e.g. 'red_base'
  FINISHED: 'finished',
});
