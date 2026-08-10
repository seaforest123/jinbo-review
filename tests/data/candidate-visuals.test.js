'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NOTICE, getCoverVisual, getRouteVisual, getStepVisual } = require('../../miniprogram/data/candidate-visuals');

test('maps candidate cover, route, and step visuals to local assets only', () => {
  const visuals = [getCoverVisual(), getRouteVisual('foil_making_candidate'), getStepVisual('twist'), getStepVisual('hammer'), getStepVisual('inspect')];
  assert.equal(NOTICE, '候选视觉示意，尚待专业确认');
  assert.equal(new Set(visuals.map((visual) => visual.path)).size, 5);
  for (const visual of visuals) {
    assert.match(visual.path, /^\/assets\/candidate\/[a-z-]+\.png$/);
    assert.equal(visual.notice, NOTICE);
    assert.ok(fs.existsSync(path.join(__dirname, '../..', 'miniprogram', visual.path)));
  }
});

test('returns no candidate visual for unknown route or step identifiers', () => {
  assert.equal(getRouteVisual('unknown'), null);
  assert.equal(getStepVisual('unknown'), null);
  const source = JSON.stringify([getCoverVisual(), getRouteVisual('foil_making_candidate'), getStepVisual('twist')]);
  assert.doesNotMatch(source, /openid|unionid|cloudbase|https?:\/\//i);
});
