const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NOTICE, getStepAnimation } = require('../../miniprogram/data/candidate-animations');

const root = path.resolve(__dirname, '../..');

test('candidate animation contract exposes safe local image sequences', () => {
  assert.equal(NOTICE, '候选视觉示意，尚待专业确认');
  for (const stepId of ['motion', 'inspect']) {
    const animation = getStepAnimation(stepId);
    assert.ok(animation.frames.length >= 6 && animation.frames.length <= 10);
    assert.ok(animation.frameIntervalMs > 0);
    assert.equal(animation.notice, NOTICE);
    for (const frame of animation.frames) {
      assert.match(frame, /^\/assets\/candidate\/.+\.(?:webp|png)$/);
      assert.doesNotMatch(frame, /\.(?:mp4|webm|mov)$/i);
      assert.ok(fs.existsSync(path.join(root, 'miniprogram', frame)));
    }
  }
  assert.equal(getStepAnimation('unknown'), null);
});

test('animation callers cannot mutate the frozen registry', () => {
  const first = getStepAnimation('motion');
  first.frames.pop();
  assert.equal(getStepAnimation('motion').frames.length, 8);
});
