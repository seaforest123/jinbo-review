class RouteConfigError extends Error {}

const STATUSES = new Set(['internal_placeholder', 'candidate', 'confirmed']);
const REVIEW_STATUSES = new Set(['internal_approved']);
const ENVIRONMENTS = new Set(['development', 'trial', 'production']);
const ADAPTERS = new Set(['select', 'continuous-drag', 'inspect', 'xr-frame']);

function hasText(value) {
  return typeof value === 'string' && value.trim();
}

function validateRoute(route) {
  if (!route || !hasText(route.id)) throw new RouteConfigError('路线缺少 id');
  if (!hasText(route.displayName)) throw new RouteConfigError('路线缺少 displayName');
  if (!STATUSES.has(route.status)) throw new RouteConfigError('路线状态无效');
  if (!REVIEW_STATUSES.has(route.reviewStatus)) throw new RouteConfigError('路线审核状态无效');
  if (!Array.isArray(route.allowedEnvironments) || !route.allowedEnvironments.length) throw new RouteConfigError('路线可见环境无效');
  if (route.allowedEnvironments.some((environment) => !ENVIRONMENTS.has(environment))) throw new RouteConfigError('路线可见环境无效');
  if (new Set(route.allowedEnvironments).size !== route.allowedEnvironments.length) throw new RouteConfigError('路线可见环境不能重复');
  if (!hasText(route.banner)) throw new RouteConfigError('路线缺少 banner');
  if (!Array.isArray(route.steps) || route.steps.length !== 3) throw new RouteConfigError('路线必须包含三个步骤');
  if (route.steps.some((step) => !step || typeof step !== 'object')) throw new RouteConfigError('步骤无效');
  if (route.steps.some((step) => !hasText(step.id) || !hasText(step.title))) throw new RouteConfigError('步骤缺少 id 或 title');
  if (route.steps.some((step) => !Number.isInteger(step.order))) throw new RouteConfigError('步骤顺序必须是 1,2,3');
  if (route.steps.some((step) => !hasText(step.adapter))) throw new RouteConfigError('步骤缺少交互适配器');
  const orders = route.steps.map((step) => step.order).join(',');
  if (orders !== '1,2,3') throw new RouteConfigError('步骤顺序必须是 1,2,3');
  const ids = new Set(route.steps.map((step) => step.id));
  if (ids.size !== 3) throw new RouteConfigError('步骤 id 必须唯一');
  if (route.steps.some((step) => !ADAPTERS.has(step.adapter))) throw new RouteConfigError('交互适配器无效');
  return Object.freeze({
    ...route,
    allowedEnvironments: Object.freeze([...route.allowedEnvironments]),
    steps: Object.freeze(route.steps.map((step) => Object.freeze({ ...step }))),
  });
}

function getVisibleRoutes(routes, environment) {
  return routes
    .map(validateRoute)
    .filter((route) => route.allowedEnvironments.includes(environment))
    .filter((route) => environment !== 'production' || route.status === 'confirmed');
}

module.exports = { RouteConfigError, validateRoute, getVisibleRoutes };
