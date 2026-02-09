const statusRepository = require('../repositories/status.repository');
const statusViewRepository = require('../repositories/statusView.repository');
const cacheService = require('./cache.service');
const contactService = require('./contact.service');

class StatusService {
    async createStatus(userId, statusData) {
        const status = await statusRepository.createStatus({
            user_id: userId,
            ...statusData
        });

        // Cache the status
        await cacheService.cacheStatus(status);

        // Invalidate user statuses cache
        await cacheService.cacheUserStatuses(userId, null);

        // Invalidate contact statuses cache for user's contacts
        const contacts = await contactService.getContacts(userId);
        for (const contact of contacts) {
            await cacheService.cacheContactStatuses(contact.contact_user_id, null);
        }

        return status;
    }

    async getStatus(statusId, useCache = true) {
        if (useCache) {
            const cachedStatus = await cacheService.getStatusFromCache(statusId);
            if (cachedStatus) {
                return cachedStatus;
            }
        }

        const status = await statusRepository.getStatusById(statusId);
        if (status) {
            await cacheService.cacheStatus(status);
        }

        return status;
    }

    async getUserStatuses(userId, includeArchived = false, useCache = true) {
        if (useCache && !includeArchived) {
            const cachedStatuses = await cacheService.getUserStatusesFromCache(userId);
            if (cachedStatuses && cachedStatuses.length > 0) {
                return cachedStatuses;
            }
        }

        const statuses = await statusRepository.getUserStatuses(userId, includeArchived);

        if (useCache && !includeArchived) {
            await cacheService.cacheUserStatuses(userId, statuses);
        }

        return statuses;
    }

    async getContactStatuses(userId, limit = 100, useCache = true) {
        if (useCache) {
            const cachedStatuses = await cacheService.getContactStatusesFromCache(userId);
            if (cachedStatuses && cachedStatuses.length > 0) {
                return cachedStatuses.slice(0, limit);
            }
        }

        const statuses = await statusRepository.getContactStatuses(userId, limit * 2);

        if (useCache) {
            await cacheService.cacheContactStatuses(userId, statuses);
        }

        return statuses.slice(0, limit);
    }

    async viewStatus(statusId, viewerId) {
        const status = await this.getStatus(statusId);

        if (!status) {
            throw new Error('Status not found');
        }

        // Check if viewer is a contact
        const isContact = await contactService.isContact(viewerId, status.user_id);
        if (!isContact) {
            throw new Error('Only contacts can view status');
        }

        // Check if already viewed
        const hasViewed = await statusViewRepository.hasViewed(statusId, viewerId);
        if (hasViewed) {
            return null;
        }

        const view = await statusViewRepository.addView(statusId, viewerId);

        // Update status cache with new view count
        status.view_count += 1;
        await cacheService.cacheStatus(status);

        // Invalidate status views cache
        await cacheService.cacheSearchResults('status_views', statusId, null);

        return view;
    }

    async getStatusViews(statusId, useCache = true) {
        const cacheKey = `status:${statusId}:views`;

        if (useCache) {
            const cachedViews = await cacheService.getSearchResultsFromCache('status_views', statusId);
            if (cachedViews) {
                return cachedViews;
            }
        }

        const views = await statusViewRepository.getStatusViews(statusId);

        if (useCache) {
            await cacheService.cacheSearchResults('status_views', statusId, views);
        }

        return views;
    }

    async updateStatus(statusId, userId, updateData) {
        const status = await this.getStatus(statusId);

        if (!status) {
            throw new Error('Status not found');
        }

        if (status.user_id !== userId) {
            throw new Error('Only status owner can update status');
        }

        const updatedStatus = await statusRepository.updateStatus(statusId, updateData);

        // Update cache
        await cacheService.cacheStatus(updatedStatus);
        await cacheService.cacheUserStatuses(userId, null);

        return updatedStatus;
    }

    async deleteStatus(statusId, userId) {
        const status = await this.getStatus(statusId);

        if (!status) {
            throw new Error('Status not found');
        }

        if (status.user_id !== userId) {
            throw new Error('Only status owner can delete status');
        }

        await statusRepository.deleteStatus(statusId);

        // Invalidate caches
        await cacheService.invalidateStatusCache(statusId, userId);
    }

