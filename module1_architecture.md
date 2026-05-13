# Module 1: Unified Game Engine — Architecture Document

> [!IMPORTANT]
> This document covers **Module 1 only**. All subsequent modules (UI, Multiplayer, AI, Economy) will build on this foundation. Review and approve before proceeding.

---

## 1. Project Folder Structure

```
d:\Raju Ludo\
├── client/                          # React Native App
│   ├── src/
│   │   ├── engine/                  # 🎯 MODULE 1 — Core Game Logic (this phase)
│   │   │   ├── GameEngine.js        # Unified engine interface
│   │   │   ├── LudoLogic.js         # Ludo rules, state transitions
│   │   │   ├── SnakeLadderLogic.js  # Snakes & Ladders rules
│   │   │   ├── constants.js         # Board schemas, cell maps, safe zones
│   │   │   ├── helpers.js           # Pure utility functions
│   │   │   └── __tests__/           # Unit tests for deterministic logic
│   │   │       ├── LudoLogic.test.js
│   │   │       ├── SnakeLadderLogic.test.js
│   │   │       └── GameEngine.test.js
│   │   │
│   │   ├── components/              # Module 2 — Board, Piece, Dice UI
│   │   ├── screens/                 # Module 2 — Game screens
│   │   ├── store/                   # Module 3 — Redux Toolkit slices
│   │   ├── services/                # Module 3 — Socket.io client
│   │   ├── ai/                      # Module 4 — Bot logic
│   │   ├── assets/                  # Lottie files, images, fonts
│   │   └── utils/                   # Shared utilities
│   ├── App.tsx
│   └── package.json
│
├── server/                          # Node.js Backend
│   ├── src/
│   │   ├── engine/                  # Shared engine (mirrored for server-authority)
│   │   ├── socket/                  # Module 3 — Socket.io handlers
│   │   ├── routes/                  # Module 5 — REST API (auth, economy)
│   │   ├── models/                  # Module 5 — MongoDB schemas
│   │   ├── middleware/              # Module 5 — JWT, rate-limiting
│   │   └── config/                  # Environment config
│   ├── server.js
│   └── package.json
│
└── docs/                            # Architecture documents
    └── MODULE_1_ARCHITECTURE.md
```

---

## 2. Ludo Board — Coordinate Map Schema

### 2.1 Cell ID System

The Ludo board is decomposed into **logical cell IDs** — no absolute pixel positions anywhere in the engine.

| Zone | Cell ID Range | Description |
|------|---------------|-------------|
| Main Track | `cell_0` → `cell_51` | 52 shared cells around the perimeter |
| Red Home Column | `red_home_0` → `red_home_5` | 6 cells leading to Red's center |
| Green Home Column | `green_home_0` → `green_home_5` | 6 cells leading to Green's center |
| Yellow Home Column | `yellow_home_0` → `yellow_home_5` | 6 cells leading to Yellow's center |
| Blue Home Column | `blue_home_0` → `blue_home_5` | 6 cells leading to Blue's center |
| Base (Yard) | `red_base`, `green_base`, `yellow_base`, `blue_base` | Starting yards |
| Finished | `finished` | Piece has reached home center |

### 2.2 Player Entry & Home-Turn Points

| Player | Start Cell (after unlocking) | Entry to Home Column (from main track) | Safe Star Cell |
|--------|-----|----|------|
| Red | `cell_0` | After `cell_50` → `red_home_0` | `cell_8` |
| Green | `cell_13` | After `cell_11` → `green_home_0` | `cell_21` |
| Yellow | `cell_26` | After `cell_24` → `yellow_home_0` | `cell_34` |
| Blue | `cell_39` | After `cell_37` → `blue_home_0` | `cell_47` |

### 2.3 Safe Zones (cannot be killed)

```
SAFE_CELLS = [cell_0, cell_8, cell_13, cell_21, cell_26, cell_34, cell_39, cell_47]
```
All home-column cells are also inherently safe.

---

## 3. State Machine Design

### 3.1 Game State Object (Ludo)

