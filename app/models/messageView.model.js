module.exports = (sequelize, DataTypes) => {
    const MessageView = sequelize.define('MessageView', {
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
        viewed_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'message_views',
        timestamps: false,
        indexes: [
            {
                name: 'unique_view',
                unique: true,
                fields: ['message_id', 'user_id']
            },
            {
                name: 'idx_user_views',
                fields: ['user_id']
            }
        ]
    });

    MessageView.associate = (models) => {
        MessageView.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
        MessageView.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };

    return MessageView;
};