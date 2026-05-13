/**
 * RAJU LUDO — MULTIPLAYER LOBBY UI
 * Menu screen with player count selector for offline, matchmaking, rooms, and chat.
 */

import socketService from './SocketService.js';

export class LobbyUI {
  constructor(onGameStart) {
    this.onGameStart = onGameStart;
    this.container = null;
    this.currentRoom = null;
    this.selectedPlayerCount = 0;
    this._build();
    this._setupListeners();
  }

  _build() {
    this.container = document.createElement('div');
    this.container.id = 'lobby-overlay';
    this.container.innerHTML = `
      <div class="lobby-panel">
        <div class="lobby-header">
          <span class="lobby-logo">🎲</span>
          <h1 class="lobby-title">Raju Ludo</h1>
          <p class="lobby-subtitle">Multiplayer Board Game</p>
        </div>

        <!-- Main Menu -->
        <div id="lobby-menu" class="lobby-section">
          <button class="lobby-btn primary" id="btn-offline">
            <span class="btn-icon">🎮</span>
            <span class="btn-content">
              <span class="btn-label">Play Offline</span>
              <span class="btn-desc">Local multiplayer game</span>
            </span>
          </button>
          <button class="lobby-btn accent" id="btn-quickmatch">
            <span class="btn-icon">⚡</span>
            <span class="btn-content">
              <span class="btn-label">Quick Match</span>
              <span class="btn-desc">Play with random players online</span>
            </span>
          </button>
          <button class="lobby-btn" id="btn-create-room">
            <span class="btn-icon">🏠</span>
            <span class="btn-content">
              <span class="btn-label">Create Room</span>
              <span class="btn-desc">Invite friends with code</span>
            </span>
          </button>
          <button class="lobby-btn" id="btn-join-room">
            <span class="btn-icon">🔗</span>
            <span class="btn-content">
              <span class="btn-label">Join Room</span>
              <span class="btn-desc">Enter a room code</span>
            </span>
          </button>
        </div>

        <!-- Offline Player Count Selector -->
        <div id="lobby-player-select" class="lobby-section" style="display:none">
          <h2>Select Players</h2>
          <p class="select-subtitle">How many players?</p>
          <div class="player-count-grid">
            <button class="player-count-btn" data-count="2">
              <span class="count-num">2</span>
              <span class="count-icons">👤👤</span>
              <span class="count-label">Players</span>
            </button>
            <button class="player-count-btn" data-count="3">
              <span class="count-num">3</span>
              <span class="count-icons">👤👤👤</span>
              <span class="count-label">Players</span>
            </button>
            <button class="player-count-btn" data-count="4">
              <span class="count-num">4</span>
              <span class="count-icons">👤👤👤👤</span>
              <span class="count-label">Players</span>
            </button>
          </div>
          <div class="player-preview" id="player-preview"></div>
          <button class="lobby-btn primary disabled" id="btn-start-offline" disabled>
            🎲 Start Game
          </button>
          <button class="lobby-btn ghost" id="btn-back-player-select">← Back</button>
        </div>

        <!-- Name Input -->
        <div id="lobby-name" class="lobby-section" style="display:none">
          <h2>Enter Your Name</h2>
          <input type="text" id="player-name-input" placeholder="Your name..." maxlength="16" class="lobby-input" />
          <button class="lobby-btn primary" id="btn-confirm-name">Continue</button>
          <button class="lobby-btn ghost" id="btn-back-name">← Back</button>
        </div>

        <!-- Join Input -->
        <div id="lobby-join" class="lobby-section" style="display:none">
          <h2>Join Room</h2>
          <input type="text" id="room-code-input" placeholder="Room code (e.g. A1B2C3D4)" maxlength="8" class="lobby-input" style="text-transform:uppercase; letter-spacing:3px; text-align:center" />
          <button class="lobby-btn accent" id="btn-confirm-join">Join</button>
          <button class="lobby-btn ghost" id="btn-back-join">← Back</button>
        </div>

        <!-- Room Lobby -->
        <div id="lobby-room" class="lobby-section" style="display:none">
          <h2>Game Room</h2>
          <div class="room-code-display">
            <span class="room-label">ROOM CODE</span>
            <span class="room-code" id="room-code-value">—</span>
          </div>
          <div id="room-players" class="room-players"></div>
          <p id="room-status-msg" class="room-status">Waiting for players...</p>
          <button class="lobby-btn primary" id="btn-start-game" style="display:none">🎲 Start Game</button>
          <button class="lobby-btn ghost" id="btn-leave-room">Leave Room</button>
        </div>

        <!-- Connection Status -->
        <div id="connection-status" class="connection-status">
          <span class="status-dot"></span>
          <span class="status-text">Offline</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
  }

  _setupListeners() {
    const $ = (id) => document.getElementById(id);
    let pendingAction = null;

    // ── OFFLINE: Show player count selector ──
    $('btn-offline').addEventListener('click', () => {
      this.selectedPlayerCount = 0;
      this._resetPlayerCountButtons();
      this._showSection('lobby-player-select');
    });

    // Player count buttons
    this.container.querySelectorAll('.player-count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const count = parseInt(btn.dataset.count);
        this.selectedPlayerCount = count;

        // Highlight selected
        this.container.querySelectorAll('.player-count-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        // Enable start button
        const startBtn = $('btn-start-offline');
        startBtn.disabled = false;
        startBtn.classList.remove('disabled');

        // Show player color preview
        this._showPlayerPreview(count);
      });
    });

    // Start offline game
    $('btn-start-offline').addEventListener('click', () => {
      if (this.selectedPlayerCount < 2) return;
      this.hide();
      this.onGameStart({ mode: 'offline', playerCount: this.selectedPlayerCount });
    });

    $('btn-back-player-select').addEventListener('click', () => this._showSection('lobby-menu'));

    // ── ONLINE MODES ──
    $('btn-quickmatch').addEventListener('click', () => {
      pendingAction = 'quickmatch';
      this._showSection('lobby-name');
    });

    $('btn-create-room').addEventListener('click', () => {
      pendingAction = 'create';
      this._showSection('lobby-name');
    });

    $('btn-join-room').addEventListener('click', () => {
      pendingAction = 'join';
      this._showSection('lobby-name');
    });

    // Back buttons
    $('btn-back-name').addEventListener('click', () => this._showSection('lobby-menu'));
    $('btn-back-join').addEventListener('click', () => this._showSection('lobby-menu'));

    // Confirm name
    $('btn-confirm-name').addEventListener('click', async () => {
      const name = $('player-name-input').value.trim() || 'Player';
      await this._connectToServer();

      if (pendingAction === 'quickmatch') {
        await this._doQuickMatch(name);
      } else if (pendingAction === 'create') {
        await this._doCreateRoom(name);
      } else if (pendingAction === 'join') {
        $('player-name-input').dataset.name = name;
        this._showSection('lobby-join');
      }
    });

    // Confirm join
    $('btn-confirm-join').addEventListener('click', async () => {
      const code = $('room-code-input').value.trim().toUpperCase();
      const name = $('player-name-input').dataset.name || 'Player';
      if (!code) return;
      await this._connectToServer();
      await this._doJoinRoom(code, name);
    });

    // Start game (host)
    $('btn-start-game').addEventListener('click', async () => {
      try { await socketService.startGame(); }
      catch (err) { this._showRoomStatus(err.message); }
    });

    // Leave room
    $('btn-leave-room').addEventListener('click', async () => {
      try { await socketService.leaveRoom(); this.currentRoom = null; this._showSection('lobby-menu'); }
      catch (err) { console.error(err); }
    });

    // Server events
    socketService.on('room:playerJoined', (data) => this._updateRoomUI(data.roomInfo));
    socketService.on('room:playerLeft', (data) => this._updateRoomUI(data.roomInfo));

    socketService.on('game:started', (data) => {
      this.hide();
      this.onGameStart({
        mode: 'online',
        gameState: data.gameState,
        roomInfo: data.roomInfo,
        myColor: socketService.myColor,
      });
    });

    socketService.on('player:disconnected', (data) => {
      this._showRoomStatus(`${data.color} disconnected. Reconnecting in ${data.timeout}s...`);
    });
    socketService.on('player:reconnected', (data) => {
      this._showRoomStatus(`${data.color} reconnected!`);
    });
  }

  _showPlayerPreview(count) {
    const preview = document.getElementById('player-preview');
    if (!preview) return;
    const allColors = {
      Red: '#D32F2F',
      Green: '#2E7D32',
      Yellow: '#F9A825',
      Blue: '#1565C0',
    };
    // Must match GameEngine.createGame player sets (opposite corners for 2p)
    const playerSets = {
      2: ['Red', 'Yellow'],           // diagonal opposites
      3: ['Red', 'Green', 'Yellow'],  // maximize spacing
      4: ['Red', 'Green', 'Yellow', 'Blue'],
    };
    const active = playerSets[count] || playerSets[4];
    preview.innerHTML = active.map(name => `
      <div class="preview-player">
        <span class="preview-dot" style="background:${allColors[name]}"></span>
        <span class="preview-name">${name}</span>
      </div>
    `).join('');
  }

  _resetPlayerCountButtons() {
    this.container.querySelectorAll('.player-count-btn').forEach(b => b.classList.remove('selected'));
    const startBtn = document.getElementById('btn-start-offline');
    if (startBtn) { startBtn.disabled = true; startBtn.classList.add('disabled'); }
    const preview = document.getElementById('player-preview');
    if (preview) preview.innerHTML = '';
  }

  async _connectToServer() {
    const statusDot = this.container.querySelector('.status-dot');
    const statusText = this.container.querySelector('.status-text');
    try {
      statusText.textContent = 'Connecting...';
      statusDot.style.background = '#FDD835';
      await socketService.connect();
      statusText.textContent = 'Connected';
      statusDot.style.background = '#43A047';
    } catch (err) {
      statusText.textContent = 'Connection failed';
      statusDot.style.background = '#E53935';
      throw err;
    }
  }

  async _doQuickMatch(name) {
    try {
      const result = await socketService.quickMatch(name);
      this.currentRoom = result.roomInfo;
      this._updateRoomUI(result.roomInfo);
      this._showSection('lobby-room');
    } catch (err) { this._showRoomStatus(err.message); }
  }

  async _doCreateRoom(name) {
    try {
      const result = await socketService.createRoom(name);
      this.currentRoom = result.roomInfo;
      this._updateRoomUI(result.roomInfo);
      this._showSection('lobby-room');
    } catch (err) { this._showRoomStatus(err.message); }
  }

  async _doJoinRoom(code, name) {
    try {
      const result = await socketService.joinRoom(code, name);
      this.currentRoom = result.roomInfo;
      this._updateRoomUI(result.roomInfo);
      this._showSection('lobby-room');
    } catch (err) {
      this._showRoomStatus(err.message);
      document.getElementById('room-code-input')?.classList.add('error');
      setTimeout(() => document.getElementById('room-code-input')?.classList.remove('error'), 1000);
    }
  }

  _updateRoomUI(roomInfo) {
    this.currentRoom = roomInfo;
    const codeEl = document.getElementById('room-code-value');
    const playersEl = document.getElementById('room-players');
    const startBtn = document.getElementById('btn-start-game');

    if (codeEl) codeEl.textContent = roomInfo.roomId;

    if (playersEl) {
      playersEl.innerHTML = roomInfo.players.map(p => `
        <div class="room-player-slot ${p.connected ? '' : 'disconnected'}">
          <div class="slot-color" style="background:${this._getColorHex(p.color)}"></div>
          <span class="slot-name">${p.displayName}</span>
          <span class="slot-badge">${p.color === roomInfo.hostColor ? '👑' : ''}</span>
        </div>
      `).join('');

      for (let i = roomInfo.players.length; i < roomInfo.maxPlayers; i++) {
        playersEl.innerHTML += `
          <div class="room-player-slot empty">
            <div class="slot-color"></div>
            <span class="slot-name">Waiting...</span>
          </div>
        `;
      }
    }

    if (startBtn) {
      const isHost = socketService.myColor === roomInfo.hostColor;
      startBtn.style.display = isHost && roomInfo.players.length >= 2 ? 'flex' : 'none';
    }

    this._showRoomStatus(`${roomInfo.players.length}/${roomInfo.maxPlayers} players`);
  }

  _showRoomStatus(msg) {
    const el = document.getElementById('room-status-msg');
    if (el) el.textContent = msg;
  }

  _showSection(sectionId) {
    const sections = this.container.querySelectorAll('.lobby-section');
    sections.forEach(s => s.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'flex';
  }

  _getColorHex(color) {
    const map = { red: '#D32F2F', green: '#2E7D32', yellow: '#F9A825', blue: '#1565C0' };
    return map[color] || '#888';
  }

  show() { if (this.container) this.container.style.display = 'flex'; }
  hide() { if (this.container) this.container.style.display = 'none'; }
  destroy() { if (this.container) this.container.remove(); }
}
