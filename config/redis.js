const Redis = require('ioredis');
require('dotenv').config();

class RedisClient {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
    }

    async connect() {
        try {
            this.client = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || null,
                db: process.env.REDIS_DB || 0,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true
            });

            this.subscriber = this.client.duplicate();
            this.publisher = this.client.duplicate();

            // Event listeners
            this.client.on('connect', () => {
                console.log('✅ Redis connected successfully');
            });

            this.client.on('error', (error) => {
                console.error('❌ Redis connection error:', error);
            });

            this.client.on('ready', () => {
                console.log('✅ Redis ready for operations');
            });

            // Test connection
            await this.client.ping();
            return this.client;
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            throw error;
        }
    }

    getClient() {
        return this.client;
    }

    getSubscriber() {
        return this.subscriber;
    }

    getPublisher() {
        return this.publisher;
    }

    async get(key) {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    async set(key, value, ttl = null) {
        try {
            const stringValue = JSON.stringify(value);
            if (ttl) {
                await this.client.setex(key, ttl, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }
            return true;
        } catch (error) {
            console.error('Redis set error:', error);
            return false;
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Redis delete error:', error);
            return false;
        }
    }

    async exists(key) {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis exists error:', error);
            return false;
        }
    }

    async expire(key, seconds) {
        try {
            await this.client.expire(key, seconds);
            return true;
        } catch (error) {
            console.error('Redis expire error:', error);
            return false;
        }
    }

    async keys(pattern) {
        try {
            return await this.client.keys(pattern);
        } catch (error) {
            console.error('Redis keys error:', error);
            return [];
        }
    }

    async flushPattern(pattern) {
        try {
            const keys = await this.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return keys.length;
        } catch (error) {
            console.error('Redis flush pattern error:', error);
            return 0;
        }
    }

    async hset(key, field, value) {
        try {
            await this.client.hset(key, field, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Redis hset error:', error);
            return false;
        }
    }

    async hget(key, field) {
        try {
            const data = await this.client.hget(key, field);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis hget error:', error);
            return null;
        }
    }

    async hdel(key, field) {
        try {
            await this.client.hdel(key, field);
            return true;
        } catch (error) {
            console.error('Redis hdel error:', error);
            return false;
        }
    }

    async publish(channel, message) {
        try {
            await this.publisher.publish(channel, JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Redis publish error:', error);
            return false;
        }
    }

    async subscribe(channel, callback) {
        try {
            await this.subscriber.subscribe(channel);
            this.subscriber.on('message', (ch, message) => {
                if (ch === channel) {
                    callback(JSON.parse(message));
                }
            });
            return true;
        } catch (error) {
            console.error('Redis subscribe error:', error);
            return false;
        }
    }

    async mget(keys) {
        try {
            const results = await this.client.mget(keys);
            return results.map(result => result ? JSON.parse(result) : null);
        } catch (error) {
            console.error('Redis mget error:', error);
            return [];
        }
    }

    async mset(keyValues, ttl = null) {
        try {
            const pipeline = this.client.pipeline();

            Object.entries(keyValues).forEach(([key, value]) => {
                pipeline.set(key, JSON.stringify(value));
                if (ttl) {
                    pipeline.expire(key, ttl);
                }
            });

            await pipeline.exec();
            return true;
        } catch (error) {
            console.error('Redis mset error:', error);
            return false;
        }
    }

    async increment(key, by = 1) {
        try {
            return await this.client.incrby(key, by);
        } catch (error) {
            console.error('Redis increment error:', error);
            return null;
        }
    }

    async decrement(key, by = 1) {
        try {
            return await this.client.decrby(key, by);
        } catch (error) {
            console.error('Redis decrement error:', error);
            return null;
        }
    }

    async sadd(key, ...members) {
        try {
            return await this.client.sadd(key, ...members);
        } catch (error) {
            console.error('Redis sadd error:', error);
            return 0;
        }
    }

    async smembers(key) {
        try {
            return await this.client.smembers(key);
        } catch (error) {
            console.error('Redis smembers error:', error);
            return [];
        }
    }

    async srem(key, ...members) {
        try {
            return await this.client.srem(key, ...members);
        } catch (error) {
            console.error('Redis srem error:', error);
            return 0;
        }
    }

    async sismember(key, member) {
        try {
            return await this.client.sismember(key, member) === 1;
        } catch (error) {
            console.error('Redis sismember error:', error);
            return false;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.quit();
            }
            if (this.subscriber) {
                await this.subscriber.quit();
            }
            if (this.publisher) {
                await this.publisher.quit();
            }
            console.log('✅ Redis disconnected');
        } catch (error) {
            console.error('❌ Redis disconnect error:', error);
        }
    }
}

module.exports = new RedisClient();