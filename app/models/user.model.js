module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 50]
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      unique: true,
      validate: {
        is: /^[+]?[\d\s\-()]+$/ // Simple phone validation
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    about: {
      type: DataTypes.STRING(500),
      defaultValue: 'Hey! I am using eChat.'
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      defaultValue: 'avatars/default.png'
    },
    status_emoji: {
      type: DataTypes.STRING(10)
    },
    status_text: {
      type: DataTypes.STRING(100)
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    last_seen_at: {
      type: DataTypes.DATE
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    privacy_settings: {
      type: DataTypes.JSON
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_name',
        fields: ['name']
      },
      {
        name: 'idx_email',
        fields: ['email']
      },
      {
        name: 'idx_online',
        fields: ['is_online']
      }
    ]
  });

  User.associate = (models) => {
    User.hasMany(models.Contact, { foreignKey: 'user_id', as: 'contacts' });
    User.hasMany(models.Contact, { foreignKey: 'contact_user_id', as: 'contactOf' });
    User.hasMany(models.ContactRequest, { foreignKey: 'requester_id', as: 'sentContactRequests' });
    User.hasMany(models.ContactRequest, { foreignKey: 'recipient_id', as: 'receivedContactRequests' });
    User.hasMany(models.ChatGroup, { foreignKey: 'creator_id', as: 'createdGroups' });
    User.hasMany(models.GroupMember, { foreignKey: 'user_id', as: 'groupMemberships' });
    User.hasMany(models.ConversationParticipant, { foreignKey: 'user_id', as: 'conversations' });
    User.hasMany(models.Message, { foreignKey: 'sender_id', as: 'sentMessages' });
    User.hasMany(models.Status, { foreignKey: 'user_id', as: 'statuses' });
    User.hasMany(models.StarredMessage, { foreignKey: 'user_id', as: 'starredMessages' });
    User.hasMany(models.MessageDraft, { foreignKey: 'user_id', as: 'drafts' });
  };

  return User;
};