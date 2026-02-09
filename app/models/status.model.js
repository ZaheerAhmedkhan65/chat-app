module.exports = (sequelize, DataTypes) => {
    const Status = sequelize.define('Status', {
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
        type: {
            type: DataTypes.ENUM('text', 'image', 'video'),
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT
        },
        media_url: {
            type: DataTypes.STRING(500)
        },
        background_color: {
            type: DataTypes.STRING(20)
        },
        text_color: {
            type: DataTypes.STRING(20)
        },
        font_style: {
            type: DataTypes.STRING(50)
        },
        view_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        is_archived: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'statuses',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                name: 'idx_user_status',
                fields: ['user_id', 'created_at']
            },
            {
                name: 'idx_expiring',
                fields: ['expires_at']
            }
        ]
    });

    Status.associate = (models) => {
        Status.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        Status.hasMany(models.StatusView, { foreignKey: 'status_id', as: 'views' });
    };

    return Status;
};