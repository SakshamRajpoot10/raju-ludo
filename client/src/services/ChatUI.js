/**
 * RAJU LUDO — IN-GAME CHAT (Ludo King style)
 * Floating chat bubbles that pop up and auto-fade after 5 seconds.
 * Works in Quick Match and Room modes only (not offline).
 */

import socketService from './SocketService.js';

const PLAYER_COLORS = {
  red: '#D32F2F',
  green: '#2E7D32',
  yellow: '#F9A825',
  blue: '#1565C0',
};

const BUBBLE_LIFETIME = 5000; // 5 seconds before fade
const MAX_BUBBLES = 5;

export class ChatUI {
  constructor() {
    this.enabled = false;
    this.chatOpen = false;
    this.bubbles = [];
    this._buildDOM();
    this._setupSocketListener();
  }

  _buildDOM() {
    // Chat bubble container (messages appear here)
    this.bubbleContainer = document.createElement('div');
    this.bubbleContainer.id = 'chat-container';
    document.body.appendChild(this.bubbleContainer);

    // Chat toggle button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'chat-toggle-btn';
    this.toggleBtn.innerHTML = '💬';
    this.toggleBtn.title = 'Open chat';
    document.body.appendChild(this.toggleBtn);

    // Chat input bar
    this.inputBar = document.createElement('div');
    this.inputBar.id = 'chat-input-bar';
    this.inputBar.innerHTML = `
      <input type="text" id="chat-input" placeholder="Type a message..." maxlength="100" />
      <button id="chat-send-btn">📤</button>
    `;
    document.body.appendChild(this.inputBar);

    // Events
    this.toggleBtn.addEventListener('click', () => this._toggleChat());

    this.inputBar.querySelector('#chat-send-btn').addEventListener('click', () => this._sendMessage());
    this.inputBar.querySelector('#chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendMessage();
      e.stopPropagation(); // Don't trigger game controls
    });

    // Close chat when clicking outside
    document.addEventListener('click', (e) => {
      if (this.chatOpen && !this.inputBar.contains(e.target) && e.target !== this.toggleBtn) {
        this._closeChat();
      }
    });
  }

  _setupSocketListener() {
    socketService.on('chat:message', (data) => {
      this._showBubble(data.playerColor, data.playerName, data.message);
    });
  }

  /**
   * Enables chat (call when entering an online game mode).
   */
  enable() {
    this.enabled = true;
    this.toggleBtn.classList.add('visible');
  }

  /**
   * Disables chat (call when in offline mode or back in lobby).
   */
  disable() {
    this.enabled = false;
    this.toggleBtn.classList.remove('visible');
    this._closeChat();
    this._clearBubbles();
  }

  _toggleChat() {
    if (this.chatOpen) {
      this._closeChat();
    } else {
      this._openChat();
    }
  }

  _openChat() {
    this.chatOpen = true;
    this.inputBar.classList.add('active');
    this.toggleBtn.style.display = 'none';
    const input = this.inputBar.querySelector('#chat-input');
    input.focus();
  }

  _closeChat() {
    this.chatOpen = false;
    this.inputBar.classList.remove('active');
    if (this.enabled) this.toggleBtn.style.display = 'flex';
  }

  _sendMessage() {
    const input = this.inputBar.querySelector('#chat-input');
    const text = input.value.trim();
    if (!text) return;

    // Send via socket
    socketService.sendChat(text);

    // Show own bubble immediately
    const myColor = socketService.myColor || 'blue';
    this._showBubble(myColor, 'You', text);

    input.value = '';
    this._closeChat();
  }

  /**
   * Shows a chat bubble that auto-fades after BUBBLE_LIFETIME ms.
   */
  _showBubble(playerColor, playerName, message) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = `
      <span class="bubble-color" style="background:${PLAYER_COLORS[playerColor] || '#888'}"></span>
      <span class="bubble-name">${playerName}</span>
      <span class="bubble-text">${this._escapeHtml(message)}</span>
    `;

    this.bubbleContainer.appendChild(bubble);
    this.bubbles.push(bubble);

    // Remove oldest if too many
    while (this.bubbles.length > MAX_BUBBLES) {
      const old = this.bubbles.shift();
      old.remove();
    }

    // Auto-fade after 5 seconds
    setTimeout(() => {
      bubble.classList.add('fading');
      setTimeout(() => {
        bubble.remove();
        this.bubbles = this.bubbles.filter(b => b !== bubble);
      }, 400); // match fade animation duration
    }, BUBBLE_LIFETIME);
  }

  _clearBubbles() {
    this.bubbles.forEach(b => b.remove());
    this.bubbles = [];
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
