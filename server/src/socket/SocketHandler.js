/**
 * RAJU LUDO — SOCKET.IO EVENT HANDLER
 * Handles all real-time communication between clients and the server.
 * 
 * PROTOCOL:
 *   Client → Server: room:create, room:join, room:quickMatch, room:leave,
 *                     game:start, game:rollDice, game:movePiece, chat:message
 *   Server → Client: room:created, room:joined, room:playerJoined, room:playerLeft,
 *                     room:updated, game:started, game:diceRolled, game:pieceMoved,
 *                     game:stateSync, game:over, player:disconnected, player:reconnected,
 *                     player:timedOut, chat:message, error
 */

import { RoomManager } from './GameRoom.js';

const roomManager = new RoomManager();

// Track reconnect tokens: socketId → { roomId, color }
const reconnectTokens = new Map();

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // ── ROOM MANAGEMENT ──────────────────────────────────────────────────

    /**
     * Create a new game room.
     * @param {{ displayName: string, gameType?: string, maxPlayers?: number }}
     */
    socket.on('room:create', (data, callback) => {
      const { displayName, gameType, maxPlayers } = data || {};
      const result = roomManager.createRoom(socket.id, displayName, { gameType, maxPlayers });

      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      socket.join(result.roomId);
      callback({ success: true, roomId: result.roomId, color: result.color, roomInfo: result.roomInfo });
      console.log(`[ROOM] ${displayName} created room ${result.roomId}`);
    });

    /**
     * Join an existing room by ID.
     */
    socket.on('room:join', (data, callback) => {
      const { roomId, displayName } = data || {};
      const result = roomManager.joinRoom(socket.id, roomId, displayName);

      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      socket.join(result.roomId);
      callback({ success: true, roomId: result.roomId, color: result.color, roomInfo: result.roomInfo });

      // Notify other players
      socket.to(result.roomId).emit('room:playerJoined', {
        color: result.color,
        displayName,
        roomInfo: result.roomInfo,
      });

      console.log(`[ROOM] ${displayName} joined room ${result.roomId} as ${result.color}`);
    });

    /**
     * Quick matchmaking — find or create an open room.
     */
    socket.on('room:quickMatch', (data, callback) => {
      const { displayName, gameType } = data || {};
      const result = roomManager.quickMatch(socket.id, displayName, { gameType });

      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      socket.join(result.roomId);
      callback({ success: true, roomId: result.roomId, color: result.color, roomInfo: result.roomInfo });

      // Notify others if joining existing room
      socket.to(result.roomId).emit('room:playerJoined', {
        color: result.color,
        displayName,
        roomInfo: result.roomInfo,
      });

      console.log(`[MATCH] ${displayName} matched into room ${result.roomId}`);
    });

    /**
     * Leave current room.
     */
    socket.on('room:leave', (_, callback) => {
      const room = roomManager.getRoom(socket.id);
      if (!room) return callback?.({ success: true });

      const roomId = room.id;
      const color = room.socketIdToColor.get(socket.id);

      const result = roomManager.leaveRoom(socket.id);
      socket.leave(roomId);

      // Notify remaining players
      io.to(roomId).emit('room:playerLeft', {
        color,
        roomInfo: room.getRoomInfo(),
      });

      if (result && result.eliminated) {
        // Broadcast the state change so others know whose turn it is now
        io.to(roomId).emit('game:pieceMoved', {
          movedBy: color,
          pieceIndex: -1,
          events: result.events,
          gameState: result.gameState,
        });

        // Check if game is over
        if (result.gameState.gameStatus === 'FINISHED') {
          io.to(roomId).emit('game:over', {
            winner: result.gameState.winner,
            rankings: result.gameState.rankings,
            gameState: result.gameState,
          });
        }
      }

      callback?.({ success: true });
      console.log(`[ROOM] ${color} left room ${roomId}`);
    });

    /**
     * List available rooms.
     */
    socket.on('room:list', (_, callback) => {
      callback({ rooms: roomManager.listRooms() });
    });

    // ── GAME ACTIONS ─────────────────────────────────────────────────────

    /**
     * Start the game (host only).
     */
    socket.on('game:start', (_, callback) => {
      const room = roomManager.getRoom(socket.id);
      if (!room) return callback({ success: false, error: 'Not in a room' });

      const result = room.startGame(socket.id);
      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      // Broadcast game start to all players
      io.to(room.id).emit('game:started', {
        gameState: room.gameState,
        roomInfo: room.getRoomInfo(),
      });

      callback({ success: true });
      console.log(`[GAME] Room ${room.id} started!`);
    });

    /**
     * Roll dice (server-authoritative).
     * The server generates the dice value — client never sends a value.
     */
    socket.on('game:rollDice', (_, callback) => {
      const room = roomManager.getRoom(socket.id);
      if (!room) return callback({ success: false, error: 'Not in a room' });

      const result = room.rollDice(socket.id);
      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      // Broadcast dice roll to ALL players in room (including roller)
      io.to(room.id).emit('game:diceRolled', {
        diceValue: result.diceValue,
        rolledBy: room.socketIdToColor.get(socket.id),
        validMoves: result.validMoves,
        gameState: result.gameState,
      });

      callback({ success: true, diceValue: result.diceValue, validMoves: result.validMoves });
    });

    /**
     * Move a piece (server-authoritative).
     */
    socket.on('game:movePiece', (data, callback) => {
      const room = roomManager.getRoom(socket.id);
      if (!room) return callback({ success: false, error: 'Not in a room' });

      const { pieceIndex } = data || {};
      const result = room.movePiece(socket.id, pieceIndex);

      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      // Broadcast move + events to ALL players
      io.to(room.id).emit('game:pieceMoved', {
        movedBy: room.socketIdToColor.get(socket.id),
        pieceIndex,
        events: result.events,
        gameState: result.gameState,
      });

      // Check game over
      if (result.gameState.gameStatus === 'FINISHED') {
        io.to(room.id).emit('game:over', {
          winner: result.gameState.winner,
          rankings: result.gameState.rankings,
          gameState: result.gameState,
        });
        console.log(`[GAME] Room ${room.id} finished! Winner: ${result.gameState.winner}`);
      }

      callback({ success: true });
    });

    /**
     * Request full state sync (for reconnection).
     */
    socket.on('game:requestSync', (_, callback) => {
      const room = roomManager.getRoom(socket.id);
      if (!room) return callback({ success: false, error: 'Not in a room' });

      callback({
        success: true,
        gameState: room.gameState,
        roomInfo: room.getRoomInfo(),
        yourColor: room.socketIdToColor.get(socket.id),
      });
    });

    // ── CHAT ─────────────────────────────────────────────────────────────

    socket.on('chat:message', (data) => {
      const room = roomManager.getRoom(socket.id);
      if (!room) return;

      const color = room.socketIdToColor.get(socket.id);
      const player = room.players.get(color);
      const playerName = player?.displayName || color;

      // Broadcast to ALL OTHER players (sender already shows their own bubble)
      socket.to(room.id).emit('chat:message', {
        playerColor: color,
        playerName: playerName,
        message: (data.message || '').slice(0, 200),
        timestamp: Date.now(),
      });
    });

    // ── DISCONNECTION ────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      console.log(`[DISCONNECT] ${socket.id} — ${reason}`);

      const room = roomManager.getRoom(socket.id);
      if (!room) return;

      const color = room.socketIdToColor.get(socket.id);

      // Store reconnect token
      reconnectTokens.set(socket.id, { roomId: room.id, color });

      // Handle disconnect with timeout callback
      roomManager.handleDisconnect(socket.id, (timedOutSocketId, timedOutColor) => {
        // Player didn't reconnect in time
        reconnectTokens.delete(timedOutSocketId);

        io.to(room.id).emit('player:timedOut', {
          color: timedOutColor,
          roomInfo: room.getRoomInfo(),
        });

        console.log(`[TIMEOUT] ${timedOutColor} timed out in room ${room.id}`);
      });

      // Notify other players
      socket.to(room.id).emit('player:disconnected', {
        color,
        timeout: 60,
      });
    });

    // ── RECONNECTION ─────────────────────────────────────────────────────

    socket.on('game:reconnect', (data, callback) => {
      const { previousSocketId, roomId } = data || {};

      const token = reconnectTokens.get(previousSocketId);
      if (!token || token.roomId !== roomId) {
        return callback({ success: false, error: 'Invalid reconnection' });
      }

      const room = roomManager.getRoomById(roomId);
      if (!room) return callback({ success: false, error: 'Room no longer exists' });

      const result = room.handleReconnect(previousSocketId, socket.id);
      if (!result.success) return callback({ success: false, error: 'Reconnection failed' });

      // Update room manager mapping
      roomManager.socketToRoom.delete(previousSocketId);
      roomManager.socketToRoom.set(socket.id, roomId);
      reconnectTokens.delete(previousSocketId);

      socket.join(roomId);

      // Notify others
      socket.to(roomId).emit('player:reconnected', {
        color: result.color,
        roomInfo: room.getRoomInfo(),
      });

      callback({
        success: true,
        color: result.color,
        gameState: result.gameState,
        roomInfo: room.getRoomInfo(),
      });

      console.log(`[RECONNECT] ${result.color} reconnected to room ${roomId}`);
    });
  });

  // Periodic cleanup of stale rooms
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of roomManager.rooms) {
      if (room.status === 'FINISHED' && now - room.createdAt > 300000) {
        roomManager.rooms.delete(roomId);
      }
      if (room.isEmpty()) {
        roomManager.rooms.delete(roomId);
      }
    }
  }, 60000);
}
