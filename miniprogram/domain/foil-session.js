const GRID_SIZE = 4;
const IDEAL_MIN = 36;
const IDEAL_MAX = 64;
const RISK_THRESHOLD = 24;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function createGrid(value = 82) {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(value));
}

function createFoilSession() {
  return {
    grid: createGrid(),
    touched: createGrid(0).map((row) => row.map(() => false)),
    cuts: [],
    placements: [],
    sheetCount: 0,
    closed: false,
    rotated: false,
    rotation: 0,
    inspectionSweeps: 0,
    reworkHitsRemaining: 0,
    flawAccepted: false,
    finishDamage: 0,
  };
}

function createHammerStageSession() {
  let session = createFoilSession();
  for (let index = 0; index < 3; index += 1) session = cutPiece(session, 1);
  session = placeSheet(session, 0, 0);
  session = placeSheet(session, .04, -.03);
  session = placeSheet(session, -.03, .04);
  return initializeFromPlacements(session);
}

function deriveGrid(grid, touched) {
  const cells = grid.flat();
  const touchedCells = touched.flat();
  const qualifiedCount = cells.filter((value) => value >= IDEAL_MIN && value <= IDEAL_MAX).length;
  const riskCount = cells.filter((value) => value < RISK_THRESHOLD).length;
  const thickCount = cells.filter((value) => value > IDEAL_MAX).length;
  const thinCount = cells.filter((value) => value >= RISK_THRESHOLD && value < IDEAL_MIN).length;
  const untreatedCount = touchedCells.filter((value) => !value).length;
  const touchedCount = cells.length - untreatedCount;
  const average = Math.round(cells.reduce((sum, value) => sum + value, 0) / cells.length);
  const coverage = Math.round((qualifiedCount / cells.length) * 100);
  const quality = riskCount > 2 || coverage < 45 ? 'obvious' : riskCount || coverage < 75 ? 'minor' : 'perfect';
  const touchedCoverage = Math.round((touchedCount / cells.length) * 100);
  const repairableCount = cells.filter((value, index) => value > IDEAL_MAX || !touchedCells[index]).length;
  return { qualifiedCount, riskCount, thickCount, thinCount, untreatedCount, touchedCount, touchedCoverage, repairableCount, average, coverage, quality };
}

function cutPiece(session, ratio, motionStable = true) {
  if (session.sheetCount >= 3) return session;
  const accepted = motionStable && ratio >= .82 && ratio <= 1.18;
  const cuts = [...session.cuts, { ratio, motionStable: Boolean(motionStable), accepted }];
  return { ...session, cuts, sheetCount: cuts.filter((cut) => cut.accepted).length };
}

function placeSheet(session, x, y) {
  if (session.placements.length >= 3 || session.closed) return session;
  const offset = Math.min(1, Math.sqrt(x * x + y * y));
  const placements = [...session.placements, { x, y, offset }];
  return { ...session, placements };
}

function initializeFromPlacements(session) {
  if (!session.placements.length) return session;
  const averageOffset = session.placements.reduce((sum, item) => sum + item.offset, 0) / session.placements.length;
  const grid = createGrid().map((row, rowIndex) => row.map((_, colIndex) => {
    const directionalBias = session.placements.reduce((sum, item) => {
      const cellX = (colIndex - 1.5) / 1.5;
      const cellY = (rowIndex - 1.5) / 1.5;
      return sum + Math.abs(cellX - item.x) * 7 + Math.abs(cellY - item.y) * 7;
    }, 0) / session.placements.length;
    return clamp(78 + averageOffset * 18 + directionalBias);
  }));
  return { ...session, grid, closed: true };
}

function hammerCell(session, row, col) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return session;
  const grid = session.grid.map((line) => [...line]);
  const touched = session.touched.map((line) => [...line]);
  for (let r = Math.max(0, row - 1); r <= Math.min(GRID_SIZE - 1, row + 1); r += 1) {
    for (let c = Math.max(0, col - 1); c <= Math.min(GRID_SIZE - 1, col + 1); c += 1) {
      const direct = r === row && c === col;
      grid[r][c] = clamp(grid[r][c] - (direct ? 18 : 5));
      touched[r][c] = true;
    }
  }
  return { ...session, grid, touched };
}

function stressCell(session, row, col) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE || session.grid[row][col] >= IDEAL_MIN) return session;
  const grid = session.grid.map((line) => [...line]);
  grid[row][col] = clamp(grid[row][col] - 8);
  return { ...session, grid, finishDamage: session.finishDamage + 1 };
}

function mentorFinishHammering(session) {
  const grid = session.grid.map((row) => row.map((value) => {
    if (value < IDEAL_MIN) return value;
    return Math.min(value, 54);
  }));
  const touched = session.touched.map((row) => row.map(() => true));
  return { ...session, grid, touched, rotated: true, rotation: session.rotation || 90, reworkHitsRemaining: 0 };
}

function inspectCells(session) {
  return session.grid.flatMap((row, rowIndex) => row.map((value, colIndex) => ({
    id: `${rowIndex}-${colIndex}`,
    row: rowIndex,
    col: colIndex,
    value,
    state: value < RISK_THRESHOLD ? 'risk' : value > IDEAL_MAX ? 'thick' : value < IDEAL_MIN ? 'thin' : 'ideal',
  })));
}

module.exports = {
  GRID_SIZE,
  IDEAL_MIN,
  IDEAL_MAX,
  RISK_THRESHOLD,
  createFoilSession,
  createHammerStageSession,
  deriveGrid,
  cutPiece,
  placeSheet,
  initializeFromPlacements,
  hammerCell,
  stressCell,
  mentorFinishHammering,
  inspectCells,
};
