/**
 * RAJU LUDO — ENGINE TEST RUNNER
 * Standalone test runner (no Jest dependency). Run with: node src/engine/__tests__/runTests.js
 */

import GameEngine from '../GameEngine.js';
import { GAME_TYPE, GAME_STATUS, PLAYERS, PLAYER_CONFIG, SAFE_CELLS, PIECES_PER_PLAYER } from '../constants.js';
import { createLudoGameState, applyDiceRoll, applyMove, rollDice, buildMovePath } from '../LudoLogic.js';
import { createSLGameState, applySLDiceRoll, applySLMove, executeSLTurn } from '../SnakeLadderLogic.js';
import { getValidMoves, calculateNextPosition, isSafeCell, resolveSnakeOrLadder } from '../helpers.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failed++;
    console.log(`  ❌ ${testName} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    passed++;
    console.log(`  ✅ ${testName}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ═══════════════════════════════════════════════════════════════════════════
// LUDO TESTS
// ═══════════════════════════════════════════════════════════════════════════

section('LUDO: Game Initialization');

const luddoState = createLudoGameState();
assert(luddoState.gameType === GAME_TYPE.LUDO, 'Game type is LUDO');
assert(luddoState.currentPlayer === PLAYERS.RED, 'First player is RED');
assert(luddoState.turnOrder.length === 4, '4 players in turn order');
assert(luddoState.gameStatus === GAME_STATUS.IN_PROGRESS, 'Game is IN_PROGRESS');
assert(luddoState.turnPhase === 'ROLL', 'Initial phase is ROLL');
assert(luddoState.players.red.pieces.length === 4, 'Red has 4 pieces');
assert(luddoState.players.red.pieces[0].position === 'red_base', 'Red piece 0 starts in base');
assert(luddoState.players.red.finishedCount === 0, 'Red has 0 finished pieces');

// 2-player game
const twoPlayerGame = createLudoGameState({ players: [PLAYERS.RED, PLAYERS.YELLOW] });
assert(twoPlayerGame.turnOrder.length === 2, '2-player game has 2 players');

section('LUDO: Dice Rolling');

const afterRoll1 = applyDiceRoll(luddoState, 3);
assert(afterRoll1.diceValue === 3, 'Dice value stored as 3');
// No valid moves (all in base, need 6 to unlock) — should auto-skip
assert(afterRoll1.currentPlayer === PLAYERS.GREEN, 'Auto-skip: turn passes to GREEN when no valid moves with non-6');

const afterRoll6 = applyDiceRoll(luddoState, 6);
assert(afterRoll6.diceValue === 6, 'Dice value stored as 6');
assert(afterRoll6.turnPhase === 'MOVE', 'Phase becomes MOVE after rolling 6 (can unlock)');
assert(afterRoll6.currentPlayer === PLAYERS.RED, 'Still RED\'s turn to move');

section('LUDO: Piece Unlocking');

const validMovesAfter6 = getValidMoves(afterRoll6, PLAYERS.RED, 6);
assert(validMovesAfter6.length > 0, 'Has valid moves after rolling 6');
assert(validMovesAfter6[0].type === 'UNLOCK', 'Move type is UNLOCK');

const { state: afterUnlock, events: unlockEvents } = applyMove(afterRoll6, 0);
assert(afterUnlock.players.red.pieces[0].position === 'cell_0', 'Piece 0 moved to cell_0 (Red start)');
assert(afterUnlock.players.red.pieces[0].distanceTraveled === 0, 'Distance is 0 after unlock');
assert(unlockEvents.some(e => e.type === 'PIECE_UNLOCKED'), 'PIECE_UNLOCKED event emitted');
assert(afterUnlock.turnPhase === 'EXTRA_ROLL', 'Bonus turn after rolling 6');

section('LUDO: Piece Movement');

// Set up a state with a piece on the board
let moveTestState = createLudoGameState();
moveTestState.players.red.pieces[0] = { id: 'red_0', position: 'cell_0', distanceTraveled: 0 };
moveTestState.turnPhase = 'ROLL';

const afterMoveRoll = applyDiceRoll(moveTestState, 4);
assert(afterMoveRoll.turnPhase === 'MOVE', 'Can move piece that is on board');

const { state: afterMove4 } = applyMove(afterMoveRoll, 0);
assert(afterMove4.players.red.pieces[0].position === 'cell_4', 'Piece moved from cell_0 to cell_4');
assert(afterMove4.players.red.pieces[0].distanceTraveled === 4, 'Distance traveled is 4');
assert(afterMove4.currentPlayer === PLAYERS.GREEN, 'Turn passes to GREEN (no bonus)');

section('LUDO: Safe Zones');

assert(isSafeCell('cell_0'), 'cell_0 (Red start) is safe');
assert(isSafeCell('cell_8'), 'cell_8 (Red star) is safe');
assert(isSafeCell('cell_13'), 'cell_13 (Green start) is safe');
assert(isSafeCell('cell_26'), 'cell_26 (Yellow start) is safe');
assert(isSafeCell('cell_39'), 'cell_39 (Blue start) is safe');
assert(isSafeCell('red_home_3'), 'Home column cells are safe');
assert(!isSafeCell('cell_5'), 'cell_5 is NOT safe');

section('LUDO: Collision / Kill');

let killTestState = createLudoGameState();
killTestState.players.red.pieces[0] = { id: 'red_0', position: 'cell_3', distanceTraveled: 3 };
killTestState.players.green.pieces[0] = { id: 'green_0', position: 'cell_5', distanceTraveled: 5 }; // Non-safe cell
killTestState.turnPhase = 'ROLL';

const afterKillRoll = applyDiceRoll(killTestState, 2);
const { state: afterKill, events: killEvents } = applyMove(afterKillRoll, 0);
assert(afterKill.players.red.pieces[0].position === 'cell_5', 'Red lands on cell_5');
assert(afterKill.players.green.pieces[0].position === 'green_base', 'Green piece sent back to base');
assert(killEvents.some(e => e.type === 'PIECE_KILLED'), 'PIECE_KILLED event emitted');
assert(afterKill.turnPhase === 'EXTRA_ROLL', 'Bonus turn after kill');

section('LUDO: No Kill on Safe Cell');

let safeKillState = createLudoGameState();
safeKillState.players.red.pieces[0] = { id: 'red_0', position: 'cell_6', distanceTraveled: 6 };
safeKillState.players.green.pieces[0] = { id: 'green_0', position: 'cell_8', distanceTraveled: 0 }; // cell_8 is SAFE
safeKillState.turnPhase = 'ROLL';

const afterSafeRoll = applyDiceRoll(safeKillState, 2);
const { state: afterSafeMove, events: safeEvents } = applyMove(afterSafeRoll, 0);
assert(afterSafeMove.players.green.pieces[0].position === 'cell_8', 'Green piece NOT killed on safe cell');
assert(!safeEvents.some(e => e.type === 'PIECE_KILLED'), 'No PIECE_KILLED event on safe cell');

section('LUDO: Home Column Entry');

// Red's home turn is at cell_50, entering red_home_0 to red_home_5
const nextPos = calculateNextPosition(PLAYERS.RED, 'cell_50', 50, 3);
assert(nextPos !== null, 'Can enter home column');
assert(nextPos.position === 'red_home_2', 'Enters red_home_2 (50+3=53, home index 2)');

section('LUDO: Overshoot Protection');

const overshoot = calculateNextPosition(PLAYERS.RED, 'red_home_4', 55, 5);
assert(overshoot === null, 'Overshoot returns null (55+5=60 > 57)');

const exactFinish = calculateNextPosition(PLAYERS.RED, 'red_home_4', 55, 2);
assert(exactFinish !== null && exactFinish.position === 'finished', 'Exact finish (55+2=57) → finished');

section('LUDO: Triple Six Penalty');

let tripleState = createLudoGameState();
tripleState.players.red.pieces[0] = { id: 'red_0', position: 'cell_0', distanceTraveled: 0 };
tripleState.consecutiveSixes = 2; // Already rolled two 6s

const afterTriple = applyDiceRoll(tripleState, 6);
assert(afterTriple.currentPlayer === PLAYERS.GREEN, 'Triple-six: turn forfeited to next player');
assert(afterTriple.consecutiveSixes === 0, 'Consecutive sixes reset');

section('LUDO: Hop-by-Hop Path');

const path = buildMovePath(PLAYERS.RED, 'cell_0', 0, 4);
assertEqual(path, ['cell_1', 'cell_2', 'cell_3', 'cell_4'], 'Path has 4 hops: cell_1→cell_2→cell_3→cell_4');

section('LUDO: Win Detection');

let winState = createLudoGameState({ players: [PLAYERS.RED, PLAYERS.GREEN] });
winState.players.red.pieces[0] = { id: 'red_0', position: 'red_home_4', distanceTraveled: 55 };
winState.players.red.pieces[1] = { id: 'red_1', position: 'finished', distanceTraveled: 57 };
winState.players.red.pieces[2] = { id: 'red_2', position: 'finished', distanceTraveled: 57 };
winState.players.red.pieces[3] = { id: 'red_3', position: 'finished', distanceTraveled: 57 };
winState.players.red.finishedCount = 3;
winState.turnPhase = 'ROLL';

const afterWinRoll = applyDiceRoll(winState, 2);
const { state: afterWin, events: winEvents } = applyMove(afterWinRoll, 0);
assert(afterWin.players.red.finishedCount === 4, 'Red finished count is 4');
assert(afterWin.winner === PLAYERS.RED, 'Red is the winner');
assert(afterWin.gameStatus === GAME_STATUS.FINISHED, 'Game status is FINISHED');
assert(winEvents.some(e => e.type === 'GAME_OVER'), 'GAME_OVER event emitted');

// ═══════════════════════════════════════════════════════════════════════════
// SNAKES & LADDERS TESTS
// ═══════════════════════════════════════════════════════════════════════════

section('S&L: Game Initialization');

const slState = createSLGameState();
assert(slState.gameType === GAME_TYPE.SNAKE_LADDER, 'Game type is SNAKE_LADDER');
assert(slState.players.red.piece.position === 0, 'Red starts at position 0');

section('S&L: Basic Movement');

// Rolling 4 from position 0 lands on cell 4, which has a ladder → 14
const { state: slRolled } = applySLDiceRoll(slState, 4);
const { state: slMoved, events: slMoveEvents } = applySLMove(slRolled);
assert(slMoved.players.red.piece.position === 14, 'Red moved to position 4 → ladder climbs to 14');
assert(slMoveEvents.some(e => e.type === 'LADDER_HIT'), 'LADDER_HIT event emitted');

section('S&L: Snake Hit');

const snakeResolved = resolveSnakeOrLadder(16);
assert(snakeResolved.type === 'SNAKE', 'Position 16 is a snake head');
assert(snakeResolved.position === 6, 'Snake 16 slides to 6');

section('S&L: Ladder Hit');

const ladderResolved = resolveSnakeOrLadder(28);
assert(ladderResolved.type === 'LADDER', 'Position 28 is a ladder base');
assert(ladderResolved.position === 84, 'Ladder 28 climbs to 84');

section('S&L: Overshoot');

let slOvershootState = createSLGameState();
slOvershootState.players.red.piece.position = 98;
slOvershootState.turnPhase = 'ROLL';
const { state: slOvershotState } = applySLDiceRoll(slOvershootState, 5);
assert(slOvershotState.turnPhase !== 'MOVE', 'Cannot move if overshooting 100');

section('S&L: Win');

let slWinState = createSLGameState();
slWinState.players.red.piece.position = 96;
slWinState.turnPhase = 'ROLL';
const { state: slWinRolled } = applySLDiceRoll(slWinState, 4);
const { state: slWon, events: slWinEvents } = applySLMove(slWinRolled);
assert(slWon.winner === PLAYERS.RED, 'Red wins S&L at position 100');
assert(slWon.gameStatus === GAME_STATUS.FINISHED, 'S&L game finished');

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

section('Unified Engine: Game Creation');

const unifiedLudo = GameEngine.createGame(GAME_TYPE.LUDO);
assert(unifiedLudo.gameType === GAME_TYPE.LUDO, 'Unified engine creates Ludo game');

const unifiedSL = GameEngine.createGame(GAME_TYPE.SNAKE_LADDER);
assert(unifiedSL.gameType === GAME_TYPE.SNAKE_LADDER, 'Unified engine creates S&L game');

section('Unified Engine: Dice Roll');

const diceVal = GameEngine.rollDice();
assert(diceVal >= 1 && diceVal <= 6, `Dice roll ${diceVal} is between 1-6`);

section('Unified Engine: Summary');

const ludoSummary = GameEngine.getSummary(unifiedLudo);
assert(ludoSummary.currentPlayer === PLAYERS.RED, 'Ludo summary shows current player');

const slSummary = GameEngine.getSummary(unifiedSL);
assert(slSummary.players.red.position === 0, 'S&L summary shows piece position');

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n══════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}
