/**
 * RAJU LUDO — LUDO GAME LOGIC
 * Complete Ludo state machine. Every function is PURE.
 * Zero framework dependencies — runs on browser, Node.js, or test runner.
 */

import {
  PLAYERS, PLAYER_CONFIG, PIECES_PER_PLAYER,
  GAME_TYPE, GAME_STATUS, UNLOCK_VALUE,
  MAX_CONSECUTIVE_SIXES, DICE_MIN, DICE_MAX,
} from './constants.js';

import {
  deepClone, calculateNextPosition, isSafeCell,
  isBasePosition, isFinished, isHomeCellId,
  findOpponentPiecesOnCell, isBlockedByOpponent,
  getValidMoves, getNextPlayer, shouldGetBonusTurn,
  hasPlayerWon, isGameOver, createInitialPieces,
} from './helpers.js';

/**
 * Creates a fresh Ludo game state.
 * @param {Object} options
 * @param {string[]} options.players - Player colors (2-4)
 * @returns {Object} Initial game state
 */
export function createLudoGameState(options = {}) {
  const activePlayers = options.players || [PLAYERS.RED, PLAYERS.GREEN, PLAYERS.YELLOW, PLAYERS.BLUE];
  if (activePlayers.length < 2 || activePlayers.length > 4) {
    throw new Error(`Ludo requires 2-4 players, got ${activePlayers.length}`);
  }
  const players = {};
  for (const color of activePlayers) {
    if (!PLAYER_CONFIG[color]) throw new Error(`Invalid player color: ${color}`);
    players[color] = { pieces: createInitialPieces(color), finishedCount: 0 };
  }
  return {
    gameType: GAME_TYPE.LUDO,
    currentPlayer: activePlayers[0],
    turnOrder: [...activePlayers],
    players,
    diceValue: null,
    consecutiveSixes: 0,
    gameStatus: GAME_STATUS.IN_PROGRESS,
    winner: null,
    rankings: [],
    moveHistory: [],
    turnPhase: 'ROLL', // ROLL | MOVE | EXTRA_ROLL
  };
}

/** Server-authoritative dice roll. */
export function rollDice() {
  return Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1)) + DICE_MIN;
}

/**
 * Applies a dice roll to game state. Transitions ROLL → MOVE phase.
 * Handles triple-six penalty and auto-skip when no valid moves exist.
 */
export function applyDiceRoll(state, diceValue) {
  if (state.gameStatus !== GAME_STATUS.IN_PROGRESS) throw new Error('Game not in progress');
  if (state.turnPhase !== 'ROLL' && state.turnPhase !== 'EXTRA_ROLL') {
    throw new Error(`Cannot roll in phase: ${state.turnPhase}`);
  }
  if (diceValue < DICE_MIN || diceValue > DICE_MAX) throw new Error(`Invalid dice: ${diceValue}`);

  const newState = deepClone(state);
  newState.diceValue = diceValue;
  newState.consecutiveSixes = diceValue === UNLOCK_VALUE ? state.consecutiveSixes + 1 : 0;

  // Triple-six penalty
  if (newState.consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
    newState.moveHistory.push({ player: state.currentPlayer, action: 'TRIPLE_SIX_PENALTY', diceValue, timestamp: Date.now() });
    newState.consecutiveSixes = 0;
    newState.diceValue = null;
    newState.currentPlayer = getNextPlayer(newState);
    newState.turnPhase = 'ROLL';
    return newState;
  }

  const validMoves = getValidMoves(newState, state.currentPlayer, diceValue);
  if (validMoves.length === 0) {
    newState.moveHistory.push({ player: state.currentPlayer, action: 'NO_VALID_MOVES', diceValue, timestamp: Date.now() });
    if (diceValue === UNLOCK_VALUE) {
      newState.turnPhase = 'EXTRA_ROLL';
    } else {
      newState.consecutiveSixes = 0;
      newState.currentPlayer = getNextPlayer(newState);
      newState.turnPhase = 'ROLL';
    }
    return newState;
  }

  newState.turnPhase = 'MOVE';
  return newState;
}

/**
 * Builds hop-by-hop path for animation.
 */
export function buildMovePath(player, startPosition, startDistance, steps) {
  const path = [];
  for (let i = 1; i <= steps; i++) {
    const result = calculateNextPosition(player, startPosition, startDistance, i);
    if (result) path.push(result.position);
  }
  return path;
}

/**
 * Applies a piece move. Core state transition handling unlocking, movement,
 * collisions, kills, bonus turns, and win detection.
 * @returns {{ state: Object, events: Array }}
 */
