module.exports = (sequelize, DataTypes) => {
    const StatusView = sequelize.define('StatusView', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        status_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'statuses',
                key: 'id'
            }
        },
        viewer_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'status_views',
        timestamps: true,
        createdAt: 'viewed_at',
        updatedAt: false,
        indexes: [
            {
                name: 'unique_status_view',
                unique: true,
                fields: ['status_id', 'viewer_id']
            },
            {
                name: 'idx_status_views',
                fields: ['status_id']
            }
        ]
    });

    StatusView.associate = (models) => {
        StatusView.belongsTo(models.Status, { foreignKey: 'status_id', as: 'status' });
        StatusView.belongsTo(models.User, { foreignKey: 'viewer_id', as: 'viewer' });
    };

    return StatusView;
};