const ApiResponse = require('../utils/response');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/error');
const contactService = require('../services/contact.service');
const notificationService = require('../services/notification.service');

class ContactController {
    async getContacts(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                search,
                is_favorite,
                is_blocked,
                limit = 100,
                offset = 0
            } = req.query;

            const filters = {};
            if (search) filters.search = search;
            if (is_favorite !== undefined) filters.is_favorite = is_favorite === 'true';
            if (is_blocked !== undefined) filters.is_blocked = is_blocked === 'true';
            if (limit) filters.limit = parseInt(limit);
            if (offset) filters.offset = parseInt(offset);

            const contacts = await contactService.getContacts(userId, filters);

            res.json(ApiResponse.paginate(contacts, {
                total: contacts.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async addContact(req, res, next) {
        try {
            const userId = req.user.id;
            const { contact_id, nickname } = req.body;

            if (!contact_id) {
                throw new ValidationError('Contact ID is required');
            }

            if (userId === contact_id) {
                throw new ValidationError('Cannot add yourself as a contact');
            }

            // Check if already a contact
            const existingContact = await contactService.getContact(userId, contact_id);
            if (existingContact) {
                throw new ConflictError('User is already in your contacts');
            }

            const contact = await contactService.addContact(userId, contact_id, nickname);

            // Send notification
            await notificationService.sendContactRequestNotification(userId, contact_id);

            res.status(201).json(ApiResponse.success({
                contact
            }, 'Contact added successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateContact(req, res, next) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.contactId);
            const updateData = req.body;

            const contact = await contactService.updateContact(userId, contactId, updateData);

            res.json(ApiResponse.success({
                contact
            }, 'Contact updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteContact(req, res, next) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.contactId);

            await contactService.deleteContact(userId, contactId);

            res.json(ApiResponse.success(null, 'Contact removed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async toggleFavorite(req, res, next) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.contactId);

            const isFavorite = await contactService.toggleFavorite(userId, contactId);

            res.json(ApiResponse.success({
                is_favorite: isFavorite
            }, `Contact ${isFavorite ? 'added to' : 'removed from'} favorites`));
        } catch (error) {
            next(error);
        }
    }

    async toggleBlock(req, res, next) {
        try {
            const userId = req.user.id;
            const contactId = parseInt(req.params.contactId);

            const isBlocked = await contactService.toggleBlock(userId, contactId);

            res.json(ApiResponse.success({
                is_blocked: isBlocked
            }, `Contact ${isBlocked ? 'blocked' : 'unblocked'} successfully`));
        } catch (error) {
            next(error);
        }
    }

    async getBlockedContacts(req, res, next) {
        try {
            const userId = req.user.id;
            const blockedContacts = await contactService.getBlockedContacts(userId);

            res.json(ApiResponse.success(blockedContacts, 'Blocked contacts retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getFavoriteContacts(req, res, next) {
        try {
            const userId = req.user.id;
            const favoriteContacts = await contactService.getFavoriteContacts(userId);

            res.json(ApiResponse.success(favoriteContacts, 'Favorite contacts retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getMutualContacts(req, res, next) {
        try {
            const userId = req.user.id;
            const otherUserId = parseInt(req.params.userId);

            const mutualContacts = await contactService.getMutualContacts(userId, otherUserId);

            res.json(ApiResponse.success(mutualContacts, 'Mutual contacts retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async sendContactRequest(req, res, next) {
        try {
            const userId = req.user.id;
            const { recipient_id, message } = req.body;

            if (!recipient_id) {
                throw new ValidationError('Recipient ID is required');
            }

            if (userId === recipient_id) {
                throw new ValidationError('Cannot send contact request to yourself');
            }

            const request = await contactService.sendContactRequest(userId, recipient_id, message);

            res.status(201).json(ApiResponse.success({
                request
            }, 'Contact request sent successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getPendingRequests(req, res, next) {
        try {
            const userId = req.user.id;
            const { type = 'received' } = req.query;

            let requests;
            if (type === 'received') {
                requests = await contactService.getPendingRequests(userId);
            } else {
                // Get sent requests
                const contactRequestRepository = require('../repositories/contactRequest.repository');
                requests = await contactRequestRepository.getSentRequests(userId);
            }

            res.json(ApiResponse.success(requests, 'Contact requests retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async acceptContactRequest(req, res, next) {
        try {
            const userId = req.user.id;
            const requestId = parseInt(req.params.requestId);

            const request = await contactService.acceptContactRequest(requestId, userId);

            res.json(ApiResponse.success({
                request
            }, 'Contact request accepted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async rejectContactRequest(req, res, next) {
        try {
            const userId = req.user.id;
            const requestId = parseInt(req.params.requestId);

            const request = await contactService.rejectContactRequest(requestId, userId);

            res.json(ApiResponse.success({
                request
            }, 'Contact request rejected successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getContactStats(req, res, next) {
        try {
            const userId = req.user.id;
            const stats = await contactService.getContactStats(userId);

            res.json(ApiResponse.success(stats, 'Contact stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async warmContactCache(req, res, next) {
        try {
            const userId = req.user.id;
            await contactService.warmContactCache(userId);

            res.json(ApiResponse.success(null, 'Contact cache warmed successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ContactController();