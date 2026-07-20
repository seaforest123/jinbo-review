const runtimeConfig = require('../config/runtime-config');
const { getVisibleRoutes } = require('../domain/route-config');

const PERMITTED_REVIEW_STATUSES = ['internal_approved'];

function createContentRepository({ database, localRoutes }) {
  return {
    async loadRoutes(environment = runtimeConfig.displayEnvironment) {
      try {
        const response = await database
          .collection('app_config')
          .where({
            allowedEnvironment: environment,
            reviewStatus: database.command.in(PERMITTED_REVIEW_STATUSES),
          })
          .get();
        return getVisibleRoutes(response.data, environment);
      } catch (error) {
        console.error(error && error.code);
        return getVisibleRoutes(localRoutes, environment);
      }
    },
  };
}

module.exports = { createContentRepository };
