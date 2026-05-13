/**
 * RAJU LUDO — HOME DASHBOARD UI
 * Full home screen with authentication (login/register), user profile,
 * game statistics, match history, and leaderboard.
 */

import authService from './AuthService.js';

const RANK_COLORS = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Platinum: '#6DD5ED',
  Diamond: '#B9F2FF',
  Legend: '#FF6B6B',
};

const RANK_ICONS = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
  Platinum: '💠',
  Diamond: '💎',
  Legend: '🔥',
};

const AVATAR_OPTIONS = ['🎮', '👤', '🎯', '🎲', '👑', '⭐', '🦁', '🐯', '🦊', '🐺', '🐉', '🌟'];

export class HomeUI {
  constructor(onPlayClicked) {
    this.onPlayClicked = onPlayClicked;
    this.container = null;
    this._build();
  }

  _build() {
    this.container = document.createElement('div');
    this.container.id = 'home-overlay';

    if (authService.isLoggedIn() && authService.user) {
      this._showDashboard();
    } else {
      this._showAuthScreen();
    }

    document.body.appendChild(this.container);
  }

  // ── AUTH SCREEN ────────────────────────────────────────────────────────

  _showAuthScreen() {
    this.container.innerHTML = `
      <div class="home-panel auth-panel">
        <div class="home-header">
          <span class="home-logo">🎲</span>
          <h1 class="home-title">Raju Ludo</h1>
          <p class="home-subtitle">Login or create an account to play</p>
        </div>

        <!-- Login Form -->
        <div id="auth-login" class="auth-form">
          <h2>Welcome Back</h2>
          <input type="email" id="login-email" placeholder="Email" class="auth-input" />
          <input type="password" id="login-password" placeholder="Password" class="auth-input" />
          <button class="auth-btn primary" id="btn-login">Login</button>
          <p class="auth-switch">Don't have an account? <a href="#" id="switch-to-register">Sign Up</a></p>
          <div class="auth-error" id="login-error"></div>
        </div>

        <!-- Register Form -->
        <div id="auth-register" class="auth-form" style="display:none">
          <h2>Create Account</h2>
          <input type="text" id="reg-username" placeholder="Username (3-20 chars)" class="auth-input" maxlength="20" />
          <input type="email" id="reg-email" placeholder="Email" class="auth-input" />
          <input type="password" id="reg-password" placeholder="Password (6+ chars)" class="auth-input" />
          <button class="auth-btn primary" id="btn-register">Create Account</button>
          <p class="auth-switch">Already have an account? <a href="#" id="switch-to-login">Login</a></p>
          <div class="auth-error" id="reg-error"></div>
        </div>

        <div class="auth-divider"><span>or</span></div>
        <button class="auth-btn guest" id="btn-guest" style="justify-content:center; width:100%">
          <span>🎮</span> Play as Guest
        </button>
      </div>
    `;

    // Event listeners
    this.container.querySelector('#switch-to-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.container.querySelector('#auth-login').style.display = 'none';
      this.container.querySelector('#auth-register').style.display = 'flex';
    });

