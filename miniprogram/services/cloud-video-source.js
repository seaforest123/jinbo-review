'use strict';

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

function createCloudVideoSource({ getTempFileURL }) {
  if (typeof getTempFileURL !== 'function') throw new TypeError('invalid CloudBase media adapter');
  const cache = new Map();

  async function resolveFiles(fileIds) {
    const requested = [...new Set(fileIds.filter(isCloudFileId))];
    const missing = requested.filter((fileId) => !cache.has(fileId));
    if (missing.length) {
      const response = await getTempFileURL({ fileList: missing });
      const files = response && Array.isArray(response.fileList) ? response.fileList : [];
      for (const file of files) {
        if (file && file.status === 0 && isCloudFileId(file.fileID) && typeof file.tempFileURL === 'string' && file.tempFileURL) {
          cache.set(file.fileID, file.tempFileURL);
        }
      }
    }
    return new Map(requested.filter((fileId) => cache.has(fileId)).map((fileId) => [fileId, cache.get(fileId)]));
  }

  return {
    resolveFiles,
    async resolve(playback) {
      if (!playback || playback.sourceType !== 'cloud' || !isCloudFileId(playback.cloudFileId)) return null;
      const resolved = await resolveFiles([playback.cloudFileId]);
      const src = resolved.get(playback.cloudFileId);
      return src ? { ...playback, src } : null;
    },
  };
}

module.exports = { isCloudFileId, createCloudVideoSource };