export function applyMove(state, pieceIndex) {
  if (state.turnPhase !== 'MOVE') throw new Error(`Cannot move in phase: ${state.turnPhase}`);
  if (state.gameStatus !== GAME_STATUS.IN_PROGRESS) throw new Error('Game not in progress');

  const player = state.currentPlayer;
  const diceValue = state.diceValue;
  const piece = state.players[player].pieces[pieceIndex];
  if (!piece) throw new Error(`Invalid piece index: ${pieceIndex}`);

  const validMoves = getValidMoves(state, player, diceValue);
  const selectedMove = validMoves.find(m => m.pieceIndex === pieceIndex);
  if (!selectedMove) throw new Error(`Piece ${pieceIndex} has no valid move`);

  const newState = deepClone(state);
  const events = [];
  let killedOpponent = false;
  const movingPiece = newState.players[player].pieces[pieceIndex];

  if (selectedMove.type === 'UNLOCK') {
    const config = PLAYER_CONFIG[player];
    const prev = movingPiece.position;
    movingPiece.position = config.startCell;
    movingPiece.distanceTraveled = 0;
    events.push({ type: 'PIECE_UNLOCKED', player, pieceIndex, from: prev, to: config.startCell });

  } else if (selectedMove.type === 'MOVE') {
    const prev = movingPiece.position;
    movingPiece.position = selectedMove.destination;
    movingPiece.distanceTraveled = selectedMove.distanceTraveled;
    const path = buildMovePath(player, prev, piece.distanceTraveled, diceValue);
    events.push({ type: 'PIECE_MOVED', player, pieceIndex, from: prev, to: selectedMove.destination, path, diceValue });

    // Finish check
    if (isFinished(selectedMove.destination)) {
      newState.players[player].finishedCount += 1;
      events.push({ type: 'PIECE_FINISHED', player, pieceIndex });

      if (hasPlayerWon(newState.players[player])) {
        newState.rankings.push(player);
        events.push({ type: 'PLAYER_FINISHED', player, rank: newState.rankings.length });

        if (isGameOver(newState)) {
          const remaining = newState.turnOrder.filter(p => !newState.rankings.includes(p));
          newState.rankings.push(...remaining);
          newState.gameStatus = GAME_STATUS.FINISHED;
          newState.winner = newState.rankings[0];
          events.push({ type: 'GAME_OVER', winner: newState.winner, rankings: [...newState.rankings] });
        }
      }
    }

    // Kill check (non-safe, non-home, non-finished cells)
    if (!isFinished(selectedMove.destination) && !isSafeCell(selectedMove.destination) && !isHomeCellId(selectedMove.destination)) {
      const opponents = findOpponentPiecesOnCell(newState.players, player, selectedMove.destination);
      for (const opp of opponents) {
        const oppPiecesOnCell = newState.players[opp.player].pieces.filter(p => p.position === selectedMove.destination);
        if (oppPiecesOnCell.length === 1) {
          const oppPiece = newState.players[opp.player].pieces[opp.pieceIndex];
          oppPiece.position = PLAYER_CONFIG[opp.player].base;
          oppPiece.distanceTraveled = 0;
          killedOpponent = true;
          events.push({ type: 'PIECE_KILLED', killer: player, victim: opp.player, victimPieceIndex: opp.pieceIndex, cell: selectedMove.destination });
        }
      }
    }
  }

  // Record history
  newState.moveHistory.push({ player, action: selectedMove.type, pieceIndex, diceValue, destination: selectedMove.destination, killedOpponent, timestamp: Date.now() });

  // Turn management
  if (newState.gameStatus === GAME_STATUS.FINISHED) {
    newState.turnPhase = 'ROLL';
    newState.diceValue = null;
  } else if (shouldGetBonusTurn(diceValue, killedOpponent)) {
    if (hasPlayerWon(newState.players[player])) {
      newState.currentPlayer = getNextPlayer(newState);
      newState.consecutiveSixes = 0;
    }
    newState.turnPhase = 'EXTRA_ROLL';
    newState.diceValue = null;
  } else {
    newState.currentPlayer = getNextPlayer(newState);
    newState.consecutiveSixes = 0;
    newState.turnPhase = 'ROLL';
    newState.diceValue = null;
  }

  return { state: newState, events };
}

/**
 * Executes a complete turn (roll + move). For AI and testing.
 */
export function executeTurn(state, diceValue, pieceIndex) {
  const rolledState = applyDiceRoll(state, diceValue);
  if (rolledState.turnPhase === 'ROLL' || rolledState.turnPhase === 'EXTRA_ROLL') {
    return { state: rolledState, events: [] };
  }
  return applyMove(rolledState, pieceIndex);
}

/**
 * Gets a human-readable summary of the game state.
 */
export function getGameSummary(state) {
  const summary = { currentPlayer: state.currentPlayer, turnPhase: state.turnPhase, diceValue: state.diceValue, gameStatus: state.gameStatus, winner: state.winner, rankings: state.rankings, players: {} };
  for (const [color, data] of Object.entries(state.players)) {
    summary.players[color] = {
      piecesInBase: data.pieces.filter(p => isBasePosition(p.position)).length,
      piecesOnBoard: data.pieces.filter(p => !isBasePosition(p.position) && !isFinished(p.position)).length,
      piecesFinished: data.finishedCount,
      positions: data.pieces.map(p => p.position),
    };
  }
  return summary;
}
