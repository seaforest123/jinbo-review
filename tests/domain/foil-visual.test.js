const test = require('node:test');
const assert = require('node:assert/strict');
const { createFoilSession } = require('../../miniprogram/domain/foil-session');
const { mapDisplayToGrid, createFoilVisual } = require('../../miniprogram/domain/foil-visual');

test('maps displayed hammer coordinates back to the shared grid after rotation', () => {
  assert.deepEqual(mapDisplayToGrid(0, 0, 0), { row: 0, col: 0 });
  assert.deepEqual(mapDisplayToGrid(0, 0, 90), { row: 3, col: 0 });
  assert.deepEqual(mapDisplayToGrid(0, 0, 180), { row: 3, col: 3 });
  assert.deepEqual(mapDisplayToGrid(0, 0, 270), { row: 0, col: 3 });
});

test('creates material parameters without exposing values as display copy', () => {
  const session = createFoilSession();
  session.grid[0][0] = 18;
  session.grid[0][1] = 32;
  session.grid[0][2] = 52;
  session.grid[0][3] = 82;
  const cells = createFoilVisual(session);
  assert.deepEqual(cells.slice(0, 4).map((cell) => cell.state), ['risk', 'thin', 'ideal', 'thick']);
  assert.ok(cells.every((cell) => /--foil-light/.test(cell.surfaceStyle)));
});
