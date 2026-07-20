const test = require('node:test');
const assert = require('node:assert/strict');
const localRoutes = require('../../miniprogram/data/routes');
const { createContentRepository } = require('../../miniprogram/services/content-repository');

function createDatabase({ result, error }) {
  let collectionName;
  let query;
  let permittedReviewStatuses;

  return {
    database: {
      command: {
        in: (statuses) => {
          permittedReviewStatuses = statuses;
          return { $in: statuses };
        },
      },
      collection: (name) => {
        collectionName = name;
        return {
          where: (conditions) => {
            query = conditions;
            return {
              get: async () => {
                if (error) throw error;
                return result;
              },
            };
          },
        };
      },
    },
    inspected: () => ({ collectionName, query, permittedReviewStatuses }),
  };
}

test('loads validated CloudBase routes using the trial environment and permitted review status', async () => {
  const cloudRoute = { ...localRoutes[0], allowedEnvironment: 'trial' };
  const fixture = createDatabase({ result: { data: [cloudRoute] } });
  const repository = createContentRepository({ database: fixture.database, localRoutes });

  const routes = await repository.loadRoutes('trial');

  assert.equal(routes[0].id, cloudRoute.id);
  assert.ok(Object.isFrozen(routes[0]));
  assert.deepEqual(fixture.inspected(), {
    collectionName: 'app_config',
    query: {
      allowedEnvironment: 'trial',
      reviewStatus: { $in: ['internal_approved'] },
    },
    permittedReviewStatuses: ['internal_approved'],
  });
});

test('falls back to validated local routes and logs only the CloudBase error code', async () => {
  const fixture = createDatabase({ error: { code: 'CONFIG_READ_FAILED', content: 'do not log this' } });
  const repository = createContentRepository({ database: fixture.database, localRoutes });
  const previousConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  try {
    const routes = await repository.loadRoutes('trial');
    assert.deepEqual(routes.map((route) => route.id), localRoutes.map((route) => route.id));
    assert.ok(routes.every(Object.isFrozen));
  } finally {
    console.error = previousConsoleError;
  }

  assert.deepEqual(logged, [['CONFIG_READ_FAILED']]);
});
