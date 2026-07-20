const ANONYMOUS_ID_KEY = 'goldFoilAnonymousId';
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const RAW_ID_PATTERN = /^[a-f0-9]{16,64}$/;

function isAnonymousId(value) {
  return typeof value === 'string' && ANONYMOUS_ID_PATTERN.test(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readAnonymousId(response) {
  const keys = isPlainObject(response) ? Reflect.ownKeys(response) : [];
  if (
    !isPlainObject(response)
    || keys.length !== 1
    || keys[0] !== 'anonymousId'
    || !isAnonymousId(response.anonymousId)
  ) {
    throw new TypeError('invalid anonymous identity response');
  }
  return response.anonymousId;
}

function createIdentityService({ storage, cloudCall, idFactory }) {
  let pendingBootstrap;
  const generatedSessionIds = new Set();

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
      const rawId = idFactory();
      if (typeof rawId !== 'string' || !RAW_ID_PATTERN.test(rawId)) {
        throw new TypeError('invalid session id');
      }
      if (generatedSessionIds.has(rawId)) {
        throw new Error('duplicate session id');
      }
      generatedSessionIds.add(rawId);
      return `session_${rawId}`;
    },
  };
}

module.exports = { createIdentityService };