    async archiveStatus(statusId, userId) {
        const status = await this.getStatus(statusId);

        if (!status) {
            throw new Error('Status not found');
        }

        if (status.user_id !== userId) {
            throw new Error('Only status owner can archive status');
        }

        const archivedStatus = await statusRepository.archiveStatus(statusId);

        // Update cache
        await cacheService.cacheStatus(archivedStatus);
        await cacheService.cacheUserStatuses(userId, null);

        return archivedStatus;
    }

    async searchStatuses(searchTerm, userId = null, useCache = true) {
        const cacheKey = `search:statuses:${searchTerm}:${userId || 'public'}`;

        if (useCache) {
            const cachedResults = await cacheService.getSearchResultsFromCache('statuses', searchTerm, userId);
            if (cachedResults) {
                return cachedResults;
            }
        }

        const statuses = await statusRepository.searchStatuses(searchTerm, userId);

        if (useCache) {
            await cacheService.cacheSearchResults('statuses', searchTerm, statuses, userId);
        }

        return statuses;
    }

    async getPopularStatuses(userId, limit = 10, useCache = true) {
        const cacheKey = `popular_statuses:${userId}`;

        if (useCache) {
            const cachedPopular = await cacheService.getSearchResultsFromCache('popular_statuses', userId);
            if (cachedPopular) {
                return cachedPopular.slice(0, limit);
            }
        }

        const popular = await statusViewRepository.getPopularStatuses(userId, limit * 2);

        if (useCache) {
            await cacheService.cacheSearchResults('popular_statuses', userId, popular);
        }

        return popular.slice(0, limit);
    }

    async getRecentViewers(statusOwnerId, hours = 24, useCache = true) {
        const cacheKey = `recent_viewers:${statusOwnerId}:${hours}`;

        if (useCache) {
            const cachedViewers = await cacheService.getSearchResultsFromCache('recent_viewers', statusOwnerId);
            if (cachedViewers) {
                return cachedViewers;
            }
        }

        const viewers = await statusViewRepository.getRecentViewers(statusOwnerId, hours);

        if (useCache) {
            await cacheService.cacheSearchResults('recent_viewers', statusOwnerId, viewers);
        }

        return viewers;
    }

    async warmStatusCache(statusId) {
        const status = await this.getStatus(statusId, false);
        const views = await this.getStatusViews(statusId, false);

        // Cache status and views
        await cacheService.cacheStatus(status);
        await cacheService.cacheSearchResults('status_views', statusId, views);

        // Warm user statuses cache
        if (status) {
            await this.getUserStatuses(status.user_id, false, false);
        }
    }

    async getStatusStats(statusId) {
        const status = await this.getStatus(statusId);
        const views = await this.getStatusViews(statusId);

        return {
            ...status,
            viewers: views.map(v => ({
                id: v.viewer_id,
                name: v.viewer_name,
                avatar: v.viewer_avatar
            })),
            unique_viewers: views.length,
            view_history: await this.getViewHistory(statusId)
        };
    }

    async getViewHistory(statusId, days = 7) {
        return await statusViewRepository.getViewHistory(statusId, days);
    }

    async cleanupExpiredStatuses() {
        const expiredStatuses = await statusRepository.getExpiredStatuses();

        for (const status of expiredStatuses) {
            await this.deleteStatus(status.id, status.user_id);
        }

        return expiredStatuses.length;
    }

    async getStatusInsights(userId) {
        const statuses = await this.getUserStatuses(userId);
        const totalViews = statuses.reduce((sum, status) => sum + status.view_count, 0);
        const activeStatuses = statuses.filter(s => new Date(s.expires_at) > new Date());

        return {
            total_statuses: statuses.length,
            active_statuses: activeStatuses.length,
            total_views: totalViews,
            avg_views: statuses.length > 0 ? totalViews / statuses.length : 0,
            most_viewed: statuses.reduce((max, status) =>
                status.view_count > max.view_count ? status : max,
                { view_count: 0 }
            ),
            recent_statuses: statuses.slice(0, 5)
        };
    }
}

module.exports = new StatusService();