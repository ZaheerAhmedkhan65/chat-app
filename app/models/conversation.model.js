module.exports = (sequelize, DataTypes) => {
    const Conversation = sequelize.define('Conversation', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        type: {
            type: DataTypes.ENUM('direct', 'group'),
            allowNull: false
        },
        last_message_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'messages',
                key: 'id'
            }
        }
    }, {
        tableName: 'conversations',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_updated',
                fields: ['updated_at']
            }
        ]
    });

    Conversation.associate = (models) => {
        Conversation.hasMany(models.ConversationParticipant, { foreignKey: 'conversation_id', as: 'participants' });
        Conversation.hasMany(models.Message, { foreignKey: 'conversation_id', as: 'messages' });
        Conversation.belongsTo(models.Message, { foreignKey: 'last_message_id', as: 'lastMessage' });
    };

    return Conversation;
};