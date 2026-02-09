module.exports = (sequelize, DataTypes) => {
    const ContactRequest = sequelize.define('ContactRequest', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        requester_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        recipient_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'blocked'),
            defaultValue: 'pending'
        },
        message: {
            type: DataTypes.STRING(255)
        }
    }, {
        tableName: 'contact_requests',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'unique_request',
                unique: true,
                fields: ['requester_id', 'recipient_id']
            },
            {
                name: 'idx_pending_requests',
                fields: ['recipient_id', 'status']
            }
        ]
    });

    ContactRequest.associate = (models) => {
        ContactRequest.belongsTo(models.User, { foreignKey: 'requester_id', as: 'requester' });
        ContactRequest.belongsTo(models.User, { foreignKey: 'recipient_id', as: 'recipient' });
    };

    return ContactRequest;
};