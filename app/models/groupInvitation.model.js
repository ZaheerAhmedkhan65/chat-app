module.exports = (sequelize, DataTypes) => {
    const GroupInvitation = sequelize.define('GroupInvitation', {
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
        inviter_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        invitee_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        invitee_email: {
            type: DataTypes.STRING(100)
        },
        token: {
            type: DataTypes.STRING(100),
            unique: true
        },
        status: {
            type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired'),
            defaultValue: 'pending'
        },
        expires_at: {
            type: DataTypes.DATE
        }
    }, {
        tableName: 'group_invitations',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                name: 'idx_token',
                fields: ['token']
            },
            {
                name: 'idx_pending_invites',
                fields: ['invitee_id', 'status']
            }
        ]
    });

    GroupInvitation.associate = (models) => {
        GroupInvitation.belongsTo(models.ChatGroup, { foreignKey: 'group_id', as: 'group' });
        GroupInvitation.belongsTo(models.User, { foreignKey: 'inviter_id', as: 'inviter' });
        GroupInvitation.belongsTo(models.User, { foreignKey: 'invitee_id', as: 'invitee' });
    };

    return GroupInvitation;
};