    this.container.querySelector('#switch-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.container.querySelector('#auth-register').style.display = 'none';
      this.container.querySelector('#auth-login').style.display = 'flex';
    });

    this.container.querySelector('#btn-login').addEventListener('click', () => this._handleLogin());
    this.container.querySelector('#btn-register').addEventListener('click', () => this._handleRegister());
    this.container.querySelector('#btn-guest').addEventListener('click', () => {
      this.hide();
      this.onPlayClicked();
    });

    // Enter key support
    ['login-email', 'login-password'].forEach(id => {
      this.container.querySelector(`#${id}`).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._handleLogin();
      });
    });
    ['reg-username', 'reg-email', 'reg-password'].forEach(id => {
      this.container.querySelector(`#${id}`).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._handleRegister();
      });
    });
  }

  async _handleLogin() {
    const email = this.container.querySelector('#login-email').value.trim();
    const password = this.container.querySelector('#login-password').value;
    const errorEl = this.container.querySelector('#login-error');

    if (!email || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    try {
      errorEl.textContent = '';
      await authService.login(email, password);
      this.container.innerHTML = '';
      this._showDashboard();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  async _handleRegister() {
    const username = this.container.querySelector('#reg-username').value.trim();
    const email = this.container.querySelector('#reg-email').value.trim();
    const password = this.container.querySelector('#reg-password').value;
    const errorEl = this.container.querySelector('#reg-error');

    if (!username || !email || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    try {
      errorEl.textContent = '';
      await authService.register(username, email, password);
      this.container.innerHTML = '';
      this._showDashboard();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────

  _showDashboard() {
    const user = authService.user;
    if (!user) return this._showAuthScreen();

    const rankColor = RANK_COLORS[user.rank] || '#888';
    const rankIcon = RANK_ICONS[user.rank] || '🏅';
    const winRate = user.stats.gamesPlayed > 0
      ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100)
      : 0;
    const avatarEmoji = AVATAR_OPTIONS[parseInt(user.avatar) || 0] || '🎮';

    this.container.innerHTML = `
      <div class="home-panel dashboard-panel">
        <!-- Profile Header -->
        <div class="profile-header">
          <div class="profile-avatar">${avatarEmoji}</div>
          <div class="profile-info">
            <h2 class="profile-name">${user.username}</h2>
            <div class="profile-rank" style="color: ${rankColor}">
              ${rankIcon} ${user.rank}
            </div>
          </div>
          <button class="icon-btn" id="btn-logout" title="Logout">🚪</button>
        </div>

        <!-- Coins & XP Bar -->
        <div class="stats-bar">
          <div class="stat-chip coins">
            <span class="chip-icon">💰</span>
            <span class="chip-value">${(user.coins || 0).toLocaleString()}</span>
            <span class="chip-label">Coins</span>
          </div>
          <div class="stat-chip xp">
            <span class="chip-icon">⚡</span>
            <span class="chip-value">${(user.xp || 0).toLocaleString()}</span>
            <span class="chip-label">XP</span>
          </div>
          <div class="stat-chip winrate">
            <span class="chip-icon">🎯</span>
            <span class="chip-value">${winRate}%</span>
            <span class="chip-label">Win Rate</span>
          </div>
        </div>

        <!-- Quick Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-num">${user.stats.gamesPlayed}</span>
            <span class="stat-title">Games Played</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">${user.stats.gamesWon}</span>
            <span class="stat-title">Wins</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">${user.stats.totalKills}</span>
            <span class="stat-title">Total Kills</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">${user.stats.bestWinStreak}</span>
            <span class="stat-title">Best Streak</span>
          </div>
        </div>

        <!-- Match History -->
        <div class="section-header">
          <h3>Recent Matches</h3>
        </div>
        <div class="match-history" id="match-history">
          ${(user.matchHistory || []).length === 0
            ? '<p class="empty-msg">No matches yet — start playing!</p>'
            : (user.matchHistory || []).slice(0, 5).map(m => `
              <div class="match-row ${m.result}">
                <span class="match-type">${m.gameType === 'LUDO' ? '🎲' : '🐍'}</span>
                <span class="match-result">${m.result === 'win' ? '🏆 WIN' : '❌ LOSS'}</span>
                <span class="match-pos">#${m.position}</span>
                <span class="match-coins ${m.coinsChange >= 0 ? 'positive' : 'negative'}">
                  ${m.coinsChange >= 0 ? '+' : ''}${m.coinsChange}
                </span>
              </div>
            `).join('')}
        </div>

        <!-- Play Button -->
        <button class="play-btn" id="btn-play-now">
          <span class="play-icon">🎲</span>
          <span class="play-text">Play Now</span>
        </button>
      </div>
    `;

    // Event listeners
    this.container.querySelector('#btn-logout').addEventListener('click', () => {
      authService.logout();
      this.container.innerHTML = '';
      this._showAuthScreen();
    });

    this.container.querySelector('#btn-play-now').addEventListener('click', () => {
      this.hide();
      this.onPlayClicked();
    });
  }

  show() {
    if (this.container) {
      this.container.style.display = 'flex';
      // Refresh user data if logged in
      if (authService.isLoggedIn()) {
        authService.getProfile().then(user => {
          if (user) {
            this.container.innerHTML = '';
            this._showDashboard();
          }
        }).catch(() => {});
      }
    }
  }

  hide() {
    if (this.container) this.container.style.display = 'none';
  }

  destroy() {
    if (this.container) this.container.remove();
  }
}
