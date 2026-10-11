'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getStepVideo } = require('../../miniprogram/data/candidate-videos');

const root = path.resolve(__dirname, '../..', 'miniprogram');

test('maps all five steps to local action videos and static posters', () => {
  for (const stepId of ['twist', 'pack', 'hammer', 'inspect', 'finish']) {
    const video = getStepVideo(stepId);
    assert.match(video.src, /^\/assets\/candidate\/[a-z-]+\.mp4$/);
    assert.match(video.poster, /^\/assets\/candidate\/[a-z-]+\.png$/);
    assert.ok(fs.existsSync(path.join(root, video.src)));
    assert.ok(fs.existsSync(path.join(root, video.poster)));
  }
  assert.equal(getStepVideo('unknown'), null);
});

test('returns defensive video metadata copies', () => {
  const video = getStepVideo('twist');
  video.src = '/changed.mp4';
  assert.equal(getStepVideo('twist').src, '/assets/candidate/material-guide.mp4');
});
