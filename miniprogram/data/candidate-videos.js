'use strict';

const videos = Object.freeze({
  twist: Object.freeze({
    src: '/assets/candidate/material-guide.mp4',
    poster: '/assets/candidate/step-observe.png',
  }),
  pack: Object.freeze({
    src: '/assets/candidate/material-guide.mp4',
    poster: '/assets/candidate/step-observe.png',
  }),
  hammer: Object.freeze({
    src: '/assets/candidate/motion-guide.mp4',
    poster: '/assets/candidate/step-motion.png',
  }),
  inspect: Object.freeze({
    src: '/assets/candidate/rhythm-guide.mp4',
    poster: '/assets/candidate/step-inspect.png',
  }),
  finish: Object.freeze({
    src: '/assets/candidate/motion-guide.mp4',
    poster: '/assets/candidate/step-motion.png',
  }),
});

function getStepVideo(stepId) {
  const video = videos[stepId];
  return video ? { ...video } : null;
}

module.exports = { getStepVideo };
