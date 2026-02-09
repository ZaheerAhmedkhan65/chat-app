const chatGroupRepository = require('../repositories/chatGroup.repository');
const groupMemberRepository = require('../repositories/groupMember.repository');
const groupInvitationRepository = require('../repositories/groupInvitation.repository');
const cacheService = require('./cache.service');

class GroupService {
    async createGroup(groupData) {
        const group = await chatGroupRepository.createGroup(groupData);

        // Cache the group
        await cacheService.cacheGroup(group);

        // Cache members (creator is added as admin)
        await this.warmGroupCache(group.id);

        return group;
    }

    async getGroup(groupId, useCache = true) {
        if (useCache) {
            const cachedGroup = await cacheService.getGroupFromCache(groupId);
            if (cachedGroup) {
                return cachedGroup;
            }
        }

        const group = await chatGroupRepository.getGroupById(groupId);
        if (group) {
            await cacheService.cacheGroup(group);
        }

        return group;
    }

    async updateGroup(groupId, updateData, updaterId) {
        // Check if updater is admin
        const isAdmin = await groupMemberRepository.isAdmin(groupId, updaterId);
        if (!isAdmin) {
            throw new Error('Only admins can update group');
        }

        const group = await chatGroupRepository.updateGroup(groupId, updateData);

        if (group) {
            // Invalidate and update cache
            await cacheService.invalidateGroupCache(groupId);
            await cacheService.cacheGroup(group);
        }

        return group;
    }

    async deleteGroup(groupId, deleterId) {
        // Check if deleter is creator
        const group = await this.getGroup(groupId);
        if (group.creator_id !== deleterId) {
            throw new Error('Only group creator can delete group');
        }

        await chatGroupRepository.deleteGroup(groupId);

        // Invalidate all group-related cache
        await cacheService.invalidateGroupCache(groupId);
    }

    async getUserGroups(userId, filters = {}, useCache = true) {
        if (useCache) {
            const cachedGroups = await cacheService.getUserGroupsFromCache(userId);
            if (cachedGroups && cachedGroups.length > 0) {
                return this.applyGroupFilters(cachedGroups, filters);
            }
        }

        const groups = await chatGroupRepository.getUserGroups(userId, filters);

        if (useCache) {
            await cacheService.cacheUserGroups(userId, groups);
        }

        return groups;
    }

