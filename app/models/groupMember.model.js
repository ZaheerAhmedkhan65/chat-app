module.exports = (sequelize, DataTypes) => {
    const GroupMember = sequelize.define('GroupMember', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        group_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'chat_groups',
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
        role: {
            type: DataTypes.ENUM('admin', 'moderator', 'member'),
            defaultValue: 'member'
        },
        is_muted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        nickname_in_group: {
            type: DataTypes.STRING(100)
        }
    }, {
        tableName: 'group_members',
        timestamps: true,
        createdAt: 'joined_at',
        updatedAt: false,
        indexes: [
            {
                name: 'unique_group_member',
                unique: true,
                fields: ['group_id', 'user_id']
            },
            {
                name: 'idx_user_chat_groups',
                fields: ['user_id']
            },
            {
                name: 'idx_group_admins',
                fields: ['group_id', 'role']
            }
        ]
    });

    GroupMember.associate = (models) => {
        GroupMember.belongsTo(models.ChatGroup, { foreignKey: 'group_id', as: 'group' });
        GroupMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };

    return GroupMember;
};