/**
 * RAJU LUDO — AI BOT ENGINE
 * Three difficulty levels for single-player and filling empty slots.
 * 
 * Easy:   Random valid move
 * Medium: Balanced — prefers unlocking, killing, and moving forward
 * Hard:   Aggressive — prioritizes kills, home entry, and blocking
 */

import { getValidMoves, isBasePosition, isFinished, isSafeCell, findOpponentPiecesOnCell, calculateNextPosition } from '../engine/helpers.js';
import { PLAYER_CONFIG, PIECES_PER_PLAYER } from '../engine/constants.js';

/**
 * Calculates the best move for a bot player.
 * @param {Object} gameState - Current game state
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {number | null} Piece index to move, or null if no valid moves
 */
export function calculateBestMove(gameState, difficulty = 'medium') {
  const player = gameState.currentPlayer;
  const diceValue = gameState.diceValue;
  const validMoves = getValidMoves(gameState, player, diceValue);

  if (validMoves.length === 0) return null;
  if (validMoves.length === 1) return validMoves[0].pieceIndex;

  switch (difficulty) {
    case 'easy':
      return easyBot(validMoves);
    case 'medium':
      return mediumBot(gameState, player, diceValue, validMoves);
    case 'hard':
      return hardBot(gameState, player, diceValue, validMoves);
    default:
      return mediumBot(gameState, player, diceValue, validMoves);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EASY BOT — Pure random
// ─────────────────────────────────────────────────────────────────────────────

function easyBot(validMoves) {
  const idx = Math.floor(Math.random() * validMoves.length);
  return validMoves[idx].pieceIndex;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIUM BOT — Balanced scoring
// ─────────────────────────────────────────────────────────────────────────────

function mediumBot(gameState, player, diceValue, validMoves) {
  const scored = validMoves.map(move => ({
    ...move,
    score: scoreMoveBalanced(gameState, player, diceValue, move),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].pieceIndex;
}

function scoreMoveBalanced(gameState, player, diceValue, move) {
  let score = 0;
  const piece = gameState.players[player].pieces[move.pieceIndex];

  // Unlock bonus (get pieces out of base)
  if (move.type === 'UNLOCK') {
    const piecesInBase = gameState.players[player].pieces.filter(p => isBasePosition(p.position)).length;
    score += 40 + (piecesInBase === 4 ? 20 : 0); // Prioritize first unlock
    return score;
  }

  // Finishing bonus
  if (move.destination === 'finished') {
    score += 100;
    return score;
  }

  // Kill check
  if (!isSafeCell(move.destination) && !move.destination.includes('_home_')) {
    const opponents = findOpponentPiecesOnCell(gameState.players, player, move.destination);
    const singleOpponents = opponents.filter(opp => {
      const oppPieces = gameState.players[opp.player].pieces.filter(p => p.position === move.destination);
      return oppPieces.length === 1;
    });
    if (singleOpponents.length > 0) {
      score += 60; // Kill is very valuable
    }
  }

  // Moving into home column
  if (move.destination.includes('_home_')) {
    score += 30;
  }

  // Moving to safe cell
  if (isSafeCell(move.destination)) {
    score += 15;
  }

  // Distance advancement (small bonus for progress)
  score += (move.distanceTraveled || piece.distanceTraveled + diceValue) * 0.5;

  // Escape danger — if current position is unsafe and close to opponents
  if (!isSafeCell(piece.position) && !piece.position.includes('_home_')) {
    score += 10;
  }

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD BOT — Aggressive & Strategic
// ─────────────────────────────────────────────────────────────────────────────

function hardBot(gameState, player, diceValue, validMoves) {
  const scored = validMoves.map(move => ({
    ...move,
    score: scoreMoveAggressive(gameState, player, diceValue, move),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Add slight randomness to top picks to avoid being fully predictable
  const topScore = scored[0].score;
  const topMoves = scored.filter(m => m.score >= topScore - 5);
  const pick = topMoves[Math.floor(Math.random() * topMoves.length)];
  return pick.pieceIndex;
}

function scoreMoveAggressive(gameState, player, diceValue, move) {
  let score = 0;
  const piece = gameState.players[player].pieces[move.pieceIndex];
  const config = PLAYER_CONFIG[player];

  // PRIORITY 1: Finish pieces (highest value)
  if (move.destination === 'finished') {
    score += 200;
    // Extra bonus if this would be the winning piece
    if (gameState.players[player].finishedCount === PIECES_PER_PLAYER - 1) {
      score += 500; // WIN THE GAME!
    }
    return score;
  }

  // PRIORITY 2: Kill opponent pieces
  if (!isSafeCell(move.destination) && !move.destination.includes('_home_')) {
    const opponents = findOpponentPiecesOnCell(gameState.players, player, move.destination);
    const singleOpponents = opponents.filter(opp => {
      const oppPieces = gameState.players[opp.player].pieces.filter(p => p.position === move.destination);
      return oppPieces.length === 1;
    });
    if (singleOpponents.length > 0) {
      score += 150;
      // Extra value for killing pieces that are far advanced
      for (const opp of singleOpponents) {
        const oppPiece = gameState.players[opp.player].pieces[opp.pieceIndex];
        score += oppPiece.distanceTraveled * 1.5; // More advanced = more valuable kill
      }
    }
  }

  // PRIORITY 3: Enter home column (safe progress)
  if (move.destination.includes('_home_')) {
    score += 80;
    // Closer to finish = higher value
    const homeIdx = parseInt(move.destination.split('_').pop());
    score += homeIdx * 10;
  }

  // PRIORITY 4: Unlock pieces strategically
  if (move.type === 'UNLOCK') {
    const piecesOnBoard = gameState.players[player].pieces.filter(
      p => !isBasePosition(p.position) && !isFinished(p.position)
    ).length;

    if (piecesOnBoard === 0) {
      score += 100; // Must unlock when none on board
    } else if (piecesOnBoard === 1) {
      score += 50; // Good to have backup
    } else {
      score += 25; // Already have pieces out
    }
    return score;
  }

  // PRIORITY 5: Move to safe cell when in danger
  if (isSafeCell(move.destination)) {
    score += 20;
    // Extra value if current position is unsafe and opponents are nearby
    if (!isSafeCell(piece.position)) {
      if (isInDanger(gameState, player, piece)) {
        score += 40;
      }
    }
  }

  // PRIORITY 6: Advance most-forward piece (race strategy)
  score += piece.distanceTraveled * 0.8;

  // PENALTY: Leaving a safe cell to an unsafe one
  if (isSafeCell(piece.position) && !isSafeCell(move.destination) && !move.destination.includes('_home_')) {
    score -= 10;
  }

  // BONUS: Block opponent (place 2+ pieces on same cell)
  const samePiecesOnDest = gameState.players[player].pieces.filter(
    (p, idx) => idx !== move.pieceIndex && p.position === move.destination
  ).length;
  if (samePiecesOnDest >= 1 && !move.destination.includes('_home_')) {
    score += 25; // Creating a block
  }

  return score;
}

/**
 * Checks if a piece is in danger (opponent could reach it in 1-6 rolls).
 */
function isInDanger(gameState, player, piece) {
  if (isSafeCell(piece.position) || piece.position.includes('_home_')) return false;

  for (const [oppColor, oppData] of Object.entries(gameState.players)) {
    if (oppColor === player) continue;

    for (const oppPiece of oppData.pieces) {
      if (isBasePosition(oppPiece.position) || isFinished(oppPiece.position)) continue;

      // Check if opponent can reach this cell in 1-6 steps
      for (let d = 1; d <= 6; d++) {
        const result = calculateNextPosition(oppColor, oppPiece.position, oppPiece.distanceTraveled, d);
        if (result && result.position === piece.position) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Auto-plays a bot turn with the given difficulty.
 * @param {Object} gameState - Must be in MOVE phase with a dice value set
 * @param {string} difficulty
 * @returns {number | null} Selected piece index
 */
export function botSelectPiece(gameState, difficulty = 'medium') {
  return calculateBestMove(gameState, difficulty);
}