    applyGroupFilters(groups, filters) {
        let filtered = [...groups];

        if (filters.is_private !== undefined) {
            filtered = filtered.filter(g => g.is_private === filters.is_private);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(g =>
                g.name.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    async addMember(groupId, userId, role = 'member', inviterId = null) {
        // Check if group exists and is not full
        const group = await this.getGroup(groupId);
        if (!group) {
            throw new Error('Group not found');
        }

        const isFull = await chatGroupRepository.isGroupFull(groupId);
        if (isFull) {
            throw new Error('Group is full');
        }

        // If inviter is provided, check if they're admin
        if (inviterId && role === 'member') {
            const isInviterAdmin = await groupMemberRepository.isAdmin(groupId, inviterId);
            if (!isInviterAdmin) {
                throw new Error('Only admins can add members');
            }
        }

        const member = await groupMemberRepository.addMember(groupId, userId, role);

        // Invalidate group cache
        await cacheService.invalidateGroupCache(groupId);

        // Invalidate user's group cache
        await cacheService.cacheUserGroups(userId, null);

        return member;
    }

    async removeMember(groupId, userId, removerId) {
        // Check if remover is admin or the user themselves
        const isRemoverAdmin = await groupMemberRepository.isAdmin(groupId, removerId);
        const isSelf = removerId === userId;

        if (!isRemoverAdmin && !isSelf) {
            throw new Error('Only admins or the user themselves can remove members');
        }

        // Prevent removing last admin
        if (isRemoverAdmin && userId !== removerId) {
            const admins = await this.getGroupAdmins(groupId);
            if (admins.length === 1 && admins[0].user_id === userId) {
                throw new Error('Cannot remove the last admin');
            }
        }

        await groupMemberRepository.removeMember(groupId, userId);

        // Invalidate caches
        await cacheService.invalidateGroupCache(groupId);
        await cacheService.cacheUserGroups(userId, null);
    }

    async getGroupMembers(groupId, useCache = true) {
        if (useCache) {
            const cachedMembers = await cacheService.getGroupMembersFromCache(groupId);
            if (cachedMembers && cachedMembers.length > 0) {
                return cachedMembers;
            }
        }

        const members = await groupMemberRepository.getGroupMembers(groupId);

        if (useCache) {
            await cacheService.cacheGroupMembers(groupId, members);
        }

        return members;
    }

    async getGroupAdmins(groupId, useCache = true) {
        if (useCache) {
            const cachedMembers = await cacheService.getGroupMembersFromCache(groupId);
            if (cachedMembers) {
                return cachedMembers.filter(m => m.role === 'admin');
            }
        }

        return await groupMemberRepository.getGroupAdmins(groupId);
    }

    async isMember(groupId, userId, useCache = true) {
        if (useCache) {
            const members = await this.getGroupMembers(groupId, true);
            return members.some(m => m.user_id === userId);
        }

        return await groupMemberRepository.isMember(groupId, userId);
    }

    async isAdmin(groupId, userId, useCache = true) {
        if (useCache) {
            const members = await this.getGroupMembers(groupId, true);
            const member = members.find(m => m.user_id === userId);
            return member ? member.role === 'admin' : false;
        }

        return await groupMemberRepository.isAdmin(groupId, userId);
    }

    async changeMemberRole(groupId, userId, newRole, changerId) {
        // Check if changer is admin
        const isChangerAdmin = await this.isAdmin(groupId, changerId);
        if (!isChangerAdmin) {
            throw new Error('Only admins can change roles');
        }

        // Prevent demoting last admin
        if (newRole !== 'admin') {
            const admins = await this.getGroupAdmins(groupId);
            if (admins.length === 1 && admins[0].user_id === userId) {
                throw new Error('Cannot demote the last admin');
            }
        }

        const member = await groupMemberRepository.changeRole(groupId, userId, newRole);

        // Invalidate cache
        await cacheService.invalidateGroupCache(groupId);

        return member;
    }

    async toggleMuteMember(groupId, userId, muterId) {
        // Check if muter is admin or the user themselves
        const isMuterAdmin = await this.isAdmin(groupId, muterId);
        const isSelf = muterId === userId;

        if (!isMuterAdmin && !isSelf) {
            throw new Error('Only admins or the user themselves can mute/unmute');
        }

        const isMuted = await groupMemberRepository.toggleMute(groupId, userId);

        // Invalidate cache
        await cacheService.invalidateGroupCache(groupId);

        return isMuted;
    }

    // Group Invitations
    async createInvitation(groupId, inviterId, inviteData) {
        const invitation = await groupInvitationRepository.createInvitation({
            group_id: groupId,
            inviter_id: inviterId,
            ...inviteData
        });

        // Cache invitation
        await cacheService.cacheGroupInvitation(invitation);

        return invitation;
    }

    async acceptInvitation(token, userId) {
        const invitation = await groupInvitationRepository.getInvitationByToken(token);

        if (!invitation) {
            throw new Error('Invitation not found or expired');
        }

        if (invitation.invitee_id && invitation.invitee_id !== userId) {
            throw new Error('This invitation is for another user');
        }

        // Update invitation status
        await groupInvitationRepository.updateInvitationStatus(invitation.id, 'accepted', userId);

        // Add user to group
        await this.addMember(invitation.group_id, userId, 'member', invitation.inviter_id);

        // Invalidate caches
        await cacheService.invalidateGroupCache(invitation.group_id);
        await cacheService.invalidateInvitationCache(invitation.id);

        return invitation;
    }

    async searchGroups(searchTerm, userId = null, limit = 50, useCache = true) {
        const cacheKey = `search:groups:${searchTerm}:${userId || 'public'}`;

        if (useCache) {
            const cachedResults = await cacheService.getSearchResultsFromCache('groups', searchTerm, userId);
            if (cachedResults) {
                return cachedResults.slice(0, limit);
            }
        }

        const groups = await chatGroupRepository.searchGroups(searchTerm, userId, limit * 2);

        if (useCache) {
            await cacheService.cacheSearchResults('groups', searchTerm, groups, userId);
        }

        return groups.slice(0, limit);
    }

    async warmGroupCache(groupId) {
        const group = await this.getGroup(groupId, false);
        const members = await this.getGroupMembers(groupId, false);

        await cacheService.cacheGroup(group);
        await cacheService.cacheGroupMembers(groupId, members);

        // Cache group for each member
        for (const member of members) {
            const userGroups = await this.getUserGroups(member.user_id, false);
            await cacheService.cacheUserGroups(member.user_id, userGroups);
        }
    }

    async getGroupStats(groupId) {
        const group = await this.getGroup(groupId);
        const members = await this.getGroupMembers(groupId);

        return {
            ...group,
            total_members: members.length,
            online_members: members.filter(m => m.is_online).length,
            admin_count: members.filter(m => m.role === 'admin').length,
            muted_count: members.filter(m => m.is_muted).length
        };
    }
}

// Extend cache service for group invitations
cacheService.cacheGroupInvitation = async function (invitation) {
    if (!invitation || !invitation.id) return;

    await this.set(`group_invitation:${invitation.id}`, invitation, 3600);

    if (invitation.token) {
        await this.set(`group_invitation:token:${invitation.token}`, invitation, 3600);
    }
};

cacheService.invalidateInvitationCache = async function (invitationId) {
    await this.del(`group_invitation:${invitationId}`);

    // Get token from cache or DB to delete token-based cache
    const invitation = await this.get(`group_invitation:${invitationId}`);
    if (invitation && invitation.token) {
        await this.del(`group_invitation:token:${invitation.token}`);
    }
};

module.exports = new GroupService();