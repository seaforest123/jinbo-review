const candidateNotice = '候选示意，尚未经专业确认';
const allowedEnvironments = ['development', 'trial'];

const routes = [
  {
    id: 'foil_making_candidate',
    displayName: '制箔候选路线',
    status: 'internal_placeholder',
    reviewStatus: 'internal_approved',
    allowedEnvironments,
    banner: candidateNotice,
    steps: [
      { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
      { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
      { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
    ],
  },
  {
    id: 'foil_application_candidate',
    displayName: '用箔候选路线',
    status: 'internal_placeholder',
    reviewStatus: 'internal_approved',
    allowedEnvironments,
    banner: candidateNotice,
    steps: [
      { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
      { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
      { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
    ],
  },
];

module.exports = Object.freeze(routes);
