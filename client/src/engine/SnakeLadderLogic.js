/**
 * RAJU LUDO — SNAKES & LADDERS GAME LOGIC
 * Pure, deterministic state machine for the Snakes & Ladders game mode.
 */

import {
  GAME_TYPE, GAME_STATUS, DICE_MIN, DICE_MAX, UNLOCK_VALUE,
  SL_BOARD_SIZE, PLAYERS, PLAYER_LIST,
} from './constants.js';

import {
  deepClone, resolveSnakeOrLadder, isValidSLMove, createInitialSLPiece,
  getNextPlayer,
} from './helpers.js';

/**
 * Creates a fresh Snakes & Ladders game state.
 * @param {Object} options
 * @param {string[]} options.players - Player colors (2-4)
 * @returns {Object} Initial game state
 */
export function createSLGameState(options = {}) {
  const activePlayers = options.players || [PLAYERS.RED, PLAYERS.GREEN];
  if (activePlayers.length < 2 || activePlayers.length > 4) {
    throw new Error(`S&L requires 2-4 players, got ${activePlayers.length}`);
  }

  const players = {};
  for (const color of activePlayers) {
    players[color] = {
      piece: createInitialSLPiece(color),
      finished: false,
    };
  }

  return {
    gameType: GAME_TYPE.SNAKE_LADDER,
    currentPlayer: activePlayers[0],
    turnOrder: [...activePlayers],
    players,
    diceValue: null,
    gameStatus: GAME_STATUS.IN_PROGRESS,
    winner: null,
    rankings: [],
    moveHistory: [],
    turnPhase: 'ROLL',
  };
}

/**
 * Applies a dice roll to S&L state.
 */
export function applySLDiceRoll(state, diceValue) {
  if (state.gameStatus !== GAME_STATUS.IN_PROGRESS) throw new Error('Game not in progress');
  if (state.turnPhase !== 'ROLL' && state.turnPhase !== 'EXTRA_ROLL') {
    throw new Error(`Cannot roll in phase: ${state.turnPhase}`);
  }
  if (diceValue < DICE_MIN || diceValue > DICE_MAX) throw new Error(`Invalid dice: ${diceValue}`);

  const newState = deepClone(state);
  const player = state.currentPlayer;
  const currentPos = newState.players[player].piece.position;
  newState.diceValue = diceValue;

  // Check if move is valid (doesn't overshoot 100)
  if (!isValidSLMove(currentPos, diceValue)) {
    newState.moveHistory.push({ player, action: 'OVERSHOOT', diceValue, timestamp: Date.now() });
    if (diceValue === UNLOCK_VALUE) {
      newState.turnPhase = 'EXTRA_ROLL';
    } else {
      newState.currentPlayer = getSLNextPlayer(newState);
      newState.turnPhase = 'ROLL';
    }
    newState.diceValue = null;
    return { state: newState, events: [{ type: 'OVERSHOOT', player }] };
  }

  newState.turnPhase = 'MOVE';
  return { state: newState, events: [] };
}

/**
 * Applies a move in S&L. The player has only one piece, so no choice needed.
 */
export function applySLMove(state) {
  if (state.turnPhase !== 'MOVE') throw new Error(`Cannot move in phase: ${state.turnPhase}`);

  const newState = deepClone(state);
  const player = state.currentPlayer;
  const diceValue = state.diceValue;
  const piece = newState.players[player].piece;
  const events = [];

  const prevPos = piece.position;
  let newPos = prevPos + diceValue;

  events.push({ type: 'PIECE_MOVED', player, from: prevPos, to: newPos, diceValue });

  // Check for snake or ladder
  const resolved = resolveSnakeOrLadder(newPos);
  if (resolved.type === 'SNAKE') {
    events.push({ type: 'SNAKE_HIT', player, from: newPos, to: resolved.position });
    newPos = resolved.position;
  } else if (resolved.type === 'LADDER') {
    events.push({ type: 'LADDER_HIT', player, from: newPos, to: resolved.position });
    newPos = resolved.position;
  }

  piece.position = newPos;

  // Win check
  if (newPos >= SL_BOARD_SIZE) {
    newState.players[player].finished = true;
    newState.rankings.push(player);
    events.push({ type: 'PLAYER_FINISHED', player, rank: newState.rankings.length });

    const activePlayers = newState.turnOrder.filter(p => !newState.players[p].finished);
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) newState.rankings.push(activePlayers[0]);
      newState.gameStatus = GAME_STATUS.FINISHED;
      newState.winner = newState.rankings[0];
      events.push({ type: 'GAME_OVER', winner: newState.winner, rankings: [...newState.rankings] });
    }
  }

  // Record history
  newState.moveHistory.push({ player, action: 'MOVE', diceValue, from: prevPos, to: newPos, timestamp: Date.now() });

  // Turn management
  if (newState.gameStatus === GAME_STATUS.FINISHED) {
    newState.turnPhase = 'ROLL';
    newState.diceValue = null;
  } else if (diceValue === UNLOCK_VALUE && !newState.players[player].finished) {
    newState.turnPhase = 'EXTRA_ROLL';
    newState.diceValue = null;
  } else {
    newState.currentPlayer = getSLNextPlayer(newState);
    newState.turnPhase = 'ROLL';
    newState.diceValue = null;
  }

  return { state: newState, events };
}

/**
 * Gets next S&L player, skipping finished players.
 */
function getSLNextPlayer(state) {
  const { turnOrder, currentPlayer, players } = state;
  const idx = turnOrder.indexOf(currentPlayer);
  for (let i = 1; i <= turnOrder.length; i++) {
    const next = turnOrder[(idx + i) % turnOrder.length];
    if (!players[next].finished) return next;
  }
  return currentPlayer;
}

/**
 * Full turn execution for S&L (roll + auto-move).
 */
export function executeSLTurn(state, diceValue) {
  const { state: rolledState, events: rollEvents } = applySLDiceRoll(state, diceValue);
  if (rolledState.turnPhase !== 'MOVE') return { state: rolledState, events: rollEvents };
  const { state: movedState, events: moveEvents } = applySLMove(rolledState);
  return { state: movedState, events: [...rollEvents, ...moveEvents] };
}
