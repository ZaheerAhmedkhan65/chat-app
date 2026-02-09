module.exports = (sequelize, DataTypes) => {
    const StarredMessage = sequelize.define('StarredMessage', {
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
        message_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'messages',
                key: 'id'
            }
        }
    }, {
        tableName: 'starred_messages',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                name: 'unique_starred',
                unique: true,
                fields: ['user_id', 'message_id']
            }
        ]
    });

    StarredMessage.associate = (models) => {
        StarredMessage.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        StarredMessage.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message' });
    };

    return StarredMessage;
};