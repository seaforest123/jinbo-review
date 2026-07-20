class RouteConfigError extends Error {}

const STATUSES = new Set(['internal_placeholder', 'candidate', 'confirmed']);
const ADAPTERS = new Set(['select', 'continuous-drag', 'inspect', 'xr-frame']);

function validateRoute(route) {
  if (!route || typeof route.id !== 'string' || !route.id) throw new RouteConfigError('路线缺少 id');
  if (!STATUSES.has(route.status)) throw new RouteConfigError('路线状态无效');
  if (!Array.isArray(route.steps) || route.steps.length !== 3) throw new RouteConfigError('路线必须包含三个步骤');
  const orders = route.steps.map((step) => step.order).join(',');
  if (orders !== '1,2,3') throw new RouteConfigError('步骤顺序必须是 1,2,3');
  const ids = new Set(route.steps.map((step) => step.id));
  if (ids.size !== 3) throw new RouteConfigError('步骤 id 必须唯一');
  if (route.steps.some((step) => !ADAPTERS.has(step.adapter))) throw new RouteConfigError('交互适配器无效');
  return Object.freeze({ ...route, steps: route.steps.map((step) => Object.freeze({ ...step })) });
}

function getVisibleRoutes(routes, environment) {
  return routes.map(validateRoute).filter((route) => route.allowedEnvironments.includes(environment));
}

module.exports = { RouteConfigError, validateRoute, getVisibleRoutes };
