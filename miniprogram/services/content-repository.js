const { getVisibleRoutes, validateRoute } = require('../domain/route-config');

const PERMITTED_REVIEW_STATUSES = ['internal_approved'];

function createContentRepository({ database, localRoutes }) {
  return {
    async loadRoutes(environment) {
      try {
        const response = await database
          .collection('app_config')
          .where({
            allowedEnvironment: environment,
            reviewStatus: database.command.in(PERMITTED_REVIEW_STATUSES),
          })
          .get();
        return response.data.map(validateRoute);
      } catch (error) {
        console.error(error && error.code);
        return getVisibleRoutes(localRoutes, environment);
      }
    },
  };
}

module.exports = { createContentRepository };
