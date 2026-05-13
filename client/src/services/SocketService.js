/**
 * RAJU LUDO — CLIENT SOCKET SERVICE
 * Manages the Socket.io connection to the multiplayer server.
 * Provides a clean API for room management, game actions, and event listening.
 */

import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomId = null;
    this.myColor = null;
    this.listeners = new Map(); // eventName → Set<callback>
    this._previousSocketId = null;
  }

  // ── CONNECTION ─────────────────────────────────────────────────────────

  /**
   * Connects to the multiplayer server.
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('[SOCKET] Connected:', this.socket.id);
        this.connected = true;

        // Auto-reconnect to room if we had one
        if (this._previousSocketId && this.roomId) {
          this._attemptReconnect();
        }

        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[SOCKET] Disconnected:', reason);
        this._previousSocketId = this.socket.id;
        this.connected = false;
        this._emit('connectionLost', { reason });
      });

      this.socket.on('connect_error', (err) => {
        console.error('[SOCKET] Connection error:', err.message);
        reject(err);
      });

      // Register server event listeners
      this._setupServerListeners();
    });
  }

  /**
   * Disconnects from the server.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.roomId = null;
      this.myColor = null;
    }
  }

  // ── ROOM MANAGEMENT ────────────────────────────────────────────────────

  /**
   * Creates a new game room.
   * @param {string} displayName
   * @param {Object} options - { gameType, maxPlayers }
   * @returns {Promise<{ roomId, color, roomInfo }>}
   */
  createRoom(displayName, options = {}) {
    return this._request('room:create', { displayName, ...options });
  }

  /**
   * Joins an existing room by ID.
   * @param {string} roomId
   * @param {string} displayName
   * @returns {Promise<{ roomId, color, roomInfo }>}
   */
  joinRoom(roomId, displayName) {
    return this._request('room:join', { roomId, displayName });
  }

  /**
   * Quick matchmaking.
   * @param {string} displayName
   * @param {Object} options
   * @returns {Promise<{ roomId, color, roomInfo }>}
   */
  quickMatch(displayName, options = {}) {
    return this._request('room:quickMatch', { displayName, ...options });
  }

  /**
   * Leaves the current room.
   */
  leaveRoom() {
    return this._request('room:leave', {});
  }

  /**
   * Lists available rooms.
   * @returns {Promise<{ rooms: Array }>}
   */
  listRooms() {
    return this._request('room:list', {});
  }

  // ── GAME ACTIONS ───────────────────────────────────────────────────────

  /**
   * Starts the game (host only).
   */
  startGame() {
    return this._request('game:start', {});
  }

  /**
   * Rolls the dice (server generates the value).
   * @returns {Promise<{ diceValue, validMoves }>}
   */
  rollDice() {
    return this._request('game:rollDice', {});
  }

  /**
   * Moves a piece.
   * @param {number} pieceIndex
   */
  movePiece(pieceIndex) {
    return this._request('game:movePiece', { pieceIndex });
  }

  /**
   * Requests full game state sync.
   */
  requestSync() {
    return this._request('game:requestSync', {});
  }

  /**
   * Sends a chat message.
   * @param {string} message
   */
  sendChat(message) {
    if (this.socket) {
      this.socket.emit('chat:message', { message });
    }
  }

  // ── EVENT SUBSCRIPTION ─────────────────────────────────────────────────

  /**
   * Subscribes to a game event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Removes all listeners for an event.
   */
  off(event) {
    this.listeners.delete(event);
  }

  // ── INTERNAL ───────────────────────────────────────────────────────────

  _setupServerListeners() {
    const events = [
      'room:playerJoined', 'room:playerLeft', 'room:updated',
      'game:started', 'game:diceRolled', 'game:pieceMoved',
      'game:stateSync', 'game:over',
      'player:disconnected', 'player:reconnected', 'player:timedOut',
      'chat:message',
    ];

    events.forEach(event => {
      this.socket.on(event, (data) => {
        // Store room/color info from server responses
        if (data?.roomInfo) {
          this.roomId = data.roomInfo.roomId;
        }
        if (data?.yourColor) {
          this.myColor = data.yourColor;
        }
        this._emit(event, data);
      });
    });
  }

  _emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  _request(event, data) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit(event, data, (response) => {
        if (response?.success === false) {
          reject(new Error(response.error || 'Request failed'));
        } else {
          // Track room/color
          if (response?.roomId) this.roomId = response.roomId;
          if (response?.color) this.myColor = response.color;
          resolve(response);
        }
      });
    });
  }

  async _attemptReconnect() {
    try {
      const result = await this._request('game:reconnect', {
        previousSocketId: this._previousSocketId,
        roomId: this.roomId,
      });

      if (result.success) {
        this.myColor = result.color;
        this._previousSocketId = null;
        this._emit('reconnected', result);
        console.log('[SOCKET] Reconnected to room as', result.color);
      }
    } catch (err) {
      console.warn('[SOCKET] Reconnection failed:', err.message);
      this._previousSocketId = null;
    }
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;
