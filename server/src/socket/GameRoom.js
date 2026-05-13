/**
 * RAJU LUDO — GAME ROOM MANAGER
 * Manages game rooms, player slots, matchmaking, and game lifecycle.
 * Handles disconnection/reconnection with a 60-second grace period.
 */

import { v4 as uuidv4 } from 'uuid';
import { createLudoGameState, applyDiceRoll, applyMove, rollDice } from '../engine/LudoLogic.js';
import { createSLGameState, applySLDiceRoll, applySLMove } from '../engine/SnakeLadderLogic.js';
import { GAME_TYPE, GAME_STATUS, PLAYERS } from '../engine/constants.js';
import { getValidMoves } from '../engine/helpers.js';

const RECONNECT_TIMEOUT_MS = 60000; // 60 seconds
// We'll define the colors dynamically based on maxPlayers inside the class.

export class GameRoom {
  constructor(options = {}) {
    this.id = uuidv4().slice(0, 8).toUpperCase();
    this.gameType = options.gameType || GAME_TYPE.LUDO;
    this.maxPlayers = options.maxPlayers || 4;
    this.createdAt = Date.now();
    this.status = 'WAITING'; // WAITING | IN_PROGRESS | FINISHED

    // Player management: { socketId, color, displayName, connected, disconnectTimer }
    this.players = new Map();
    this.colorToSocketId = new Map(); // color → socketId (for quick lookup)
    this.socketIdToColor = new Map(); // socketId → color

    // Game engine state (server is authoritative)
    this.gameState = null;

    // Host is the first player who created the room
    this.hostSocketId = null;
  }

  _getAvailableColors() {
    // By ordering Red then Yellow, the first two players to join will always be seated opposite each other.
    return [PLAYERS.RED, PLAYERS.YELLOW, PLAYERS.GREEN, PLAYERS.BLUE];
  }

  /**
   * Adds a player to the room.
   * @param {string} socketId
   * @param {string} displayName
   * @returns {{ success: boolean, color: string, error?: string }}
   */
  addPlayer(socketId, displayName) {
    if (this.status !== 'WAITING') {
      return { success: false, error: 'Game already in progress' };
    }
    if (this.players.size >= this.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }
    if (this.socketIdToColor.has(socketId)) {
      return { success: false, error: 'Already in this room' };
    }

    // Assign next available color
    const assignedColor = this._getAvailableColors().find(c => !this.colorToSocketId.has(c));
    if (!assignedColor) {
      return { success: false, error: 'No available color slots' };
    }

    this.players.set(socketId, {
      socketId,
      color: assignedColor,
      displayName: displayName || `Player ${this.players.size + 1}`,
      connected: true,
      disconnectTimer: null,
    });
    this.colorToSocketId.set(assignedColor, socketId);
    this.socketIdToColor.set(socketId, assignedColor);

    // First player is host
    if (!this.hostSocketId) {
      this.hostSocketId = socketId;
    }

    return { success: true, color: assignedColor };
  }

  /**
   * Removes a player from the room (only in WAITING state).
   */
  removePlayer(socketId) {
    const color = this.socketIdToColor.get(socketId);
    if (!color) return;

    this.players.delete(socketId);
    this.colorToSocketId.delete(color);
    this.socketIdToColor.delete(socketId);

    // If host left, assign new host
    if (this.hostSocketId === socketId) {
      const remaining = [...this.players.keys()];
      this.hostSocketId = remaining.length > 0 ? remaining[0] : null;
    }
  }

  /**
   * Starts the game (only host can start, minimum 2 players).
   * @param {string} socketId - Must be host
   * @returns {{ success: boolean, error?: string }}
   */
  startGame(socketId) {
    if (socketId !== this.hostSocketId) {
      return { success: false, error: 'Only the host can start the game' };
    }
    if (this.players.size < 2) {
      return { success: false, error: 'Need at least 2 players' };
    }
    if (this.status !== 'WAITING') {
      return { success: false, error: 'Game already started' };
    }

    // Get active player colors in order
    const activeColors = this._getAvailableColors().filter(c => this.colorToSocketId.has(c));

    // Create engine state
    if (this.gameType === GAME_TYPE.LUDO) {
      this.gameState = createLudoGameState({ players: activeColors });
    } else {
      this.gameState = createSLGameState({ players: activeColors });
    }

    this.status = 'IN_PROGRESS';
    return { success: true };
  }

