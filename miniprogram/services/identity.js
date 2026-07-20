const ANONYMOUS_ID_KEY = 'goldFoilAnonymousId';
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;

function isAnonymousId(value) {
  return typeof value === 'string' && ANONYMOUS_ID_PATTERN.test(value);
}

function hasRawPlatformIdentifier(value, visited = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (visited.has(value)) return false;
  visited.add(value);
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.toLowerCase();
    return (
      normalizedKey === 'openid'
      || normalizedKey === 'unionid'
      || hasRawPlatformIdentifier(child, visited)
    );
  });
}

function readAnonymousId(response) {
  if (
    !response
    || typeof response !== 'object'
    || Array.isArray(response)
    || hasRawPlatformIdentifier(response)
    || !isAnonymousId(response.anonymousId)
  ) {
    throw new TypeError('invalid anonymous identity response');
  }
  return response.anonymousId;
}

function createIdentityService({ storage, cloudCall, idFactory }) {
  let pendingBootstrap;

  async function bootstrapAnonymousId() {
    const response = await cloudCall('bootstrapAnonymousId');
    const anonymousId = readAnonymousId(response);
    await storage.set(ANONYMOUS_ID_KEY, anonymousId);
    return anonymousId;
  }

  return {
    async getAnonymousId(...callerInput) {
      if (callerInput.length > 0) {
        throw new TypeError('caller input is not accepted');
      }

      const cached = await storage.get(ANONYMOUS_ID_KEY);
      if (isAnonymousId(cached)) return cached;

      if (!pendingBootstrap) {
        pendingBootstrap = bootstrapAnonymousId().finally(() => {
          pendingBootstrap = undefined;
        });
      }
      return pendingBootstrap;
    },

    createSessionId() {
      return `session_${idFactory()}`;
    },
  };
}

module.exports = { createIdentityService };
