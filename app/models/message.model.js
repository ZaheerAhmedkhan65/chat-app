module.exports = (sequelize, DataTypes) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        conversation_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'conversations',
                key: 'id'
            }
        },
        sender_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        parent_message_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'messages',
                key: 'id'
            }
        },
        message_type: {
            type: DataTypes.ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'contact'),
            defaultValue: 'text'
        },
        content: {
            type: DataTypes.TEXT
        },
        attachment_url: {
            type: DataTypes.STRING(500)
        },
        attachment_metadata: {
            type: DataTypes.JSON
        },
        mentions: {
            type: DataTypes.JSON
        },
        status: {
            type: DataTypes.ENUM('sending', 'sent', 'delivered', 'read', 'failed'),
            defaultValue: 'sending'
        },
        is_edited: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        edited_at: {
            type: DataTypes.DATE
        },
        is_deleted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        deleted_at: {
            type: DataTypes.DATE
        },
        deleted_by: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'messages',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_conversation',
                fields: ['conversation_id', 'created_at']
            },
            {
                name: 'idx_sender',
                fields: ['sender_id']
            },
            {
                name: 'idx_parent',
                fields: ['parent_message_id']
            }
        ]
    });

    Message.associate = (models) => {
        Message.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
        Message.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
        Message.belongsTo(models.Message, { foreignKey: 'parent_message_id', as: 'parentMessage' });
        Message.belongsTo(models.User, { foreignKey: 'deleted_by', as: 'deletedBy' });
        Message.hasMany(models.MessageReaction, { foreignKey: 'message_id', as: 'reactions' });
        Message.hasMany(models.MessageView, { foreignKey: 'message_id', as: 'views' });
        Message.hasMany(models.StarredMessage, { foreignKey: 'message_id', as: 'starredBy' });
        Message.hasMany(models.Message, { foreignKey: 'parent_message_id', as: 'replies' });
    };

    return Message;
};