  /**
   * Server-authoritative dice roll.
   * @param {string} socketId - The player requesting the roll
   * @returns {{ success: boolean, diceValue?: number, gameState?: Object, error?: string }}
   */
  rollDice(socketId) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Game not in progress' };
    }

    const playerColor = this.socketIdToColor.get(socketId);
    if (!playerColor) {
      return { success: false, error: 'Player not in room' };
    }

    if (this.gameState.currentPlayer !== playerColor) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.gameState.turnPhase !== 'ROLL' && this.gameState.turnPhase !== 'EXTRA_ROLL') {
      return { success: false, error: 'Cannot roll in current phase' };
    }

    // SERVER rolls the dice (anti-cheat)
    const diceValue = rollDice();

    // Apply to engine
    if (this.gameType === GAME_TYPE.LUDO) {
      this.gameState = applyDiceRoll(this.gameState, diceValue);
    } else {
      const { state } = applySLDiceRoll(this.gameState, diceValue);
      this.gameState = state;
    }

    // Get valid moves (for client to know what's available)
    let validMoves = [];
    if (this.gameState.turnPhase === 'MOVE') {
      if (this.gameType === GAME_TYPE.LUDO) {
        validMoves = getValidMoves(this.gameState, this.gameState.currentPlayer, diceValue);
      } else {
        const pos = this.gameState.players[this.gameState.currentPlayer].piece.position;
        if (pos + diceValue <= 100) validMoves = [{ pieceIndex: 0, type: 'MOVE' }];
      }
    }

    return {
      success: true,
      diceValue,
      validMoves,
      gameState: this.gameState,
    };
  }

  /**
   * Server-authoritative piece move.
   * @param {string} socketId
   * @param {number} pieceIndex
   * @returns {{ success: boolean, events?: Array, gameState?: Object, error?: string }}
   */
  movePiece(socketId, pieceIndex) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Game not in progress' };
    }

    const playerColor = this.socketIdToColor.get(socketId);
    if (!playerColor) {
      return { success: false, error: 'Player not in room' };
    }

    if (this.gameState.currentPlayer !== playerColor) {
      return { success: false, error: 'Not your turn' };
    }

    if (this.gameState.turnPhase !== 'MOVE') {
      return { success: false, error: 'Cannot move in current phase' };
    }

    try {
      let result;
      if (this.gameType === GAME_TYPE.LUDO) {
        result = applyMove(this.gameState, pieceIndex);
      } else {
        result = applySLMove(this.gameState);
      }

      this.gameState = result.state;

      // Check if game is over
      if (this.gameState.gameStatus === GAME_STATUS.FINISHED) {
        this.status = 'FINISHED';
      }

      return {
        success: true,
        events: result.events,
        gameState: this.gameState,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handles player disconnection.
   * Starts a 60-second timer for reconnection.
   * @param {string} socketId
   * @param {Function} onTimeout - Called if player doesn't reconnect
   */
  handleDisconnect(socketId, onTimeout) {
    const player = this.players.get(socketId);
    if (!player) return;

    player.connected = false;

    if (this.status === 'WAITING') {
      // In lobby, just remove them
      this.removePlayer(socketId);
      return;
    }

    // In game, start reconnection timer
    player.disconnectTimer = setTimeout(() => {
      // Player didn't reconnect — handle timeout
      player.disconnectTimer = null;
      if (onTimeout) onTimeout(socketId, player.color);
    }, RECONNECT_TIMEOUT_MS);
  }

  /**
   * Handles player reconnection.
   * @param {string} oldSocketId
   * @param {string} newSocketId
   * @returns {{ success: boolean, color?: string, gameState?: Object }}
   */
  handleReconnect(oldSocketId, newSocketId) {
    const player = this.players.get(oldSocketId);
    if (!player) return { success: false, error: 'Player not found' };

    // Clear disconnect timer
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    // Update socket ID
    player.socketId = newSocketId;
    player.connected = true;

    // Update maps
    this.players.delete(oldSocketId);
    this.players.set(newSocketId, player);
    this.colorToSocketId.set(player.color, newSocketId);
    this.socketIdToColor.delete(oldSocketId);
    this.socketIdToColor.set(newSocketId, player.color);

    if (this.hostSocketId === oldSocketId) {
      this.hostSocketId = newSocketId;
    }

    return {
      success: true,
      color: player.color,
      gameState: this.gameState,
    };
  }

  /**
   * Gets room info for lobby display.
   */
  getRoomInfo() {
    const playerList = [];
    for (const [_, player] of this.players) {
      playerList.push({
        color: player.color,
        displayName: player.displayName,
        connected: player.connected,
      });
    }

    return {
      roomId: this.id,
      gameType: this.gameType,
      status: this.status,
      maxPlayers: this.maxPlayers,
      players: playerList,
      hostColor: this.socketIdToColor.get(this.hostSocketId) || null,
    };
  }

  /**
   * Checks if room is empty.
   */
  isEmpty() {
    return this.players.size === 0;
  }
}

/**
 * ROOM MANAGER — Manages all active game rooms.
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId → GameRoom
    this.socketToRoom = new Map(); // socketId → roomId
  }

  /**
   * Creates a new room.
   */
  createRoom(socketId, displayName, options = {}) {
    // Leave current room if in one
    this.leaveRoom(socketId);

    const room = new GameRoom(options);
    const result = room.addPlayer(socketId, displayName);

    if (!result.success) return { success: false, error: result.error };

    this.rooms.set(room.id, room);
    this.socketToRoom.set(socketId, room.id);

    return { success: true, roomId: room.id, color: result.color, roomInfo: room.getRoomInfo() };
  }

  /**
   * Joins an existing room.
   */
  joinRoom(socketId, roomId, displayName) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    // Leave current room if in one
    this.leaveRoom(socketId);

    const result = room.addPlayer(socketId, displayName);
    if (!result.success) return { success: false, error: result.error };

    this.socketToRoom.set(socketId, roomId);

    return { success: true, roomId: room.id, color: result.color, roomInfo: room.getRoomInfo() };
  }

  /**
   * Quick matchmaking — finds or creates an open room.
   */
  quickMatch(socketId, displayName, options = {}) {
    // Find an open WAITING room with space
    for (const [_, room] of this.rooms) {
      if (room.status === 'WAITING' &&
          room.gameType === (options.gameType || GAME_TYPE.LUDO) &&
          room.players.size < room.maxPlayers) {
        return this.joinRoom(socketId, room.id, displayName);
      }
    }
    // No open rooms — create one
    return this.createRoom(socketId, displayName, options);
  }

  /**
   * Leaves current room.
   */
  leaveRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(socketId);
    this.socketToRoom.delete(socketId);

    // Clean up empty rooms
    if (room.isEmpty()) {
      this.rooms.delete(roomId);
    }
  }

  /**
   * Gets the room a socket is in.
   */
  getRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  /**
   * Gets room by ID.
   */
  getRoomById(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Handles socket disconnect.
   */
  handleDisconnect(socketId, onTimeout) {
    const room = this.getRoom(socketId);
    if (!room) return;

    room.handleDisconnect(socketId, onTimeout);
  }

  /**
   * Lists all available (WAITING) rooms.
   */
  listRooms() {
    const available = [];
    for (const [_, room] of this.rooms) {
      if (room.status === 'WAITING') {
        available.push(room.getRoomInfo());
      }
    }
    return available;
  }
}
