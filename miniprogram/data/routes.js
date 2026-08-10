const { validateRoute } = require('../domain/route-config');

const candidateNotice = '候选示意，尚未经专业确认';

const routes = Object.freeze([
  validateRoute({
    id: 'foil_making_candidate',
    displayName: '制箔候选路线',
    status: 'internal_placeholder',
    reviewStatus: 'internal_approved',
    allowedEnvironments: ['development', 'trial'],
    banner: candidateNotice,
    steps: [
      { id: 'twist', order: 1, adapter: 'cut', title: '做捻子' },
      { id: 'pack', order: 2, adapter: 'place', title: '装家生' },
      { id: 'hammer', order: 3, adapter: 'hammer', title: '打箔' },
      { id: 'inspect', order: 4, adapter: 'inspect', title: '出具检查' },
      { id: 'finish', order: 5, adapter: 'finish', title: '切箔成叶' },
    ],
  }),
  validateRoute({
    id: 'foil_application_candidate',
    displayName: '用箔候选路线',
    status: 'internal_placeholder',
    reviewStatus: 'internal_approved',
    allowedEnvironments: ['development', 'trial'],
    banner: candidateNotice,
    steps: [
      { id: 'twist', order: 1, adapter: 'cut', title: '做捻子' },
      { id: 'pack', order: 2, adapter: 'place', title: '装家生' },
      { id: 'hammer', order: 3, adapter: 'hammer', title: '打箔' },
      { id: 'inspect', order: 4, adapter: 'inspect', title: '出具检查' },
      { id: 'finish', order: 5, adapter: 'finish', title: '切箔成叶' },
    ],
  }),
]);

module.exports = routes;
