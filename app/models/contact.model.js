module.exports = (sequelize, DataTypes) => {
    const Contact = sequelize.define('Contact', {
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
        contact_user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        nickname: {
            type: DataTypes.STRING(100)
        },
        is_favorite: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        is_blocked: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'contacts',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                name: 'unique_contact',
                unique: true,
                fields: ['user_id', 'contact_user_id']
            },
            {
                name: 'idx_user_contacts',
                fields: ['user_id']
            },
            {
                name: 'idx_blocked',
                fields: ['user_id', 'is_blocked']
            }
        ]
    });

    Contact.associate = (models) => {
        Contact.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        Contact.belongsTo(models.User, { foreignKey: 'contact_user_id', as: 'contactUser' });
    };

    return Contact;
};