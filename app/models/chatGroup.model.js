module.exports = (sequelize, DataTypes) => {
    const ChatGroup = sequelize.define('ChatGroup', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        avatar_url: {
            type: DataTypes.STRING(500)
        },
        creator_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        is_private: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        invite_link: {
            type: DataTypes.STRING(255),
            unique: true
        },
        max_members: {
            type: DataTypes.INTEGER,
            defaultValue: 1000
        }
    }, {
        tableName: 'chat_groups',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'idx_creator',
                fields: ['creator_id']
            }
        ]
    });

    ChatGroup.associate = (models) => {
        ChatGroup.belongsTo(models.User, { foreignKey: 'creator_id', as: 'creator' });
        ChatGroup.hasMany(models.GroupMember, { foreignKey: 'group_id', as: 'members' });
        ChatGroup.hasMany(models.GroupInvitation, { foreignKey: 'group_id', as: 'invitations' });
        ChatGroup.hasMany(models.Conversation, { foreignKey: 'group_id', as: 'conversations' });
    };

    return ChatGroup;
};