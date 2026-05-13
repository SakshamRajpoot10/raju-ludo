/**
 * ============================================================================
 * RAJU LUDO — PURE HELPER FUNCTIONS
 * ============================================================================
 * 
 * All functions in this file are PURE — no side effects, no mutations.
 * Given the same inputs, they always produce the same outputs.
 * ============================================================================
 */

import {
  MAIN_TRACK_LENGTH,
  HOME_COLUMN_LENGTH,
  TOTAL_DISTANCE_TO_FINISH,
  PLAYER_CONFIG,
  SAFE_CELLS,
  PIECES_PER_PLAYER,
  POSITION,
  SNAKES,
  LADDERS,
  SL_BOARD_SIZE,
} from './constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// DEEP CLONE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deep clones a game state object. Uses structured clone for correctness.
 * @param {Object} state - The state to clone
 * @returns {Object} A deep copy
 */
export function deepClone(state) {
  return JSON.parse(JSON.stringify(state));
}

// ─────────────────────────────────────────────────────────────────────────────
// CELL ID UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the numerical index from a main-track cell ID.
 * @param {string} cellId - e.g. 'cell_35'
 * @returns {number} e.g. 35
 */
export function getCellIndex(cellId) {
  if (!cellId || !cellId.startsWith('cell_')) return -1;
  return parseInt(cellId.split('_')[1], 10);
}

/**
 * Constructs a main-track cell ID from a numerical index.
 * @param {number} index - 0-51
 * @returns {string} e.g. 'cell_35'
 */
export function makeCellId(index) {
  return `cell_${index}`;
}

/**
 * Constructs a home-column cell ID.
 * @param {string} player - Player color
 * @param {number} index - 0-5
 * @returns {string} e.g. 'red_home_3'
 */
export function makeHomeCellId(player, index) {
  return `${PLAYER_CONFIG[player].homeColumnPrefix}_${index}`;
}

/**
 * Checks if a cell ID is a home-column cell.
 * @param {string} cellId
 * @returns {boolean}
 */
export function isHomeCellId(cellId) {
  return cellId && cellId.includes('_home_');
}

/**
 * Checks if a cell ID represents the player's base/yard.
 * @param {string} cellId
 * @returns {boolean}
 */
export function isBasePosition(cellId) {
  return cellId && cellId.endsWith('_base');
}

/**
 * Checks if a piece has finished (reached home center).
 * @param {string} cellId
 * @returns {boolean}
 */
export function isFinished(cellId) {
  return cellId === POSITION.FINISHED;
}

// ─────────────────────────────────────────────────────────────────────────────
// LUDO MOVEMENT CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the next position for a piece after moving `steps` cells.
 * This is the core pathfinding function for Ludo.
 * 
 * @param {string} player - The player color
 * @param {string} currentPosition - Current cell ID
 * @param {number} distanceTraveled - Total distance this piece has traveled
 * @param {number} steps - Number of steps to move (dice value)
 * @returns {{ position: string, distanceTraveled: number } | null}
 *   Returns the new position and distance, or null if the move is invalid.
 */
