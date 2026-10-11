'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLOUD_ROOT,
  CLOUD_FILE_PREFIX,
  listVideoSections,
  findVideo,
  listConfiguredLocalMediaPaths,
  listConfiguredLocalVideoPaths,
  getVideoPlayback,
} = require('../../miniprogram/data/video-library');

test('provides two authorised interviews, twelve process videos, and six authorised extensions', () => {
  const sections = listVideoSections();
  assert.deepEqual(sections.map((section) => section.id), ['artisan-interviews', 'craft-explanations', 'extended-archive']);
  assert.equal(sections[0].videos.length, 2);
  assert.equal(sections[1].videos.length, 12);
  assert.equal(sections[2].videos.length, 6);
  assert.equal(sections[0].videos[0].title, '第二代传承人介绍');
  assert.equal(sections[0].videos[1].title, '第三代传承人介绍');
  assert.equal(sections[0].videos[1].source.sourceFileName, '第三代传承人介绍.mp4');
  assert.match(sections[0].videos[0].notice, /经授权/);
  assert.equal(sections[1].videos[0].title, '工序 1 · 黄金配比');
  assert.equal(sections[1].videos[11].title, '工序 12 · 切金箔');
  assert.equal(sections[1].videos[11].description, '在竹板上用竹刀把金箔切成标准规格。');
  assert.match(sections[1].videos[0].notice, /赵绪成/);
  assert.match(sections[2].videos[0].title, /^佛山金箔锻造工艺/);
});

test('keeps CloudBase upload paths and local package paths separate', () => {
  const video = findVideo('process-01');
  assert.equal(video.source.cloudPath, `${CLOUD_ROOT}/videos/process-01.mp4`);
  assert.equal(video.source.posterCloudPath, `${CLOUD_ROOT}/posters/process-01.png`);
  assert.equal(video.source.cloudFileId, `${CLOUD_FILE_PREFIX}${CLOUD_ROOT}/videos/process-01.mp4`);
  assert.equal(video.source.posterCloudFileId, `${CLOUD_FILE_PREFIX}${CLOUD_ROOT}/posters/process-01.png`);
  assert.equal(video.source.sourceFileName, '工序1.mp4');
  assert.deepEqual(listConfiguredLocalMediaPaths(), []);
  assert.deepEqual(listConfiguredLocalVideoPaths(), []);
  video.title = 'changed';
  assert.equal(findVideo('process-01').title, '工序 1 · 黄金配比');
});

test('marks a configured cloud file as playable through the CloudBase resolver', () => {
  const playback = getVideoPlayback('process-01');
  assert.equal(playback.sourceType, 'cloud');
  assert.equal(playback.src, '');
  assert.equal(playback.cloudFileId, `${CLOUD_FILE_PREFIX}${CLOUD_ROOT}/videos/process-01.mp4`);
  assert.equal(playback.posterCloudFileId, `${CLOUD_FILE_PREFIX}${CLOUD_ROOT}/posters/process-01.png`);
  assert.equal(getVideoPlayback('missing'), null);
});

test('keeps authorised interview playback on the configured CloudBase paths', () => {
  const video = findVideo('artisan-second-generation');
  assert.equal(video.source.cloudPath, `${CLOUD_ROOT}/videos/artisan-second-generation.mp4`);
  assert.equal(video.source.posterCloudPath, `${CLOUD_ROOT}/posters/artisan-second-generation.png`);
  assert.equal(video.source.sourceFileName, '第二代传承人介绍.mp4');

  const playback = getVideoPlayback('artisan-third-generation');
  assert.equal(playback.sourceType, 'cloud');
  assert.equal(playback.cloudFileId, `${CLOUD_FILE_PREFIX}${CLOUD_ROOT}/videos/artisan-third-generation.mp4`);
});
