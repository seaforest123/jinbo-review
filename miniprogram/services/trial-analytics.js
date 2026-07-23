const runtimeConfig = require('../config/runtime-config');
const { createCloudBaseEventAdapter, createCloudBaseIdentityAdapter } = require('./cloudbase-adapters');
const { createEventTracker } = require('./event-tracker');
const { createIdentityService } = require('./identity');

function createTrialAnalytics({ storage, cloudCall, idFactory, clock, routeId, capabilities }) {
  const identity = createIdentityService({
    storage,
    cloudCall: createCloudBaseIdentityAdapter({ callFunction: cloudCall }),
    idFactory,
  });
  let trackerPromise;

  async function getTracker() {
    if (!trackerPromise) {
      trackerPromise = identity.getAnonymousId().then((anonymousId) => createEventTracker({
        storage,
        transport: createCloudBaseEventAdapter({ callFunction: cloudCall }),
        clock,
        idFactory,
        context: {
          anonymousId,
          sessionId: identity.createSessionId(),
          routeId,
          appVersion: runtimeConfig.appVersion,
          deviceCapabilities: capabilities,
          testAccountTag: runtimeConfig.testAccountTag,
          environment: runtimeConfig.displayEnvironment,
        },
      })).catch(() => null);
    }
    return trackerPromise;
  }

  return {
    async track(name, properties) {
      const tracker = await getTracker();
      if (!tracker) return null;
      try {
        return await tracker.track(name, properties);
      } catch (error) {
        return null;
      }
    },
  };
}

module.exports = { createTrialAnalytics };
