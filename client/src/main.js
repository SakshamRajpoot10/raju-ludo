/**
 * RAJU LUDO — MAIN GAME CONTROLLER
 * Orchestrates Three.js scene, game engine, lobby, and multiplayer.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

import GameEngine from './engine/GameEngine.js';
import { GAME_TYPE, GAME_STATUS, PLAYERS, PLAYER_CONFIG, PIECES_PER_PLAYER } from './engine/constants.js';
import { getValidMoves } from './engine/helpers.js';
import { createBoard, COLORS } from './board/BoardRenderer.js';
import { createPiece, animateHopPath, animateKill, animateUnlock, setHighlight } from './board/PieceRenderer.js';
import { createDiceMesh, DicePhysics } from './board/DiceRenderer.js';
import { getWorldPosition } from './board/CoordinateMap.js';
import { LobbyUI } from './services/LobbyUI.js';
import { HomeUI } from './services/HomeUI.js';
import { ChatUI } from './services/ChatUI.js';
import socketService from './services/SocketService.js';

class LudoGame {
  constructor(container) {
    this.container = container;
    this.pieces = {};
    this.gameState = null;
    this.dicePhysics = new DicePhysics();
    this.isProcessing = false;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.highlightedPieces = [];
    this.mode = 'offline'; // 'offline' | 'online'
    this.myColor = null;

    this._initScene();
    this._initBoard();
    this._initPieces();
    this._initDice();
    this._initUI();
    this._initControls();
    this._initEvents();
    this._animate();

    // Hide game HUD initially
    document.getElementById('hud').style.display = 'none';

    // Create Chat (Ludo King-style bubbles)
    this.chat = new ChatUI();

    // Create Lobby (hidden initially)
    this.lobby = new LobbyUI((config) => this._onGameStart(config));
    this.lobby.hide();

    // Show Home Dashboard first
    this.home = new HomeUI(() => {
      // When 'Play Now' is clicked, show the lobby
      this.lobby.show();
    });
  }

  _onGameStart(config) {
    this.mode = config.mode;
    document.getElementById('hud').style.display = 'block';

    if (config.mode === 'offline') {
      // Disable chat in offline mode
      this.chat.disable();

      // Create game with selected player count (2, 3, or 4)
      const playerCount = config.playerCount || 4;
      this.gameState = GameEngine.createGame(GAME_TYPE.LUDO, playerCount);

      // Hide pieces for players not in this game
      this._hideInactivePlayers();

      this._syncPiecePositions();
      this._updateUI();
      this._showMessage(`${this.gameState.currentPlayer.toUpperCase()}'s turn — Roll the dice!`);
    } else {
      // Enable chat for online modes
      this.chat.enable();

      this.myColor = config.myColor;
      this.gameState = config.gameState;
      this._hideInactivePlayers();
      this._syncPiecePositions();
      this._updateUI();
      this._setupOnlineListeners();
      this._showMessage(`Online game! You are ${this.myColor.toUpperCase()}.`);
    }
  }

  _setupOnlineListeners() {
    socketService.on('game:diceRolled', async (data) => {
      this.gameState = data.gameState;
      this.diceValueDisplay.textContent = data.diceValue;
      this._animateDiceDisplay(data.diceValue);
      await this.dicePhysics.roll(data.diceValue);

      if (data.gameState.turnPhase === 'MOVE' && data.gameState.currentPlayer === this.myColor) {
        this._highlightValidPieces(data.validMoves);
        this._showMessage(`Rolled ${data.diceValue}! Select a piece.`);
      } else {
        this._showMessage(`${data.rolledBy.toUpperCase()} rolled ${data.diceValue}`);
      }
      this._updateUI();
    });

    socketService.on('game:pieceMoved', async (data) => {
      for (const event of data.events) {
        await this._processEvent(event);
      }
      this.gameState = data.gameState;
      this._updateUI();
      if (this.gameState.currentPlayer === this.myColor) {
        this._showMessage("Your turn! Roll the dice.");
      }
    });

    socketService.on('game:over', (data) => {
      this.gameState = data.gameState;
      this._showGameOver();
    });

    socketService.on('player:disconnected', (data) => {
      this._flashMessage(`⚠️ ${data.color.toUpperCase()} disconnected`, 0xFDD835);
    });

    socketService.on('player:reconnected', (data) => {
      this._flashMessage(`✅ ${data.color.toUpperCase()} reconnected`, 0x43A047);
    });
  }

  _syncPiecePositions() {
    if (!this.gameState) return;
    for (const [color, data] of Object.entries(this.gameState.players)) {
      data.pieces.forEach((piece, i) => {
        const mesh = this.pieces[`${color}_${i}`];
        if (!mesh) return;
        const pos = getWorldPosition(piece.position, color, i);
        if (pos) {
          mesh.position.set(pos.x, pos.y, pos.z);
        }
      });
    }
  }

  _hideInactivePlayers() {
    const activePlayers = this.gameState ? Object.keys(this.gameState.players) : [];
    ['red', 'green', 'yellow', 'blue'].forEach(color => {
      const isActive = activePlayers.includes(color);
      for (let i = 0; i < PIECES_PER_PLAYER; i++) {
        const mesh = this.pieces[`${color}_${i}`];
        if (mesh) mesh.visible = isActive;
      }
    });
  }

  _initScene() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0510); // Deep galaxy purple
    this.scene.fog = new THREE.FogExp2(0x0b0510, 0.012);

    // 360 Degree Starry Scene
    const starsGeo = new THREE.BufferGeometry();
    const starsVerts = [];
    for(let i = 0; i < 2000; i++) {
      starsVerts.push((Math.random()-0.5)*300, (Math.random()-0.5)*300, (Math.random()-0.5)*300);
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsVerts, 3));
    const starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.3, transparent: true, opacity: 0.6});
    const starField = new THREE.Points(starsGeo, starsMat);
    this.scene.add(starField);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 25, 15);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2.3;
    this.controls.target.set(0, 0, 0);

    // Lighting — brighter for vivid colors
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const main = new THREE.DirectionalLight(0xffffff, 1.5);
    main.position.set(8, 18, 8);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.camera.near = 0.1;
    main.shadow.camera.far = 40;
    main.shadow.camera.left = -12;
    main.shadow.camera.right = 12;
    main.shadow.camera.top = 12;
    main.shadow.camera.bottom = -12;
    this.scene.add(main);

    const fill = new THREE.DirectionalLight(0x6666ff, 0.3);
    fill.position.set(-6, 12, -6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff8844, 0.2);
    rim.position.set(0, 5, -10);
    this.scene.add(rim);

    // Dark ground
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.9, metalness: 0.05 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.25;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _initBoard() {
    this.board = createBoard();
    this.scene.add(this.board);
  }

  _initPieces() {
    [PLAYERS.RED, PLAYERS.GREEN, PLAYERS.YELLOW, PLAYERS.BLUE].forEach(player => {
      for (let i = 0; i < PIECES_PER_PLAYER; i++) {
        const piece = createPiece(player, i);
        const pos = getWorldPosition(`${player}_base`, player, i);
        if (pos) piece.position.set(pos.x, pos.y, pos.z);
        this.pieces[`${player}_${i}`] = piece;
        this.scene.add(piece);
      }
    });
  }

  _initDice() {
    this.diceMesh = createDiceMesh();
    this.diceMesh.position.set(8, 0.25, 0);
    this.scene.add(this.diceMesh);
    this.dicePhysics.setDiceMesh(this.diceMesh);
  }

  _initUI() {
    this.playerIndicator = document.getElementById('player-indicator');
    this.diceValueDisplay = document.getElementById('dice-value');
    this.rollButton = document.getElementById('roll-btn');
    this.messageDisplay = document.getElementById('message');
  }

  _initControls() {
    this.rollButton.addEventListener('click', () => this._handleRoll());
    this.renderer.domElement.addEventListener('click', (e) => this._handleClick(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this._handleHover(e));
    // Touch support for mobile
    this.renderer.domElement.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this._handleClick({ clientX: touch.clientX, clientY: touch.clientY });
      }
    }, { passive: false });
  }

  _initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async _handleRoll() {
    if (this.isProcessing) return;
    if (!this.gameState || this.gameState.gameStatus !== GAME_STATUS.IN_PROGRESS) return;
    if (this.gameState.turnPhase !== 'ROLL' && this.gameState.turnPhase !== 'EXTRA_ROLL') return;

    // In online mode, only the current player can roll
    if (this.mode === 'online') {
      if (this.gameState.currentPlayer !== this.myColor) {
        this._showMessage("Not your turn!");
        return;
      }
      this.isProcessing = true;
      this.rollButton.disabled = true;
      try {
        await socketService.rollDice();
      } catch (err) {
        this._showMessage(err.message);
      }
      this.rollButton.disabled = false;
      this.isProcessing = false;
      return;
    }

    // Offline mode
    this.isProcessing = true;
    this.rollButton.disabled = true;
    this.rollButton.classList.add('rolling');

    const diceValue = GameEngine.rollDice();
    await this.dicePhysics.roll(diceValue);

    const { state: newState } = GameEngine.applyDiceRoll(this.gameState, diceValue);
    this.gameState = newState;
    this.diceValueDisplay.textContent = diceValue;
    this._animateDiceDisplay(diceValue);

    if (this.gameState.turnPhase === 'MOVE') {
      const validMoves = GameEngine.getValidMoves(this.gameState, diceValue);
      this._highlightValidPieces(validMoves);
      this._showMessage(`Rolled ${diceValue}! Select a piece to move.`);
      this.isProcessing = false;
    } else if (this.gameState.turnPhase === 'EXTRA_ROLL') {
      this._showMessage(`Rolled ${diceValue}! Bonus roll!`);
      this.rollButton.disabled = false;
      this.rollButton.classList.remove('rolling');
      this.isProcessing = false;
    } else {
      this._showMessage(`Rolled ${diceValue} — No valid moves. ${this.gameState.currentPlayer.toUpperCase()}'s turn.`);
      this.rollButton.disabled = false;
      this.rollButton.classList.remove('rolling');
      this.isProcessing = false;
    }
    this._updateUI();
  }

  async _handleClick(event) {
    if (this.isProcessing) return;
    if (!this.gameState || this.gameState.turnPhase !== 'MOVE') return;
    if (this.mode === 'online' && this.gameState.currentPlayer !== this.myColor) return;

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const player = this.gameState.currentPlayer;
    const validMoves = GameEngine.getValidMoves(this.gameState, this.gameState.diceValue);
    const validPieceIds = validMoves.map(m => `${player}_${m.pieceIndex}`);

    for (const pieceId of validPieceIds) {
      const piece = this.pieces[pieceId];
      if (!piece) continue;
      const intersects = this.raycaster.intersectObjects(piece.children, true);
      if (intersects.length > 0) {
        const pieceIndex = parseInt(pieceId.split('_')[1]);
        if (this.mode === 'online') {
          this.isProcessing = true;
          this._clearHighlights();
          try { await socketService.movePiece(pieceIndex); } catch (e) { this._showMessage(e.message); }
          this.isProcessing = false;
        } else {
          await this._executePieceMove(pieceIndex);
        }
        return;
      }
    }
  }

  _handleHover(event) {
    if (!this.gameState || this.gameState.turnPhase !== 'MOVE') return;
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.renderer.domElement.style.cursor = 'default';
    const player = this.gameState.currentPlayer;
    const validMoves = GameEngine.getValidMoves(this.gameState, this.gameState.diceValue);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    for (const m of validMoves) {
      const piece = this.pieces[`${player}_${m.pieceIndex}`];
      if (!piece) continue;
      if (this.raycaster.intersectObjects(piece.children, true).length > 0) {
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
  }

  async _executePieceMove(pieceIndex) {
    this.isProcessing = true;
    this._clearHighlights();
    const { state: newState, events } = GameEngine.applyMove(this.gameState, pieceIndex);
    for (const event of events) await this._processEvent(event);
    this.gameState = newState;
    this._updateUI();

    if (this.gameState.gameStatus === GAME_STATUS.FINISHED) {
      this._showGameOver();
      this.isProcessing = false;
      return;
    }
    if (this.gameState.turnPhase === 'EXTRA_ROLL') {
      this._showMessage(`Bonus turn! ${this.gameState.currentPlayer.toUpperCase()} rolls again!`);
    } else {
      this._showMessage(`${this.gameState.currentPlayer.toUpperCase()}'s turn — Roll the dice!`);
    }
    this.rollButton.disabled = false;
    this.rollButton.classList.remove('rolling');
    this.isProcessing = false;
  }

  async _processEvent(event) {
    const piece = this.pieces[`${event.player}_${event.pieceIndex}`];
    switch (event.type) {
      case 'PIECE_UNLOCKED':
        if (piece) await animateUnlock(piece, event.to, event.player, event.pieceIndex);
        break;
      case 'PIECE_MOVED':
        if (piece && event.path) await animateHopPath(piece, event.path, event.player, event.pieceIndex);
        break;
      case 'PIECE_KILLED':
        const victim = this.pieces[`${event.victim}_${event.victimPieceIndex}`];
        if (victim) await animateKill(victim, event.victim, event.victimPieceIndex);
        this._flashMessage('💀 KILLED!', COLORS[event.killer].main);
        break;
      case 'PIECE_FINISHED':
        this._flashMessage('🏠 HOME!', COLORS[event.player].main);
        break;
      case 'PLAYER_FINISHED':
        this._flashMessage(`🏆 ${event.player.toUpperCase()} #${event.rank}!`, COLORS[event.player].main);
        break;
    }
  }

  _highlightValidPieces(validMoves) {
    this._clearHighlights();
    const player = this.gameState.currentPlayer;
    validMoves.forEach(move => {
      const piece = this.pieces[`${player}_${move.pieceIndex}`];
      if (piece) { setHighlight(piece, true); this.highlightedPieces.push(piece); }
    });
  }

  _clearHighlights() {
    this.highlightedPieces.forEach(p => setHighlight(p, false));
    this.highlightedPieces = [];
  }

  _updateUI() {
    if (!this.gameState) return;
    const player = this.gameState.currentPlayer;
    const colorHex = '#' + COLORS[player].main.toString(16).padStart(6, '0');
    if (this.playerIndicator) {
      this.playerIndicator.textContent = player.toUpperCase();
      this.playerIndicator.style.color = colorHex;
    }
    ['red', 'green', 'yellow', 'blue'].forEach(c => {
      const el = document.getElementById(`score-${c}`);
      const card = document.getElementById(`player-card-${c}`);
      const isActive = !!this.gameState.players[c];

      // Hide cards for players not in this game
      if (card) {
        card.style.display = isActive ? '' : 'none';
        card.classList.toggle('active', c === player);
      }
      if (el && isActive) el.textContent = `${this.gameState.players[c].finishedCount}/${PIECES_PER_PLAYER}`;
    });
    // In online mode, only enable roll button on your turn
    if (this.mode === 'online') {
      this.rollButton.disabled = this.gameState.currentPlayer !== this.myColor ||
        (this.gameState.turnPhase !== 'ROLL' && this.gameState.turnPhase !== 'EXTRA_ROLL');
    }
  }

  _showMessage(text) {
    if (this.messageDisplay) {
      this.messageDisplay.textContent = text;
      gsap.fromTo(this.messageDisplay, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
    }
  }

  _flashMessage(text, color) {
    const flash = document.getElementById('flash-message');
    if (flash) {
      flash.textContent = text;
      flash.style.color = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;
      gsap.fromTo(flash, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)',
        onComplete: () => gsap.to(flash, { opacity: 0, delay: 1, duration: 0.5 }) });
    }
  }

  _animateDiceDisplay(value) {
    if (this.diceValueDisplay) {
      gsap.fromTo(this.diceValueDisplay, { scale: 2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
    }
  }

  _showGameOver() {
    const w = this.gameState.winner;
    this._showMessage(`🎉 ${w.toUpperCase()} WINS! 🎉`);
    this._flashMessage(`🏆 ${w.toUpperCase()} IS THE CHAMPION! 🏆`, COLORS[w].main);
    gsap.to(this.camera.position, { y: 22, duration: 2, ease: 'power2.inOut' });
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.dicePhysics.update();
    this.renderer.render(this.scene, this.camera);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (container) window.game = new LudoGame(container);
});

export default LudoGame;
