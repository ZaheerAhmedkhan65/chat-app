const db = require('../../config/db');

class MessageDraftRepository {
    async saveDraft(draftData) {
        const sql = `
            INSERT INTO message_drafts (user_id, conversation_id, content, attachments)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                content = VALUES(content),
                attachments = VALUES(attachments),
                updated_at = NOW()
        `;
        const params = [
            draftData.user_id,
            draftData.conversation_id,
            draftData.content || null,
            draftData.attachments ? JSON.stringify(draftData.attachments) : null
        ];

        await db.query(sql, params);

        return await this.getDraft(draftData.user_id, draftData.conversation_id);
    }

    async getDraft(userId, conversationId) {
        const sql = `
            SELECT md.*, 
                   c.type as conversation_type,
                   CASE 
                       WHEN c.type = 'direct' THEN (
                           SELECT u2.name 
                           FROM conversation_participants cp
                           JOIN users u2 ON cp.user_id = u2.id
                           WHERE cp.conversation_id = c.id 
                           AND cp.user_id != ?
                           LIMIT 1
                       )
                       WHEN c.type = 'group' THEN (
                           SELECT g.name 
                           FROM conversation_participants cp
                           JOIN group_members gm ON cp.user_id = gm.user_id
                           JOIN chat_groups g ON gm.group_id = g.id
                           WHERE cp.conversation_id = c.id
                           LIMIT 1
                       )
                   END as conversation_name
            FROM message_drafts md
            JOIN conversations c ON md.conversation_id = c.id
            WHERE md.user_id = ? AND md.conversation_id = ?
        `;
        const [draft] = await db.query(sql, [userId, userId, conversationId]);

        if (draft && draft.attachments) {
            draft.attachments = JSON.parse(draft.attachments);
        }

        return draft;
    }

    async getUserDrafts(userId) {
        const sql = `
            SELECT md.*, 
                   c.type as conversation_type,
                   CASE 
                       WHEN c.type = 'direct' THEN (
                           SELECT u2.name 
                           FROM conversation_participants cp
                           JOIN users u2 ON cp.user_id = u2.id
                           WHERE cp.conversation_id = c.id 
                           AND cp.user_id != ?
                           LIMIT 1
                       )
                       WHEN c.type = 'group' THEN (
                           SELECT g.name 
                           FROM conversation_participants cp
                           JOIN group_members gm ON cp.user_id = gm.user_id
                           JOIN chat_groups g ON gm.group_id = g.id
                           WHERE cp.conversation_id = c.id
                           LIMIT 1
                       )
                   END as conversation_name,
                   CASE 
                       WHEN c.type = 'direct' THEN (
                           SELECT u2.avatar_url 
                           FROM conversation_participants cp
                           JOIN users u2 ON cp.user_id = u2.id
                           WHERE cp.conversation_id = c.id 
                           AND cp.user_id != ?
                           LIMIT 1
                       )
                       WHEN c.type = 'group' THEN (
                           SELECT g.avatar_url 
                           FROM conversation_participants cp
                           JOIN group_members gm ON cp.user_id = gm.user_id
                           JOIN chat_groups g ON gm.group_id = g.id
                           WHERE cp.conversation_id = c.id
                           LIMIT 1
                       )
                   END as conversation_avatar
            FROM message_drafts md
            JOIN conversations c ON md.conversation_id = c.id
            WHERE md.user_id = ?
            ORDER BY md.updated_at DESC
        `;

        const drafts = await db.query(sql, [userId, userId, userId]);

        // Parse attachments JSON
        return drafts.map(draft => {
            if (draft.attachments) {
                draft.attachments = JSON.parse(draft.attachments);
            }
            return draft;
        });
    }

    async deleteDraft(userId, conversationId) {
        const sql = 'DELETE FROM message_drafts WHERE user_id = ? AND conversation_id = ?';
        await db.query(sql, [userId, conversationId]);
    }

    async deleteAllUserDrafts(userId) {
        const sql = 'DELETE FROM message_drafts WHERE user_id = ?';
        await db.query(sql, [userId]);
    }

    async deleteExpiredDrafts(days = 30) {
        const sql = 'DELETE FROM message_drafts WHERE updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)';
        await db.query(sql, [days]);
    }

    async updateDraftContent(userId, conversationId, content) {
        const sql = `
            UPDATE message_drafts 
            SET content = ?, updated_at = NOW()
            WHERE user_id = ? AND conversation_id = ?
        `;
        await db.query(sql, [content, userId, conversationId]);

        return await this.getDraft(userId, conversationId);
    }

    async updateDraftAttachments(userId, conversationId, attachments) {
        const sql = `
            UPDATE message_drafts 
            SET attachments = ?, updated_at = NOW()
            WHERE user_id = ? AND conversation_id = ?
        `;
        await db.query(sql, [JSON.stringify(attachments), userId, conversationId]);

        return await this.getDraft(userId, conversationId);
    }

    async addAttachmentToDraft(userId, conversationId, attachment) {
        const draft = await this.getDraft(userId, conversationId);
        let attachments = [];

        if (draft && draft.attachments) {
            attachments = draft.attachments;
        }

        attachments.push(attachment);

        return await this.updateDraftAttachments(userId, conversationId, attachments);
    }

