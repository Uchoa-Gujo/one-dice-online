function wrapAsyncRouter(router) {
  router.stack.forEach(layer => {
    if (!layer.route) return;
    layer.route.stack.forEach(routeLayer => {
      const handler = routeLayer.handle;
      if (typeof handler !== 'function' || handler.length >= 4 || handler.__oneDiceAsyncWrapped) return;
      const wrapped = function oneDiceAsyncRouteGuard(req, res, next) {
        try {
          return Promise.resolve(handler(req, res, next)).catch(next);
        } catch (error) {
          return next(error);
        }
      };
      wrapped.__oneDiceAsyncWrapped = true;
      routeLayer.handle = wrapped;
    });
  });
  return router;
}

module.exports = wrapAsyncRouter;
