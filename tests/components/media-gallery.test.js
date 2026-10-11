'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const componentRoot = path.join(root, 'miniprogram/components/media-gallery');

function loadComponent() {
  const target = require.resolve(path.join(componentRoot, 'index.js'));
  const previous = global.Component;
  let definition;
  global.Component = (value) => { definition = value; };
  delete require.cache[target];
  require(target);
  if (previous === undefined) delete global.Component; else global.Component = previous;
  return definition;
}

test('uses one gallery component for all media categories and playback', () => {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(componentRoot, `index.${extension}`)));
  }
  const definition = loadComponent();
  assert.equal(definition.properties.sectionId.value, '');
  for (const method of ['playVideo', 'closePlayer', 'handlePlaybackError', 'goBack']) assert.equal(typeof definition.methods[method], 'function');
  const markup = fs.readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
  assert.match(markup, /class="video-cover video-cover-action" data-video-id="{{video.id}}" bindtap="playVideo"/);
  assert.match(markup, /<video-player/);
  assert.match(markup, /class="section-notice">{{section.videos\[0\].notice}}<\/view>/);
  assert.doesNotMatch(markup, /class="video-notice"/);
  const styles = fs.readFileSync(path.join(componentRoot, 'index.wxss'), 'utf8');
  for (const token of ['align-items: center', 'justify-content: center', 'max-width: 680rpx', '.section-notice']) assert.match(styles, new RegExp(token.replace('.', '\\.')));
});

test('every video section carries a non-blank empty-state copy for the zero-video fallback', () => {
  const { listVideoSections } = require(path.join(root, 'miniprogram/data/video-library'));
  const sections = listVideoSections();
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.equal(typeof section.emptyCopy, 'string');
    assert.notEqual(section.emptyCopy.trim(), '');
  }
  const markup = fs.readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
  assert.match(markup, /wx:if="\{\{!section\.videos\.length\}\}" class="empty-video-state"/);
  assert.match(markup, /<text>\{\{section\.emptyCopy\}\}<\/text>/);

  const temporarilyEmptySection = { ...sections[0], videos: [] };
  assert.equal(temporarilyEmptySection.videos.length, 0);
  assert.notEqual(temporarilyEmptySection.emptyCopy.trim(), '');
  assert.ok(listVideoSections()[0].videos.length > 0);
});

test('closes the player and shows a retry prompt after native video loading fails', () => {
  const definition = loadComponent();
  const updates = [];
  const toasts = [];
  const previousWx = global.wx;
  global.wx = { showToast: (options) => toasts.push(options) };
  try {
    definition.methods.handlePlaybackError.call({ setData: (update) => updates.push(update) });
  } finally {
    if (previousWx === undefined) delete global.wx; else global.wx = previousWx;
  }
  assert.deepEqual(updates, [{ activeVideoId: '', activeVideoSource: '', activeVideoPoster: '' }]);
  assert.deepEqual(toasts, [{ title: '视频加载失败，请稍后重试', icon: 'none' }]);
  const markup = fs.readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
  assert.match(markup, /<video-player[^>]+bind:error="handlePlaybackError"/);
});
