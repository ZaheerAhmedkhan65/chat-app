const router = require('./base.routes')();
const { validate } = require('../middlewares/validation.middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const groupController = require('../app/controllers/group.controller');
const groupValidators = require('../app/validators/group.validator');
const { cacheMiddleware, groupCacheMiddleware } = require('../middlewares/cache.middleware');

// All routes require authentication
router.use(authMiddleware);

// Groups management
router.get('/',
    cacheMiddleware(300),
    groupController.getUserGroups
);

router.post('/',
    groupController.createGroup
);

router.get('/search',
    cacheMiddleware(300),
    groupController.searchGroups
);

// Specific group operations
router.get('/:groupId',
    validate(groupValidators.groupIdParam),
    cacheMiddleware(180),
    groupController.getGroup
);

router.put('/:groupId',
    validate(groupValidators.groupIdParam),
    groupCacheMiddleware('groupId'),
    groupController.updateGroup
);

router.delete('/:groupId',
    validate(groupValidators.groupIdParam),
    groupController.deleteGroup
);

router.post('/:groupId/leave',
    validate(groupValidators.groupIdParam),
    groupCacheMiddleware('groupId'),
    groupController.leaveGroup
);

// Group members
router.get('/:groupId/members',
    validate(groupValidators.groupIdParam),
    cacheMiddleware(180),
    groupController.getGroupMembers
);

router.post('/:groupId/members',
    validate(groupValidators.groupIdParam),
    groupCacheMiddleware('groupId'),
    groupController.addMember
);

router.delete('/:groupId/members/:memberId',
    validate(groupValidators.groupIdParam),
    validate(groupValidators.memberIdParam),
    groupCacheMiddleware('groupId'),
    groupController.removeMember
);

router.put('/:groupId/members/:memberId/role',
    validate(groupValidators.groupIdParam),
    validate(groupValidators.memberIdParam),
    groupCacheMiddleware('groupId'),
    groupController.changeMemberRole
);

router.post('/:groupId/members/:memberId/mute',
    validate(groupValidators.groupIdParam),
    validate(groupValidators.memberIdParam),
    groupCacheMiddleware('groupId'),
    groupController.toggleMuteMember
);

// Group invitations
router.post('/:groupId/invitations',
    validate(groupValidators.groupIdParam),
    groupController.createInvitation
);

router.post('/invitations/accept',
    groupController.acceptInvitation
);

router.post('/:groupId/invite-link',
    validate(groupValidators.groupIdParam),
    groupController.generateInviteLink
);

// Statistics and cache
router.get('/:groupId/stats',
    validate(groupValidators.groupIdParam),
    groupController.getGroupStats
);

router.post('/:groupId/cache/warm',
    validate(groupValidators.groupIdParam),
    groupController.warmGroupCache
);

module.exports = router;