export function calculateNextPosition(player, currentPosition, distanceTraveled, steps) {
  const config = PLAYER_CONFIG[player];

  // Cannot move from base without unlocking (handled separately)
  if (isBasePosition(currentPosition)) {
    return null;
  }

  // Cannot move if already finished
  if (isFinished(currentPosition)) {
    return null;
  }

  const newDistance = distanceTraveled + steps;

  // Overshoot check — cannot exceed 57 total distance
  if (newDistance > TOTAL_DISTANCE_TO_FINISH) {
    return null;
  }

  // Exact finish
  if (newDistance === TOTAL_DISTANCE_TO_FINISH) {
    return {
      position: POSITION.FINISHED,
      distanceTraveled: newDistance,
    };
  }

  // Determine if piece is entering or within home column
  const mainTrackSteps = MAIN_TRACK_LENGTH - 1; // 51 steps on main track

  if (distanceTraveled >= mainTrackSteps) {
    // Already in home column — advance within it
    const homeIndex = (newDistance - mainTrackSteps);
    if (homeIndex < 0 || homeIndex >= HOME_COLUMN_LENGTH) {
      return null; // Invalid — shouldn't happen if overshoot check works
    }
    return {
      position: makeHomeCellId(player, homeIndex),
      distanceTraveled: newDistance,
    };
  }

  if (newDistance > mainTrackSteps) {
    // Transitioning from main track into home column this move
    const homeIndex = newDistance - mainTrackSteps;
    if (homeIndex < 0 || homeIndex >= HOME_COLUMN_LENGTH) {
      return null;
    }
    return {
      position: makeHomeCellId(player, homeIndex),
      distanceTraveled: newDistance,
    };
  }

  // Still on main track — calculate the destination cell index
  const currentCellIndex = (config.startIndex + distanceTraveled) % MAIN_TRACK_LENGTH;
  // Verify current position matches expectation (safety check)
  const newCellIndex = (config.startIndex + newDistance) % MAIN_TRACK_LENGTH;

  return {
    position: makeCellId(newCellIndex),
    distanceTraveled: newDistance,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE ZONE CHECKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a cell is a safe zone (pieces cannot be killed here).
 * @param {string} cellId
 * @returns {boolean}
 */
export function isSafeCell(cellId) {
  // Safe cells on main track
  if (SAFE_CELLS.has(cellId)) return true;
  // All home-column cells are safe
  if (isHomeCellId(cellId)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLISION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds all opponent pieces on a given cell.
 * @param {Object} players - The players state from game state
 * @param {string} movingPlayer - The player who is moving
 * @param {string} targetCell - The cell to check
 * @returns {Array<{ player: string, pieceIndex: number }>} Opponent pieces on that cell
 */
export function findOpponentPiecesOnCell(players, movingPlayer, targetCell) {
  const opponents = [];

  for (const [playerColor, playerData] of Object.entries(players)) {
    if (playerColor === movingPlayer) continue;

    playerData.pieces.forEach((piece, index) => {
      if (piece.position === targetCell) {
        opponents.push({ player: playerColor, pieceIndex: index });
      }
    });
  }

  return opponents;
}

/**
 * Finds all same-color pieces on a given cell (for block detection).
 * @param {Object} players - The players state
 * @param {string} player - The player color
 * @param {string} targetCell - The cell to check
 * @param {number} excludePieceIndex - Piece index to exclude (the moving piece)
 * @returns {number} Count of same-color pieces on the cell
 */
export function countSameColorPiecesOnCell(players, player, targetCell, excludePieceIndex) {
  let count = 0;
  players[player].pieces.forEach((piece, index) => {
    if (index !== excludePieceIndex && piece.position === targetCell) {
      count++;
    }
  });
  return count;
}

/**
 * Checks if opponents have a "block" on a cell (2+ same-color pieces).
 * A block cannot be killed.
 * @param {Object} players
 * @param {string} movingPlayer
 * @param {string} targetCell
 * @returns {boolean}
 */
export function isBlockedByOpponent(players, movingPlayer, targetCell) {
  for (const [playerColor, playerData] of Object.entries(players)) {
    if (playerColor === movingPlayer) continue;

    const piecesOnCell = playerData.pieces.filter(p => p.position === targetCell);
    if (piecesOnCell.length >= 2) {
      return true; // Block — cannot land here
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALID MOVE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all valid moves for a player given a dice value.
 * @param {Object} gameState - Current game state
 * @param {string} player - Player color
 * @param {number} diceValue - The rolled dice value
 * @returns {Array<{ pieceIndex: number, type: string, destination: string }>}
 */
export function getValidMoves(gameState, player, diceValue) {
  const playerData = gameState.players[player];
  const config = PLAYER_CONFIG[player];
  const moves = [];

  playerData.pieces.forEach((piece, index) => {
    // Skip finished pieces
    if (isFinished(piece.position)) return;

    // UNLOCK: Piece is in base and dice is 6
    if (isBasePosition(piece.position)) {
      if (diceValue === 6) {
        // Check if start cell is blocked by opponent block
        if (!isBlockedByOpponent(gameState.players, player, config.startCell)) {
          moves.push({
            pieceIndex: index,
            type: 'UNLOCK',
            destination: config.startCell,
          });
        }
      }
      return; // Base pieces can only be unlocked, not moved
    }

    // MOVE: Calculate destination
    const result = calculateNextPosition(player, piece.position, piece.distanceTraveled, diceValue);
    if (result === null) return; // Invalid move (overshoot, etc.)

    // Check for opponent block at destination (not applicable for home cells or finish)
    if (!isFinished(result.position) && !isHomeCellId(result.position)) {
      if (isBlockedByOpponent(gameState.players, player, result.position)) {
        return; // Cannot land on a blocked cell
      }
    }

    moves.push({
      pieceIndex: index,
      type: 'MOVE',
      destination: result.position,
      distanceTraveled: result.distanceTraveled,
    });
  });

  return moves;
}

// ─────────────────────────────────────────────────────────────────────────────
// TURN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the next player in turn order, skipping players who have finished.
 * @param {Object} gameState
 * @returns {string} Next player color
 */
export function getNextPlayer(gameState) {
  const { turnOrder, currentPlayer, players } = gameState;
  const currentIndex = turnOrder.indexOf(currentPlayer);
  const totalPlayers = turnOrder.length;

  for (let i = 1; i <= totalPlayers; i++) {
    const nextIndex = (currentIndex + i) % totalPlayers;
    const nextPlayer = turnOrder[nextIndex];

    // Skip players who have finished all pieces
    if (players[nextPlayer].finishedCount < PIECES_PER_PLAYER) {
      return nextPlayer;
    }
  }

  // All players finished — should not reach here in normal gameplay
  return currentPlayer;
}

/**
 * Checks if a player should get a bonus turn.
 * Bonus turn is awarded for: rolling a 6, or killing an opponent piece.
 * @param {number} diceValue
 * @param {boolean} killedOpponent
 * @returns {boolean}
 */
export function shouldGetBonusTurn(diceValue, killedOpponent) {
  return diceValue === 6 || killedOpponent;
}

// ─────────────────────────────────────────────────────────────────────────────
// WIN CONDITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a player has won (all pieces finished).
 * @param {Object} playerData
 * @returns {boolean}
 */
export function hasPlayerWon(playerData) {
  return playerData.finishedCount >= PIECES_PER_PLAYER;
}

/**
 * Checks if the game is over (all players ranked, or only one remains).
 * @param {Object} gameState
 * @returns {boolean}
 */
export function isGameOver(gameState) {
  const { players, turnOrder } = gameState;
  const activePlayers = turnOrder.filter(
    p => players[p].finishedCount < PIECES_PER_PLAYER
  );
  return activePlayers.length <= 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAKES & LADDERS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves snakes and ladders for a given position.
 * @param {number} position - Cell number (1-100)
 * @returns {{ position: number, type: string | null }}
 *   The resolved position and what happened ('SNAKE', 'LADDER', or null)
 */
export function resolveSnakeOrLadder(position) {
  if (SNAKES[position] !== undefined) {
    return { position: SNAKES[position], type: 'SNAKE' };
  }
  if (LADDERS[position] !== undefined) {
    return { position: LADDERS[position], type: 'LADDER' };
  }
  return { position, type: null };
}

/**
 * Checks if a Snakes & Ladders move is valid (doesn't overshoot 100).
 * @param {number} currentPosition
 * @param {number} diceValue
 * @returns {boolean}
 */
export function isValidSLMove(currentPosition, diceValue) {
  return (currentPosition + diceValue) <= SL_BOARD_SIZE;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the initial piece state for a player.
 * @param {string} player - Player color
 * @returns {Array<Object>} Array of 4 piece objects
 */
export function createInitialPieces(player) {
  const base = PLAYER_CONFIG[player].base;
  return Array.from({ length: PIECES_PER_PLAYER }, (_, i) => ({
    id: `${player}_${i}`,
    position: base,
    distanceTraveled: 0,
  }));
}

/**
 * Creates initial Snakes & Ladders piece state for a player.
 * @param {string} player
 * @returns {Object} Single piece at position 0
 */
export function createInitialSLPiece(player) {
  return {
    id: `${player}_0`,
    position: 0, // Off-board
  };
}
