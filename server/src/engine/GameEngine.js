/**
 * RAJU LUDO — UNIFIED GAME ENGINE
 * 
 * Single entry point that delegates to the correct game logic module.
 * Provides a consistent API regardless of game type (Ludo or Snakes & Ladders).
 */

import { GAME_TYPE } from './constants.js';
import {
  createLudoGameState, applyDiceRoll, applyMove,
  rollDice, executeTurn, getGameSummary,
} from './LudoLogic.js';
import {
  createSLGameState, applySLDiceRoll, applySLMove, executeSLTurn,
} from './SnakeLadderLogic.js';
import { getValidMoves } from './helpers.js';

/**
 * The Unified Game Engine.
 * Wraps both Ludo and Snakes & Ladders logic behind a single interface.
 */
class GameEngine {
  /**
   * Creates a new game.
   * @param {string} gameType - 'LUDO' or 'SNAKE_LADDER'
   * @param {Object} options - { players: string[] }
   * @returns {Object} Initial game state
   */
  static createGame(gameType, options = {}) {
    switch (gameType) {
      case GAME_TYPE.LUDO:
        return createLudoGameState(options);
      case GAME_TYPE.SNAKE_LADDER:
        return createSLGameState(options);
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  /**
   * Rolls the dice (server-authoritative).
   * @returns {number} 1-6
   */
  static rollDice() {
    return rollDice();
  }

  /**
   * Applies a dice roll to the current state.
   * @param {Object} state
   * @param {number} diceValue
   * @returns {Object} For Ludo: new state. For S&L: { state, events }
   */
  static applyDiceRoll(state, diceValue) {
    switch (state.gameType) {
      case GAME_TYPE.LUDO:
        return { state: applyDiceRoll(state, diceValue), events: [] };
      case GAME_TYPE.SNAKE_LADDER:
        return applySLDiceRoll(state, diceValue);
      default:
        throw new Error(`Unknown game type: ${state.gameType}`);
    }
  }

  /**
   * Applies a piece move.
   * @param {Object} state
   * @param {number} pieceIndex - For S&L this is ignored (single piece)
   * @returns {{ state: Object, events: Array }}
   */
  static applyMove(state, pieceIndex = 0) {
    switch (state.gameType) {
      case GAME_TYPE.LUDO:
        return applyMove(state, pieceIndex);
      case GAME_TYPE.SNAKE_LADDER:
        return applySLMove(state);
      default:
        throw new Error(`Unknown game type: ${state.gameType}`);
    }
  }

  /**
   * Gets valid moves for the current player.
   * @param {Object} state
   * @param {number} diceValue
   * @returns {Array}
   */
  static getValidMoves(state, diceValue) {
    switch (state.gameType) {
      case GAME_TYPE.LUDO:
        return getValidMoves(state, state.currentPlayer, diceValue);
      case GAME_TYPE.SNAKE_LADDER:
        // S&L has only one piece — always valid if not overshooting
        const pos = state.players[state.currentPlayer].piece.position;
        if (pos + diceValue <= 100) return [{ pieceIndex: 0, type: 'MOVE' }];
        return [];
      default:
        throw new Error(`Unknown game type: ${state.gameType}`);
    }
  }

  /**
   * Executes a full turn (roll + move). For AI/testing.
   * @param {Object} state
   * @param {number} diceValue
   * @param {number} pieceIndex
   * @returns {{ state: Object, events: Array }}
   */
  static executeTurn(state, diceValue, pieceIndex = 0) {
    switch (state.gameType) {
      case GAME_TYPE.LUDO:
        return executeTurn(state, diceValue, pieceIndex);
      case GAME_TYPE.SNAKE_LADDER:
        return executeSLTurn(state, diceValue);
      default:
        throw new Error(`Unknown game type: ${state.gameType}`);
    }
  }

  /**
   * Gets a human-readable game summary.
   */
  static getSummary(state) {
    switch (state.gameType) {
      case GAME_TYPE.LUDO:
        return getGameSummary(state);
      case GAME_TYPE.SNAKE_LADDER: {
        const summary = { currentPlayer: state.currentPlayer, gameStatus: state.gameStatus, winner: state.winner, players: {} };
        for (const [color, data] of Object.entries(state.players)) {
          summary.players[color] = { position: data.piece.position, finished: data.finished };
        }
        return summary;
      }
      default:
        throw new Error(`Unknown game type: ${state.gameType}`);
    }
  }
}

export default GameEngine;

// Also export everything for direct imports
export {
  GAME_TYPE,
  createLudoGameState,
  createSLGameState,
  rollDice,
};