```javascript
{
  gameType: 'LUDO',
  currentPlayer: 'red',          // Whose turn it is
  turnOrder: ['red', 'green', 'yellow', 'blue'],
  players: {
    red:    { pieces: [pieceState, pieceState, pieceState, pieceState], finishedCount: 0 },
    green:  { pieces: [pieceState, pieceState, pieceState, pieceState], finishedCount: 0 },
    yellow: { pieces: [pieceState, pieceState, pieceState, pieceState], finishedCount: 0 },
    blue:   { pieces: [pieceState, pieceState, pieceState, pieceState], finishedCount: 0 },
  },
  diceValue: null,               // Last rolled value (1-6)
  consecutiveSixes: 0,           // Track triple-six penalty
  gameStatus: 'IN_PROGRESS',     // IN_PROGRESS | FINISHED
  winner: null,                  // Player color or null
  rankings: [],                  // Order of finish for multiplayer
  moveHistory: [],               // Audit trail
}
```

### 3.2 Piece State

```javascript
{
  id: 'red_0',
  position: 'red_base',  // Cell ID or 'base' or 'finished'
  distanceTraveled: 0,    // Total cells moved (max 57 to finish)
}
```

---

## 4. Deterministic Engine Rules

### 4.1 Core Ludo Rules (Pure Functions)

| Rule | Logic |
|------|-------|
| **Unlock** | Roll a 6 → move one piece from `base` to `start_cell` |
| **Move** | Advance piece by `diceValue` cells along the track |
| **Home Entry** | When `distanceTraveled + diceValue == 57`, piece enters `finished` |
| **Overshoot** | If `distanceTraveled + diceValue > 57`, move is **invalid** |
| **Collision (Kill)** | Landing on an opponent's piece on a non-safe cell → opponent returns to `base` |
| **Safe Zone** | Pieces on safe cells or home columns cannot be killed |
| **Bonus Turn** | Rolling a 6, or killing an opponent → player gets another turn |
| **Triple Six** | Three consecutive 6s → turn forfeited, no moves applied |
| **Block/Stack** | Two same-color pieces on one cell form a block (cannot be killed) |
| **Win Condition** | All 4 pieces reach `finished` → player wins |
| **Ranking** | First to finish = 1st place. Game continues until all ranked. |

### 4.2 Snakes & Ladders Rules

| Rule | Logic |
|------|-------|
| **Board** | 10×10 grid, cells `sl_1` → `sl_100` |
| **Move** | Advance by `diceValue` |
| **Snake** | Landing on snake head → slide down to tail cell |
| **Ladder** | Landing on ladder base → climb up to top cell |
| **Overshoot** | If `position + diceValue > 100`, move is invalid |
| **Win** | First to reach exactly `sl_100` wins |
| **Bonus** | Rolling a 6 → extra turn |

---

## 5. Key Design Decisions

> [!NOTE]
> The engine is designed to be **platform-agnostic**. It runs identically on client (for offline play) and server (for authoritative multiplayer). No DOM, no React, no side-effects inside the engine.

1. **Pure Functions**: `applyMove(state, action) → newState` — every transition is deterministic and testable.
2. **Shared Engine**: The same `LudoLogic.js` file runs on both client and server via a shared package.
3. **Immutable State**: All state transitions return new objects; never mutate in place.
4. **Action Schema**: Every player action is `{ type, player, pieceId, diceValue }` — serializable for replay.

---

## 6. Files Being Delivered (Module 1)

| File | Purpose |
|------|---------|
| `constants.js` | Cell maps, safe zones, player configs, snake/ladder positions |
| `helpers.js` | Pure utility functions (next cell calculation, distance checks) |
| `LudoLogic.js` | Complete Ludo game state machine |
| `SnakeLadderLogic.js` | Complete Snakes & Ladders state machine |
| `GameEngine.js` | Unified interface that delegates to the correct logic module |
| `LudoLogic.test.js` | Comprehensive unit tests for Ludo rules |
| `SnakeLadderLogic.test.js` | Unit tests for Snakes & Ladders rules |
| `GameEngine.test.js` | Integration tests for the unified engine |
