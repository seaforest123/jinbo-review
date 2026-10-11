'use strict';

const {
  isAuthorizedReviewer,
  validateRouteCandidate,
  buildConfirmedRoute,
} = require('./approval');
const { resolveTrustedAnonymousId, readApproverIds } = require('./security-context');

function createConfirmRouteHandler({
  getWXContext,
  environment,
  hashIdentity,
  database,
  serverDate,
}) {
  if (
    typeof getWXContext !== 'function'
    || typeof hashIdentity !== 'function'
    || !database
    || typeof database.runTransaction !== 'function'
    || typeof serverDate !== 'function'
  ) {
    throw new TypeError('invalid confirmRoute dependencies');
  }
  return async function confirmRoute(event) {
    const candidate = validateRouteCandidate(event);
    const anonymousId = resolveTrustedAnonymousId({ getWXContext, environment, hashIdentity });
    const reviewerIds = readApproverIds(environment);
    if (!isAuthorizedReviewer(anonymousId, reviewerIds)) {
      throw new Error('caller is not an authorized reviewer');
    }
    await database.runTransaction(async (transaction) => {
      const contentResult = await transaction
        .collection('content_items')
        .doc(candidate.contentItemId)
        .get();
      const routeResult = await transaction
        .collection('app_config')
        .doc(candidate.routeId)
        .get();
      const approvedAt = serverDate();
      const confirmedRoute = buildConfirmedRoute(
        candidate,
        contentResult && contentResult.data,
        routeResult && routeResult.data,
        { reviewerAnonymousId: anonymousId, approvedAt },
      );
      await transaction
        .collection('app_config')
        .doc(candidate.routeId)
        .set({ data: confirmedRoute });
    });
    return { confirmed: true };
  };
}

module.exports = { createConfirmRouteHandler };
