module.exports = (sequelize, DataTypes) => {
    const MessageDraft = sequelize.define('MessageDraft', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        conversation_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'conversations',
                key: 'id'
            }
        },
        content: {
            type: DataTypes.TEXT
        },
        attachments: {
            type: DataTypes.JSON
        }
    }, {
        tableName: 'message_drafts',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'unique_draft',
                unique: true,
                fields: ['user_id', 'conversation_id']
            }
        ]
    });

    MessageDraft.associate = (models) => {
        MessageDraft.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        MessageDraft.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
    };

    return MessageDraft;
};