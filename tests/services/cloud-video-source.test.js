'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isCloudFileId, createCloudVideoSource } = require('../../miniprogram/services/cloud-video-source');

test('recognises only CloudBase file identifiers', () => {
  assert.equal(isCloudFileId('cloud://cloud1.example/path/video.mp4'), true);
  assert.equal(isCloudFileId('https://example.com/video.mp4'), false);
  assert.equal(isCloudFileId(''), false);
});

test('resolves and caches CloudBase temporary media URLs', async () => {
  let calls = 0;
  const source = createCloudVideoSource({
    getTempFileURL: async ({ fileList }) => {
      calls += 1;
      return { fileList: fileList.map((fileID) => ({ fileID, status: 0, tempFileURL: `https://temporary.example/${fileID.slice(-4)}` })) };
    },
  });
  const playback = { sourceType: 'cloud', cloudFileId: 'cloud://cloud1.example/video.mp4', src: '' };
  const first = await source.resolve(playback);
  const second = await source.resolve(playback);
  assert.equal(first.src, 'https://temporary.example/.mp4');
  assert.equal(second.src, first.src);
  assert.equal(calls, 1);
});

test('fails closed for malformed and unavailable CloudBase records', async () => {
  assert.throws(() => createCloudVideoSource({}), /invalid CloudBase media adapter/);
  const source = createCloudVideoSource({ getTempFileURL: async () => ({ fileList: [] }) });
  assert.equal(await source.resolve({ sourceType: 'cloud', cloudFileId: 'invalid' }), null);
  assert.equal(await source.resolve({ sourceType: 'cloud', cloudFileId: 'cloud://cloud1.example/missing.mp4' }), null);
});
