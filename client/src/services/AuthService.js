/**
 * RAJU LUDO — AUTH SERVICE (Client)
 * Handles registration, login, and token management.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api`;

class AuthService {
  constructor() {
    this.token = localStorage.getItem('raju_ludo_token');
    this.user = null;
    this._loadUser();
  }

  _loadUser() {
    const stored = localStorage.getItem('raju_ludo_user');
    if (stored) {
      try { this.user = JSON.parse(stored); } catch { this.user = null; }
    }
  }

  _saveAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('raju_ludo_token', token);
    localStorage.setItem('raju_ludo_user', JSON.stringify(user));
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('raju_ludo_token');
    localStorage.removeItem('raju_ludo_user');
  }

  isLoggedIn() {
    return !!this.token;
  }

  async register(username, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    this._saveAuth(data.token, data.user);
    return data.user;
  }

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this._saveAuth(data.token, data.user);
    return data.user;
  }

  async getProfile() {
    if (!this.token) return null;
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) { this.clearAuth(); return null; }
    const data = await res.json();
    this.user = data.user;
    localStorage.setItem('raju_ludo_user', JSON.stringify(data.user));
    return data.user;
  }

  async getLeaderboard() {
    const res = await fetch(`${API_BASE}/auth/leaderboard`);
    const data = await res.json();
    return data.leaderboard || [];
  }

  async getBalance() {
    if (!this.token) return 0;
    const res = await fetch(`${API_BASE}/economy/balance`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.coins;
  }

  logout() {
    this.clearAuth();
  }
}

const authService = new AuthService();
export default authService;
