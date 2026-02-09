const ApiResponse = require('../utils/response');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
    ConflictError
} = require('../utils/error');
const groupService = require('../services/group.service');
const notificationService = require('../services/notification.service');

class GroupController {
    async createGroup(req, res, next) {
        try {
            const userId = req.user.id;
            const { name, description, avatar_url, is_private, max_members } = req.body;

            if (!name) {
                throw new ValidationError('Group name is required');
            }

            const group = await groupService.createGroup({
                name,
                description,
                avatar_url,
                creator_id: userId,
                is_private: is_private || false,
                max_members: max_members || 1000
            });

            res.status(201).json(ApiResponse.success({
                group
            }, 'Group created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getGroup(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);

            // Check if user is member
            const isMember = await groupService.isMember(groupId, userId);
            if (!isMember) {
                throw new ForbiddenError('You are not a member of this group');
            }

            const group = await groupService.getGroup(groupId);

            res.json(ApiResponse.success({
                group
            }, 'Group retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateGroup(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);
            const updateData = req.body;

            const group = await groupService.updateGroup(groupId, updateData, userId);

            res.json(ApiResponse.success({
                group
            }, 'Group updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteGroup(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);

            await groupService.deleteGroup(groupId, userId);

            res.json(ApiResponse.success(null, 'Group deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserGroups(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                search,
                is_private,
                limit = 50,
                offset = 0
            } = req.query;

            const filters = {};
            if (search) filters.search = search;
            if (is_private !== undefined) filters.is_private = is_private === 'true';
            if (limit) filters.limit = parseInt(limit);
            if (offset) filters.offset = parseInt(offset);

            const groups = await groupService.getUserGroups(userId, filters);

            res.json(ApiResponse.paginate(groups, {
                total: groups.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async addMember(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);
            const { user_id, role = 'member' } = req.body;

            if (!user_id) {
                throw new ValidationError('User ID is required');
            }

            const member = await groupService.addMember(groupId, user_id, role, userId);

            // Send notification
            await notificationService.sendGroupInvitationNotification(userId, user_id, groupId);

            res.status(201).json(ApiResponse.success({
                member
            }, 'Member added successfully'));
        } catch (error) {
            next(error);
        }
    }

    async removeMember(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);
            const memberId = parseInt(req.params.memberId);

            await groupService.removeMember(groupId, memberId, userId);

            res.json(ApiResponse.success(null, 'Member removed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getGroupMembers(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);

            // Check if user is member
            const isMember = await groupService.isMember(groupId, userId);
            if (!isMember) {
                throw new ForbiddenError('You are not a member of this group');
            }

            const members = await groupService.getGroupMembers(groupId);

            res.json(ApiResponse.success({
                members
            }, 'Group members retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async changeMemberRole(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);
            const memberId = parseInt(req.params.memberId);
            const { role } = req.body;

            if (!role || !['admin', 'moderator', 'member'].includes(role)) {
                throw new ValidationError('Invalid role. Must be admin, moderator, or member');
            }

            const member = await groupService.changeMemberRole(groupId, memberId, role, userId);

            res.json(ApiResponse.success({
                member
            }, 'Member role updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async toggleMuteMember(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);
            const memberId = parseInt(req.params.memberId);

            const isMuted = await groupService.toggleMuteMember(groupId, memberId, userId);

            res.json(ApiResponse.success({
                is_muted: isMuted
            }, `Member ${isMuted ? 'muted' : 'unmuted'} successfully`));
        } catch (error) {
            next(error);
        }
    }

    async createInvitation(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);
            const { invitee_id, invitee_email, expires_at } = req.body;

            if (!invitee_id && !invitee_email) {
                throw new ValidationError('Either invitee_id or invitee_email is required');
            }

            // Check if inviter is admin
            const isAdmin = await groupService.isAdmin(groupId, userId);
            if (!isAdmin) {
                throw new ForbiddenError('Only admins can create invitations');
            }

            const invitation = await groupService.createInvitation(groupId, userId, {
                invitee_id,
                invitee_email,
                expires_at
            });

            // Send notification if invitee_id is provided
            if (invitee_id) {
                await notificationService.sendGroupInvitationNotification(userId, invitee_id, groupId);
            }

            res.status(201).json(ApiResponse.success({
                invitation
            }, 'Invitation created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async acceptInvitation(req, res, next) {
        try {
            const userId = req.user.id;
            const { token } = req.body;

            if (!token) {
                throw new ValidationError('Invitation token is required');
            }

            const invitation = await groupService.acceptInvitation(token, userId);

            res.json(ApiResponse.success({
                invitation
            }, 'Invitation accepted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async searchGroups(req, res, next) {
        try {
            const userId = req.user.id;
            const { search, limit = 50 } = req.query;

            if (!search || search.trim().length < 2) {
                throw new ValidationError('Search term must be at least 2 characters');
            }

            const groups = await groupService.searchGroups(search, userId, parseInt(limit));

            res.json(ApiResponse.success(groups, 'Groups retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getGroupStats(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);

            // Check if user is member
            const isMember = await groupService.isMember(groupId, userId);
            if (!isMember) {
                throw new ForbiddenError('You are not a member of this group');
            }

            const stats = await groupService.getGroupStats(groupId);

            res.json(ApiResponse.success(stats, 'Group stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async warmGroupCache(req, res, next) {
        try {
            const groupId = parseInt(req.params.groupId);
            await groupService.warmGroupCache(groupId);

            res.json(ApiResponse.success(null, 'Group cache warmed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async leaveGroup(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);

            await groupService.removeMember(groupId, userId, userId);

            res.json(ApiResponse.success(null, 'Left group successfully'));
        } catch (error) {
            next(error);
        }
    }

    async generateInviteLink(req, res, next) {
        try {
            const userId = req.user.id;
            const groupId = parseInt(req.params.groupId);

            // Check if user is admin
            const isAdmin = await groupService.isAdmin(groupId, userId);
            if (!isAdmin) {
                throw new ForbiddenError('Only admins can generate invite links');
            }

            // Generate unique token
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const inviteLink = `${process.env.APP_URL || 'http://localhost:3000'}/join/${token}`;

            // Update group with invite link
            const groupRepo = require('../repositories/chatGroup.repository');
            await groupRepo.updateGroupInviteLink(groupId, inviteLink);

            res.json(ApiResponse.success({
                invite_link: inviteLink,
                token
            }, 'Invite link generated successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new GroupController();