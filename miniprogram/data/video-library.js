'use strict';

const CLOUD_ROOT = 'gold-foil-trial/video-centre/2026-08';
const CLOUD_FILE_PREFIX = 'cloud://cloud1-d5gsryg0q3834cccc.636c-cloud1-d5gsryg0q3834cccc-1456702624/';
const PROCESS_NOTICE = '工艺解说影像；仅用于本项目内测展示。';
const EXTENSION_NOTICE = '授权影像资料；仅用于本项目内测展示。';

function cloudFileId(cloudPath) {
  return `${CLOUD_FILE_PREFIX}${cloudPath}`;
}

function mediaSource({
  localPath = '',
  cloudFileId = '',
  remoteUrl = '',
  posterPath = '',
  posterCloudFileId = '',
  cloudPath = '',
  posterCloudPath = '',
  sourceFileName = '',
} = {}) {
  return Object.freeze({
    localPath,
    cloudFileId,
    remoteUrl,
    posterPath,
    posterCloudFileId,
    cloudPath,
    posterCloudPath,
    sourceFileName,
  });
}

function cloudMedia({ sourceFileName, slug }) {
  const cloudPath = `${CLOUD_ROOT}/videos/${slug}.mp4`;
  const posterCloudPath = `${CLOUD_ROOT}/posters/${slug}.png`;
  return mediaSource({
    cloudFileId: cloudFileId(cloudPath),
    posterCloudFileId: cloudFileId(posterCloudPath),
    cloudPath,
    posterCloudPath,
    sourceFileName,
  });
}

function processVideo(index, duration) {
  const padded = String(index).padStart(2, '0');
  return Object.freeze({
    id: `process-${padded}`,
    title: `工序 ${index}`,
    duration,
    description: '解说内容待补充',
    notice: PROCESS_NOTICE,
    source: cloudMedia({ sourceFileName: `工序${index}.mp4`, slug: `process-${padded}` }),
  });
}

function extensionVideo({ id, title, duration, sourceFileName }) {
  return Object.freeze({
    id,
    title,
    duration,
    description: '授权影像资料，作为金箔工艺与文化背景的拓展参照。',
    notice: EXTENSION_NOTICE,
    source: cloudMedia({ sourceFileName, slug: id }),
  });
}

const sections = Object.freeze([
  Object.freeze({
    id: 'artisan-interviews',
    title: '非遗传承人访谈',
    eyebrow: 'ARTISAN VOICES',
    description: '传承人访谈内容将在取得相应授权后接入。',
    emptyCopy: '访谈影像待接入',
    videos: Object.freeze([]),
  }),
  Object.freeze({
    id: 'craft-explanations',
    title: '金箔制作过程解说',
    eyebrow: 'CRAFT IN MOTION',
    description: '十二段工序影像，供内测阶段补充工艺理解。',
    emptyCopy: '',
    videos: Object.freeze([
      processVideo(1, '00:12'),
      processVideo(2, '00:18'),
      processVideo(3, '00:22'),
      processVideo(4, '00:25'),
      processVideo(5, '00:21'),
      processVideo(6, '00:17'),
      processVideo(7, '00:18'),
      processVideo(8, '00:20'),
      processVideo(9, '00:10'),
      processVideo(10, '00:59'),
      processVideo(11, '00:24'),
      processVideo(12, '00:27'),
    ]),
  }),
  Object.freeze({
    id: 'extended-archive',
    title: '拓展影像',
    eyebrow: 'EXTENDED ARCHIVE',
    description: '经授权的佛山金箔技术参照影像，仅供本项目内测观看。',
    emptyCopy: '',
    videos: Object.freeze([
      extensionVideo({ id: 'foshan-craft', title: '佛山金箔锻造工艺（授权影像资料）', duration: '00:19', sourceFileName: '佛山金箔锻造工艺.mp4' }),
      extensionVideo({ id: 'foshan-exhibits', title: '佛山金箔工艺展品（授权影像资料）', duration: '00:04', sourceFileName: '佛山金箔工艺展品.mp4' }),
      extensionVideo({ id: 'foshan-history', title: '佛山金箔历史渊源（授权影像资料）', duration: '00:16', sourceFileName: '佛山金箔历史渊源.mp4' }),
      extensionVideo({ id: 'history-origins', title: '金箔历史渊源', duration: '00:26', sourceFileName: '金箔历史渊源.mp4' }),
      extensionVideo({ id: 'gold-leaf-exhibits', title: '金箔展品', duration: '00:19', sourceFileName: '金箔展品.mp4' }),
      extensionVideo({ id: 'tiangong-kaiwu', title: '《天工开物》所记金箔', duration: '00:31', sourceFileName: '天工开物所记金箔.mp4' }),
    ]),
  }),
]);

function copyVideo(video) {
  return { ...video, source: { ...video.source } };
}

function listVideoSections() {
  return sections.map((section) => ({ ...section, videos: section.videos.map(copyVideo) }));
}

function findVideo(videoId) {
  for (const section of sections) {
    const video = section.videos.find((candidate) => candidate.id === videoId);
    if (video) return copyVideo(video);
  }
  return null;
}

function listConfiguredLocalMediaPaths() {
  return sections.flatMap((section) => section.videos.flatMap((video) => [
    video.source.localPath,
    video.source.posterPath,
  ].filter(Boolean)));
}

function listConfiguredLocalVideoPaths() {
  return sections.flatMap((section) => section.videos.map((video) => video.source.localPath).filter(Boolean));
}

function getVideoPlayback(videoId) {
  const video = findVideo(videoId);
  if (!video) return null;
  const source = video.source;
  const src = source.localPath || source.remoteUrl || '';
  return {
    videoId: video.id,
    src,
    posterPath: source.posterPath,
    posterCloudFileId: source.posterCloudFileId,
    cloudFileId: source.cloudFileId,
    sourceType: source.localPath ? 'local' : source.remoteUrl ? 'remote' : source.cloudFileId ? 'cloud' : 'pending',
  };
}

module.exports = {
  CLOUD_ROOT,
  CLOUD_FILE_PREFIX,
  PROCESS_NOTICE,
  EXTENSION_NOTICE,
  listVideoSections,
  findVideo,
  listConfiguredLocalMediaPaths,
  listConfiguredLocalVideoPaths,
  getVideoPlayback,
};
