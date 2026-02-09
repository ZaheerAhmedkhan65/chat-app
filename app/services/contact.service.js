const contactRepository = require('../repositories/contact.repository');
const contactRequestRepository = require('../repositories/contactRequest.repository');
const cacheService = require('./cache.service');
const userService = require('./user.service');

class ContactService {
    async addContact(userId, contactUserId, nickname = null) {
        const contact = await contactRepository.createContact(userId, contactUserId, nickname);

        // Invalidate cache for both users
        await cacheService.invalidateContactCache(userId);
        await cacheService.invalidateContactCache(contactUserId);

        // Warm cache for better performance
        await this.warmContactCache(userId);
        await this.warmContactCache(contactUserId);

        return contact;
    }

    async getContacts(userId, filters = {}, useCache = true) {
        const cacheKey = `contacts:${userId}:${JSON.stringify(filters)}`;

        if (useCache) {
            const cachedContacts = await cacheService.getUserContactsFromCache(userId);
            if (cachedContacts && cachedContacts.length > 0) {
                // Apply filters to cached data
                return this.applyContactFilters(cachedContacts, filters);
            }
        }

        const contacts = await contactRepository.getUserContacts(userId, filters);

        if (useCache && !filters.search) {
            await cacheService.cacheUserContacts(userId, contacts);
        }

        return contacts;
    }

    applyContactFilters(contacts, filters) {
        let filtered = [...contacts];

        if (filters.is_favorite !== undefined) {
            filtered = filtered.filter(c => c.is_favorite === filters.is_favorite);
        }

        if (filters.is_blocked !== undefined) {
            filtered = filtered.filter(c => c.is_blocked === filters.is_blocked);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.contact_name.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    async getContact(userId, contactUserId, useCache = true) {
        if (useCache) {
            const cachedContact = await cacheService.getContactFromCache(userId, contactUserId);
            if (cachedContact) {
                return cachedContact;
            }
        }

        const contact = await contactRepository.getContact(userId, contactUserId);

        if (contact && useCache) {
            await cacheService.cacheUserContacts(userId, [contact]);
        }

        return contact;
    }

    async updateContact(userId, contactUserId, updateData) {
        const contact = await contactRepository.updateContact(userId, contactUserId, updateData);

        // Invalidate cache
        await cacheService.invalidateContactCache(userId);

        return contact;
    }

    async deleteContact(userId, contactUserId) {
        await contactRepository.deleteContact(userId, contactUserId);

        // Invalidate cache for both users
        await cacheService.invalidateContactCache(userId);
        await cacheService.invalidateContactCache(contactUserId);
    }

    async toggleFavorite(userId, contactUserId) {
        const isFavorite = await contactRepository.toggleFavorite(userId, contactUserId);

        // Invalidate cache
        await cacheService.invalidateContactCache(userId);

        return isFavorite;
    }

    async toggleBlock(userId, contactUserId) {
        const isBlocked = await contactRepository.toggleBlock(userId, contactUserId);

        // Invalidate cache for both users
        await cacheService.invalidateContactCache(userId);
        await cacheService.invalidateContactCache(contactUserId);

        return isBlocked;
    }

    async getBlockedContacts(userId, useCache = true) {
        if (useCache) {
            const cachedBlocked = await cacheService.getUserContactsFromCache(userId);
            if (cachedBlocked) {
                return cachedBlocked.filter(c => c.is_blocked);
            }
        }

        return await contactRepository.getBlockedContacts(userId);
    }

    async getFavoriteContacts(userId, useCache = true) {
        if (useCache) {
            const cachedFavorites = await cacheService.getUserContactsFromCache(userId);
            if (cachedFavorites) {
                return cachedFavorites.filter(c => c.is_favorite);
            }
        }

        return await contactRepository.getFavoriteContacts(userId);
    }

    async isContact(userId, contactUserId, useCache = true) {
        if (useCache) {
            const contact = await this.getContact(userId, contactUserId, true);
            return !!contact && !contact.is_blocked;
        }

        return await contactRepository.isContact(userId, contactUserId);
    }

    async isBlocked(userId, contactUserId, useCache = true) {
        if (useCache) {
            const contact = await this.getContact(userId, contactUserId, true);
            return contact ? contact.is_blocked : false;
        }

        return await contactRepository.isBlocked(userId, contactUserId);
    }

    async getMutualContacts(userId, otherUserId, useCache = true) {
        const cacheKey = `mutual_contacts:${userId}:${otherUserId}`;

        if (useCache) {
            const cached = await cacheService.getSearchResultsFromCache('mutual_contacts', `${userId}:${otherUserId}`);
            if (cached) {
                return cached;
            }
        }

        const mutuals = await contactRepository.getMutualContacts(userId, otherUserId);

        if (useCache) {
            await cacheService.cacheSearchResults('mutual_contacts', `${userId}:${otherUserId}`, mutuals);
        }

        return mutuals;
    }

    // Contact Requests
    async sendContactRequest(requesterId, recipientId, message = null) {
        const request = await contactRequestRepository.createRequest(requesterId, recipientId, message);

        // Invalidate request caches
        await cacheService.invalidateContactRequestCache(requesterId, recipientId);

        return request;
    }

    async getPendingRequests(userId, useCache = true) {
        if (useCache) {
            const cachedRequests = await cacheService.getUserContactsFromCache(userId);
            // Note: Contact requests might need separate caching
        }

        return await contactRequestRepository.getPendingRequests(userId);
    }

    async acceptContactRequest(requestId, recipientId) {
        const request = await contactRequestRepository.updateRequestStatus(requestId, 'accepted', recipientId);

        if (request) {
            // Add to contacts
            await this.addContact(request.requester_id, request.recipient_id);

            // Invalidate caches
            await cacheService.invalidateContactCache(request.requester_id);
            await cacheService.invalidateContactCache(request.recipient_id);
            await cacheService.invalidateContactRequestCache(request.requester_id, request.recipient_id);
        }

        return request;
    }

    async rejectContactRequest(requestId, recipientId) {
        const request = await contactRequestRepository.updateRequestStatus(requestId, 'rejected', recipientId);

        // Invalidate request cache
        await cacheService.invalidateContactRequestCache(request.requester_id, request.recipient_id);

        return request;
    }

    async warmContactCache(userId) {
        const contacts = await contactRepository.getUserContacts(userId);
        await cacheService.cacheUserContacts(userId, contacts);

        // Also cache user data for contacts
        const userIds = contacts.map(c => c.contact_user_id);
        for (const contactUserId of userIds) {
            await userService.getUserById(contactUserId, false);
        }
    }

    async getContactStats(userId) {
        const contacts = await this.getContacts(userId);
        const blocked = contacts.filter(c => c.is_blocked);
        const favorites = contacts.filter(c => c.is_favorite);

        return {
            total: contacts.length,
            blocked: blocked.length,
            favorites: favorites.length,
            online: contacts.filter(c => c.contact_is_online).length
        };
    }
}

// Helper method for contact request cache invalidation
cacheService.invalidateContactRequestCache = async function (requesterId, recipientId) {
    await this.del(`contact_request:${requesterId}:${recipientId}`);
    await this.del(`user:${requesterId}:contact_requests:sent`);
    await this.del(`user:${recipientId}:contact_requests:received`);
};

module.exports = new ContactService();