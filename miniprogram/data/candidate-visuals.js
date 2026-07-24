'use strict';

const NOTICE = '候选视觉示意，尚待专业确认';

function visual(path) {
  return Object.freeze({ path, notice: NOTICE });
}

const cover = visual('/assets/candidate/cover.png');
const routes = Object.freeze({
  foil_making_candidate: visual('/assets/candidate/route-making.png'),
  foil_application_candidate: visual('/assets/candidate/route-application.png'),
});
const steps = Object.freeze({
  observe: visual('/assets/candidate/step-observe.png'),
  motion: visual('/assets/candidate/step-motion.png'),
  inspect: visual('/assets/candidate/step-inspect.png'),
});

function copy(value) { return value ? { ...value } : null; }

module.exports = {
  NOTICE,
  getCoverVisual: () => copy(cover),
  getRouteVisual: (routeId) => copy(routes[routeId]),
  getStepVisual: (stepId) => copy(steps[stepId]),
};
