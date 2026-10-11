const test = require('node:test');
const assert = require('node:assert/strict');
const { createFoilSession, createHammerStageSession, cutPiece, placeSheet, initializeFromPlacements, hammerCell, mentorFinishHammering, deriveGrid } = require('../../miniprogram/domain/foil-session');

test('demo hammer stage is composed from the same valid cut, placement, and close operations', () => {
  const session = createHammerStageSession();
  assert.equal(session.sheetCount, 3);
  assert.equal(session.placements.length, 3);
  assert.equal(session.closed, true);
  assert.equal(session.rotated, false);
  assert.equal(session.inspectionSweeps, 0);
});

test('placement offset changes the initialized thickness grid', () => {
  let centered = createFoilSession();
  let offset = createFoilSession();
  for (let index = 0; index < 3; index += 1) {
    centered = placeSheet(centered, 0, 0);
    offset = placeSheet(offset, .7, .7);
  }
  assert.notDeepEqual(initializeFromPlacements(centered).grid, initializeFromPlacements(offset).grid);
});

test('packing stops exactly at three sheets', () => {
  let session = createFoilSession();
  session = placeSheet(session, 0, 0);
  session = placeSheet(session, 0, 0);
  session = placeSheet(session, 0, 0);
  const full = placeSheet(session, 0, 0);
  assert.equal(full.placements.length, 3);
  assert.strictEqual(full, session);
});

test('cutting accepts only valid pieces and stops exactly at three', () => {
  let session = createFoilSession();
  session = cutPiece(session, .5);
  assert.equal(session.sheetCount, 0);
  session = cutPiece(session, 1, false);
  assert.equal(session.sheetCount, 0);
  assert.equal(session.cuts.at(-1).motionStable, false);
  session = cutPiece(session, 1);
  session = cutPiece(session, 1);
  session = cutPiece(session, 1);
  const full = cutPiece(session, 1);
  assert.equal(full.sheetCount, 3);
  assert.equal(full.cuts.length, 5);
  assert.strictEqual(full, session);
});

test('hammering changes the target and decays into adjacent cells', () => {
  const session = createFoilSession();
  const next = hammerCell(session, 1, 1);
  assert.equal(next.grid[1][1], 64);
  assert.equal(next.grid[1][2], 77);
  assert.equal(next.grid[3][3], 82);
  assert.equal(deriveGrid(next.grid, next.touched).untreatedCount, 7);
});

test('repeated hits create persistent breakage risk', () => {
  let session = createFoilSession();
  for (let index = 0; index < 4; index += 1) session = hammerCell(session, 2, 2);
  assert.ok(session.grid[2][2] < 24);
  assert.equal(deriveGrid(session.grid, session.touched).riskCount, 1);
});

test('separates repairable thick or untouched areas from irreversible risk', () => {
  let session = createFoilSession();
  session.grid[0][0] = 18;
  session.grid[0][1] = 78;
  session.touched[0][0] = true;
  session.touched[0][1] = true;
  const metrics = deriveGrid(session.grid, session.touched);
  assert.equal(metrics.riskCount, 1);
  assert.equal(metrics.thickCount, 15);
  assert.equal(metrics.repairableCount, 15);
});

test('mentor assistance safely completes untouched and thick hammer areas', () => {
  const assisted = mentorFinishHammering(createFoilSession());
  const metrics = deriveGrid(assisted.grid, assisted.touched);
  assert.equal(metrics.untreatedCount, 0);
  assert.equal(metrics.thickCount, 0);
  assert.equal(metrics.riskCount, 0);
  assert.equal(assisted.rotated, true);
});
