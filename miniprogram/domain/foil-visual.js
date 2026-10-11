const { GRID_SIZE, IDEAL_MIN, IDEAL_MAX, RISK_THRESHOLD } = require('./foil-session');

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mapDisplayToGrid(row, col, rotation = 0) {
  const turn = ((rotation % 360) + 360) % 360;
  if (turn === 90) return { row: GRID_SIZE - 1 - col, col: row };
  if (turn === 180) return { row: GRID_SIZE - 1 - row, col: GRID_SIZE - 1 - col };
  if (turn === 270) return { row: col, col: GRID_SIZE - 1 - row };
  return { row, col };
}

function stateForValue(value) {
  if (value < RISK_THRESHOLD) return 'risk';
  if (value < IDEAL_MIN) return 'thin';
  if (value > IDEAL_MAX) return 'thick';
  return 'ideal';
}

function visualParameters(value, row, col) {
  const state = stateForValue(value);
  const normalized = clamp((value - 15) / 80);
  const lightness = Math.round(29 + normalized * 36);
  const sheen = state === 'thick' ? 82 : state === 'ideal' ? 66 : state === 'thin' ? 30 : 16;
  const texture = state === 'ideal' ? 62 : state === 'thick' ? 44 : 24;
  const flaw = state === 'risk' ? 88 : state === 'thin' ? 26 : 0;
  const seed = (row * 7 + col * 11) % 5;
  return {
    state,
    lightness,
    sheen,
    texture,
    flaw,
    seed,
    surfaceStyle: `background:hsl(41,65%,${lightness}%);--foil-light:${lightness}%;--foil-sheen:${sheen / 100};--foil-texture:${texture / 100};--foil-flaw:${flaw / 100};--seed:${seed};`,
  };
}

function createFoilVisual(session) {
  const rotation = session.rotation || 0;
  const cells = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const source = mapDisplayToGrid(row, col, rotation);
      const value = session.grid[source.row][source.col];
      const visual = visualParameters(value, source.row, source.col);
      cells.push({
        id: `${row}-${col}`,
        row,
        col,
        sourceRow: source.row,
        sourceCol: source.col,
        value,
        touched: Boolean(session.touched && session.touched[source.row] && session.touched[source.row][source.col]),
        left: col * 25,
        top: row * 25,
        ...visual,
      });
    }
  }
  return cells;
}

module.exports = { mapDisplayToGrid, stateForValue, visualParameters, createFoilVisual };
