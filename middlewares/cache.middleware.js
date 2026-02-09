// middlewares/cache.middleware.js
const cacheService = require('../app/services/cache.service');

function cacheMiddleware(ttl = 60) {
    return async (req, res, next) => {
        const key = `route:${req.originalUrl}:${JSON.stringify(req.query)}:${JSON.stringify(req.params)}`;

        // Skip cache for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip cache if explicitly requested
        if (req.query.nocache === 'true') {
            return next();
        }

        try {
            const cachedData = await cacheService.getFromCache(key);
            if (cachedData) {
                console.log(`Cache hit: ${key}`);
                return res.json(cachedData);
            }

            console.log(`Cache miss: ${key}`);

            // Store original res.json function
            const originalJson = res.json;

            // Override res.json to cache the response
            res.json = function (data) {
                // Cache the response
                cacheService.set(key, data, ttl).catch(console.error);

                // Call original res.json
                return originalJson.call(this, data);
            };

            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
}

function cacheInvalidationMiddleware(patternFactories = []) {
    return async (req, res, next) => {
        const originalJson = res.json;

        res.json = async function (data) {
            const result = originalJson.call(this, data);

            if (req.method !== 'GET' && res.statusCode < 400) {
                try {
                    for (const factory of patternFactories) {
                        const pattern = factory(req);
                        if (pattern) {
                            await cacheService.flushPattern(pattern);
                        }
                    }

                    const routeKey = `route:${req.baseUrl}${req.path}*`;
                    await cacheService.flushPattern(routeKey);

                    console.log('Cache invalidated');
                } catch (err) {
                    console.error('Cache invalidation error:', err);
                }
            }

            return result;
        };

        next();
    };
}

function userCacheMiddleware() {
    return cacheInvalidationMiddleware([
        (req) => `user:${req.user?.id}:*`,
        (req) => `*:${req.user?.id}:*`
    ]);
}

function groupCacheMiddleware(groupIdParam = 'groupId') {
    return cacheInvalidationMiddleware([
        (req) => `group:${req.params[groupIdParam]}:*`,
        (req) => `*:${req.params[groupIdParam]}:*`
    ]);
}

function conversationCacheMiddleware(conversationIdParam = 'conversationId') {
    return cacheInvalidationMiddleware([
        (req) => `conversation:${req.params[conversationIdParam]}:*`,
        (req) => `*:${req.params[conversationIdParam]}:*`
    ]);
}

module.exports = {
    cacheMiddleware,
    cacheInvalidationMiddleware,
    userCacheMiddleware,
    groupCacheMiddleware,
    conversationCacheMiddleware
};