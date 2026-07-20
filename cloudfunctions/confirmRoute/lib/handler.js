'use strict';

const {
  isAuthorizedReviewer,
  validateRouteCandidate,
  buildConfirmedRoute,
} = require('./approval');

function parseReviewerIds(value) {
  return typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function createConfirmRouteHandler({ getWXContext, environment, hashIdentity, database }) {
  if (
    typeof getWXContext !== 'function'
    || typeof hashIdentity !== 'function'
    || !database
    || typeof database.collection !== 'function'
  ) {
    throw new TypeError('invalid confirmRoute dependencies');
  }
  return async function confirmRoute(event) {
    const candidate = validateRouteCandidate(event);
    const wxContext = getWXContext();
    const openid = wxContext && wxContext.OPENID;
    if (typeof openid !== 'string' || openid.trim() === '') {
      throw new TypeError('trusted mini-program context is required');
    }
    const anonymousId = hashIdentity(openid, environment && environment.ANONYMIZATION_SALT);
    const reviewerIds = parseReviewerIds(environment && environment.APPROVER_IDS);
    if (!isAuthorizedReviewer(anonymousId, reviewerIds)) {
      throw new Error('caller is not an authorized reviewer');
    }
    const contentResult = await database.collection('content_items').doc(candidate.contentItemId).get();
    const confirmedRoute = buildConfirmedRoute(candidate, contentResult && contentResult.data);
    await database.collection('app_config').doc(confirmedRoute.routeId).set({ data: confirmedRoute });
    return { confirmed: true };
  };
}

module.exports = { createConfirmRouteHandler };
