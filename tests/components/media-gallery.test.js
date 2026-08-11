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
  for (const method of ['playVideo', 'closePlayer', 'goBack']) assert.equal(typeof definition.methods[method], 'function');
  const markup = fs.readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8');
  assert.match(markup, /class="video-cover video-cover-action" data-video-id="{{video.id}}" bindtap="playVideo"/);
  assert.match(markup, /<video-player/);
  const styles = fs.readFileSync(path.join(componentRoot, 'index.wxss'), 'utf8');
  for (const token of ['align-items: center', 'justify-content: center', 'max-width: 680rpx']) assert.match(styles, new RegExp(token));
});
