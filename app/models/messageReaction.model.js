module.exports = (sequelize, DataTypes) => {
    const MessageReaction = sequelize.define('MessageReaction', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        message_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'messages',
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
        reaction: {
            type: DataTypes.STRING(10),
            allowNull: false
        }
    }, {
        tableName: 'message_reactions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                name: 'unique_reaction',
                unique: true,
                fields: ['message_id', 'user_id']
            },
            {
                name: 'idx_message_reactions',
                fields: ['message_id']
            }
        ]
    });

    MessageReaction.associate = (models) => {
        MessageReaction.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
        MessageReaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };

    return MessageReaction;
};