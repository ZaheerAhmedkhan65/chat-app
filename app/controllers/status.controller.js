const ApiResponse = require('../utils/response');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError
} = require('../utils/error');
const statusService = require('../services/status.service');
const notificationService = require('../services/notification.service');

class StatusController {
    async createStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                type,
                content,
                media_url,
                background_color,
                text_color,
                font_style,
                expires_in_hours = 24
            } = req.body;

            if (!type || !['text', 'image', 'video'].includes(type)) {
                throw new ValidationError('Type must be text, image, or video');
            }

            if (type === 'text' && !content) {
                throw new ValidationError('Content is required for text status');
            }

            if ((type === 'image' || type === 'video') && !media_url) {
                throw new ValidationError('Media URL is required for image/video status');
            }

            // Calculate expiration time
            const expires_at = new Date();
            expires_at.setHours(expires_at.getHours() + expires_in_hours);

            const status = await statusService.createStatus(userId, {
                type,
                content,
                media_url,
                background_color,
                text_color,
                font_style,
                expires_at
            });

            res.status(201).json(ApiResponse.success({
                status
            }, 'Status created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);

            const status = await statusService.getStatus(statusId);
            if (!status) {
                throw new NotFoundError('Status not found');
            }

            // Check if user can view status (must be contact)
            const contactService = require('../services/contact.service');
            const isContact = await contactService.isContact(userId, status.user_id);
            if (!isContact && userId !== status.user_id) {
                throw new ForbiddenError('You cannot view this status');
            }

            // Mark as viewed if not the owner
            if (userId !== status.user_id) {
                await statusService.viewStatus(statusId, userId);

                // Send notification
                await notificationService.sendStatusViewNotification(status.user_id, userId, statusId);
            }

            res.json(ApiResponse.success({
                status
            }, 'Status retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserStatuses(req, res, next) {
        try {
            const userId = req.user.id;
            const { include_archived = false } = req.query;

            const statuses = await statusService.getUserStatuses(userId, include_archived === 'true');

            res.json(ApiResponse.success(statuses, 'User statuses retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getContactStatuses(req, res, next) {
        try {
            const userId = req.user.id;
            const { limit = 100 } = req.query;

            const statuses = await statusService.getContactStatuses(userId, parseInt(limit));

            res.json(ApiResponse.success(statuses, 'Contact statuses retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);
            const updateData = req.body;

            const status = await statusService.updateStatus(statusId, userId, updateData);

            res.json(ApiResponse.success({
                status
            }, 'Status updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);

            await statusService.deleteStatus(statusId, userId);

            res.json(ApiResponse.success(null, 'Status deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async archiveStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);

            const status = await statusService.archiveStatus(statusId, userId);

            res.json(ApiResponse.success({
                status
            }, 'Status archived successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getStatusViews(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);

            // Check if user owns the status
            const status = await statusService.getStatus(statusId);
            if (!status || status.user_id !== userId) {
                throw new ForbiddenError('You can only view views of your own status');
            }

            const views = await statusService.getStatusViews(statusId);

            res.json(ApiResponse.success({
                views
            }, 'Status views retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async searchStatuses(req, res, next) {
        try {
            const userId = req.user.id;
            const { search } = req.query;

            if (!search || search.trim().length < 2) {
                throw new ValidationError('Search term must be at least 2 characters');
            }

            const statuses = await statusService.searchStatuses(search, userId);

            res.json(ApiResponse.success(statuses, 'Status search results retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getPopularStatuses(req, res, next) {
        try {
            const userId = req.user.id;
            const { limit = 10 } = req.query;

            const popularStatuses = await statusService.getPopularStatuses(userId, parseInt(limit));

            res.json(ApiResponse.success(popularStatuses, 'Popular statuses retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getRecentViewers(req, res, next) {
        try {
            const userId = req.user.id;
            const { hours = 24 } = req.query;

            const recentViewers = await statusService.getRecentViewers(userId, parseInt(hours));

            res.json(ApiResponse.success(recentViewers, 'Recent viewers retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getStatusStats(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);

            // Check if user owns the status
            const status = await statusService.getStatus(statusId);
            if (!status || status.user_id !== userId) {
                throw new ForbiddenError('You can only view stats of your own status');
            }

            const stats = await statusService.getStatusStats(statusId);

            res.json(ApiResponse.success(stats, 'Status stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getStatusInsights(req, res, next) {
        try {
            const userId = req.user.id;

            const insights = await statusService.getStatusInsights(userId);

            res.json(ApiResponse.success(insights, 'Status insights retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getViewHistory(req, res, next) {
        try {
            const userId = req.user.id;
            const statusId = parseInt(req.params.statusId);
            const { days = 7 } = req.query;

            // Check if user owns the status
            const status = await statusService.getStatus(statusId);
            if (!status || status.user_id !== userId) {
                throw new ForbiddenError('You can only view history of your own status');
            }

            const viewHistory = await statusService.getViewHistory(statusId, parseInt(days));

            res.json(ApiResponse.success(viewHistory, 'View history retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async cleanupExpiredStatuses(req, res, next) {
        try {
            const userId = req.user.id;

            // Only allow admin or the user themselves
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can cleanup expired statuses');
            }

            const cleanedCount = await statusService.cleanupExpiredStatuses();

            res.json(ApiResponse.success({
                cleaned_count: cleanedCount
            }, 'Expired statuses cleaned up successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new StatusController();