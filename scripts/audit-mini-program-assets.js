'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getStepAnimation } = require('../miniprogram/data/candidate-animations');
const { getStepVideo } = require('../miniprogram/data/candidate-videos');
const {
  getCoverVisual,
  getRouteVisual,
  getStepVisual,
} = require('../miniprogram/data/candidate-visuals');

const MINI_PROGRAM_BUDGET_BYTES = 2 * 1024 * 1024;
const ANIMATION_BUDGET_BYTES = 512 * 1024;
const FRAME_BUDGET_BYTES = 100 * 1024;
const VIDEO_BUDGET_BYTES = 384 * 1024;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const MEDIA_EXTENSIONS = new Set(['.png', '.webp', '.mp4']);

function listFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(target) : [target];
  });
}

function referencedMediaPaths() {
  const visuals = [
    getCoverVisual(),
    getRouteVisual('foil_making_candidate'),
    getRouteVisual('foil_application_candidate'),
    getStepVisual('twist'),
    getStepVisual('pack'),
    getStepVisual('hammer'),
    getStepVisual('inspect'),
    getStepVisual('finish'),
  ];
  const animations = ['motion', 'inspect'].flatMap((stepId) => getStepAnimation(stepId).frames);
  const videos = ['twist', 'pack', 'hammer', 'inspect', 'finish'].map((stepId) => getStepVideo(stepId).src);
  return [...visuals.map((visual) => visual.path), ...animations, ...videos];
}

function auditAssets(root = path.resolve(__dirname, '..')) {
  const miniProgramRoot = path.join(root, 'miniprogram');
  const assetRoot = path.join(miniProgramRoot, 'assets');
  const miniProgramFiles = listFiles(miniProgramRoot);
  const assetFiles = listFiles(assetRoot);
  const errors = [];
  const allowedVideoPaths = new Set(
    ['twist', 'pack', 'hammer', 'inspect', 'finish'].map((stepId) => path.join(miniProgramRoot, getStepVideo(stepId).src)),
  );
  const packageBytes = miniProgramFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);

  if (packageBytes > MINI_PROGRAM_BUDGET_BYTES) {
    errors.push(`miniprogram package budget exceeded: ${packageBytes} > ${MINI_PROGRAM_BUDGET_BYTES}`);
  }

  for (const file of assetFiles) {
    const extension = path.extname(file).toLowerCase();
    if (VIDEO_EXTENSIONS.has(extension) && !allowedVideoPaths.has(file)) errors.push(`unregistered video asset is forbidden: ${file}`);
    if (!MEDIA_EXTENSIONS.has(extension)) errors.push(`unsupported media extension: ${file}`);
  }

  const referenced = referencedMediaPaths();
  for (const mediaPath of referenced) {
    if (/^https?:\/\//i.test(mediaPath)) errors.push(`remote media is forbidden: ${mediaPath}`);
    const absolutePath = path.join(miniProgramRoot, mediaPath);
    if (!fs.existsSync(absolutePath)) errors.push(`referenced media is missing: ${mediaPath}`);
  }

  const animationPaths = ['motion', 'inspect'].flatMap((stepId) => getStepAnimation(stepId).frames);
  let animationBytes = 0;
  for (const framePath of animationPaths) {
    const absolutePath = path.join(miniProgramRoot, framePath);
    if (!fs.existsSync(absolutePath)) continue;
    const bytes = fs.statSync(absolutePath).size;
    animationBytes += bytes;
    if (bytes > FRAME_BUDGET_BYTES) errors.push(`animation frame budget exceeded: ${framePath}`);
  }
  if (animationBytes > ANIMATION_BUDGET_BYTES) {
    errors.push(`animation budget exceeded: ${animationBytes} > ${ANIMATION_BUDGET_BYTES}`);
  }

  let videoBytes = 0;
  for (const videoPath of allowedVideoPaths) {
    if (!fs.existsSync(videoPath)) continue;
    videoBytes += fs.statSync(videoPath).size;
  }
  if (videoBytes > VIDEO_BUDGET_BYTES) {
    errors.push(`video budget exceeded: ${videoBytes} > ${VIDEO_BUDGET_BYTES}`);
  }

  const pageMarkup = listFiles(path.join(miniProgramRoot, 'pages'))
    .filter((file) => path.extname(file) === '.wxml')
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const videoComponents = pageMarkup.match(/<video(?:\s|>)/gi) || [];
  if (videoComponents.length !== 1) errors.push(`expected one shared video component, found ${videoComponents.length}`);

  return {
    errors,
    packageBytes,
    animationBytes,
    videoBytes,
    assetCount: assetFiles.length,
    referencedCount: referenced.length,
  };
}

if (require.main === module) {
  const result = auditAssets();
  if (result.errors.length) {
    result.errors.forEach((error) => console.error(`ERROR ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`Asset audit passed: package=${result.packageBytes} bytes, animations=${result.animationBytes} bytes, videos=${result.videoBytes} bytes, assets=${result.assetCount}.`);
  }
}

module.exports = {
  ANIMATION_BUDGET_BYTES,
  FRAME_BUDGET_BYTES,
  MEDIA_EXTENSIONS,
  MINI_PROGRAM_BUDGET_BYTES,
  VIDEO_EXTENSIONS,
  VIDEO_BUDGET_BYTES,
  auditAssets,
};