    async removeAttachmentFromDraft(userId, conversationId, attachmentIndex) {
        const draft = await this.getDraft(userId, conversationId);

        if (!draft || !draft.attachments || draft.attachments.length <= attachmentIndex) {
            return draft;
        }

        const attachments = draft.attachments.filter((_, index) => index !== attachmentIndex);

        return await this.updateDraftAttachments(userId, conversationId, attachments);
    }

    async clearDraftAttachments(userId, conversationId) {
        const sql = `
            UPDATE message_drafts 
            SET attachments = NULL, updated_at = NOW()
            WHERE user_id = ? AND conversation_id = ?
        `;
        await db.query(sql, [userId, conversationId]);

        return await this.getDraft(userId, conversationId);
    }

    async getDraftCount(userId) {
        const sql = 'SELECT COUNT(*) as count FROM message_drafts WHERE user_id = ?';
        const [result] = await db.query(sql, [userId]);
        return result.count;
    }

    async getRecentDrafts(userId, limit = 10) {
        const sql = `
            SELECT md.*, 
                   c.type as conversation_type
            FROM message_drafts md
            JOIN conversations c ON md.conversation_id = c.id
            WHERE md.user_id = ?
            ORDER BY md.updated_at DESC
            LIMIT ?
        `;

        const drafts = await db.query(sql, [userId, limit]);

        // Parse attachments JSON
        return drafts.map(draft => {
            if (draft.attachments) {
                draft.attachments = JSON.parse(draft.attachments);
            }
            return draft;
        });
    }

    async getDraftStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_drafts,
                COUNT(DISTINCT conversation_id) as conversations_with_drafts,
                COUNT(CASE WHEN content IS NOT NULL THEN 1 END) as drafts_with_content,
                COUNT(CASE WHEN attachments IS NOT NULL THEN 1 END) as drafts_with_attachments,
                MIN(created_at) as first_draft,
                MAX(updated_at) as last_update
            FROM message_drafts
            WHERE user_id = ?
        `;
        const [stats] = await db.query(sql, [userId]);
        return stats;
    }

    async searchDrafts(userId, searchTerm) {
        const sql = `
            SELECT md.*, 
                   c.type as conversation_type,
                   CASE 
                       WHEN c.type = 'direct' THEN (
                           SELECT u2.name 
                           FROM conversation_participants cp
                           JOIN users u2 ON cp.user_id = u2.id
                           WHERE cp.conversation_id = c.id 
                           AND cp.user_id != ?
                           LIMIT 1
                       )
                       WHEN c.type = 'group' THEN (
                           SELECT g.name 
                           FROM conversation_participants cp
                           JOIN group_members gm ON cp.user_id = gm.user_id
                           JOIN chat_groups g ON gm.group_id = g.id
                           WHERE cp.conversation_id = c.id
                           LIMIT 1
                       )
                   END as conversation_name
            FROM message_drafts md
            JOIN conversations c ON md.conversation_id = c.id
            WHERE md.user_id = ?
            AND md.content LIKE ?
            ORDER BY md.updated_at DESC
            LIMIT 50
        `;

        const drafts = await db.query(sql, [userId, userId, `%${searchTerm}%`]);

        // Parse attachments JSON
        return drafts.map(draft => {
            if (draft.attachments) {
                draft.attachments = JSON.parse(draft.attachments);
            }
            return draft;
        });
    }

    async hasDraft(userId, conversationId) {
        const sql = 'SELECT COUNT(*) as count FROM message_drafts WHERE user_id = ? AND conversation_id = ?';
        const [result] = await db.query(sql, [userId, conversationId]);
        return result.count > 0;
    }

    async convertDraftToMessage(userId, conversationId, messageData = {}) {
        return await db.transaction(async (connection) => {
            // Get the draft
            const [draft] = await connection.execute(
                'SELECT * FROM message_drafts WHERE user_id = ? AND conversation_id = ?',
                [userId, conversationId]
            );

            if (!draft || draft.length === 0) {
                throw new Error('No draft found');
            }

            const draftData = draft[0];
            let attachments = null;

            if (draftData.attachments) {
                attachments = JSON.parse(draftData.attachments);
            }

            // Create message from draft
            const messageRepo = require('./message.repository');
            const message = await messageRepo.createMessage({
                conversation_id: conversationId,
                sender_id: userId,
                message_type: messageData.message_type || 'text',
                content: messageData.content || draftData.content,
                attachment_url: messageData.attachment_url,
                attachment_metadata: messageData.attachment_metadata || attachments,
                status: 'sent',
                ...messageData
            });

            // Delete the draft
            await connection.execute(
                'DELETE FROM message_drafts WHERE user_id = ? AND conversation_id = ?',
                [userId, conversationId]
            );

            return message;
        });
    }

    async bulkDeleteDrafts(userId, conversationIds) {
        if (conversationIds.length === 0) return 0;

        const placeholders = conversationIds.map(() => '?').join(',');
        const sql = `
            DELETE FROM message_drafts 
            WHERE user_id = ? 
            AND conversation_id IN (${placeholders})
        `;
        const result = await db.query(sql, [userId, ...conversationIds]);
        return result.affectedRows;
    }
}

module.exports = new MessageDraftRepository();