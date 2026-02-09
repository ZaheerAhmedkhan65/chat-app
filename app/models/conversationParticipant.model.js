module.exports = (sequelize, DataTypes) => {
    const ConversationParticipant = sequelize.define('ConversationParticipant', {
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
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        left_at: {
            type: DataTypes.DATE
        },
        is_admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        is_muted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'conversation_participants',
        timestamps: true,
        createdAt: 'joined_at',
        updatedAt: false,
        indexes: [
            {
                name: 'unique_participant',
                unique: true,
                fields: ['conversation_id', 'user_id']
            },
            {
                name: 'idx_user_conversations',
                fields: ['user_id', 'left_at']
            }
        ]
    });

    ConversationParticipant.associate = (models) => {
        ConversationParticipant.belongsTo(models.Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
        ConversationParticipant.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };

    return ConversationParticipant;
};