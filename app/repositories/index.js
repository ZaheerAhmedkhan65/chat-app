const userRepository = require('./user.repository');
const contactRepository = require('./contact.repository');
const contactRequestRepository = require('./contactRequest.repository');
const chatGroupRepository = require('./chatGroup.repository');
const groupMemberRepository = require('./groupMember.repository');
const groupInvitationRepository = require('./groupInvitation.repository');
const conversationRepository = require('./conversation.repository');
const conversationParticipantRepository = require('./conversationParticipant.repository');
const messageRepository = require('./message.repository');
const messageReactionRepository = require('./messageReaction.repository');
const messageViewRepository = require('./messageView.repository');
const statusRepository = require('./status.repository');
const statusViewRepository = require('./statusView.repository');
const starredMessageRepository = require('./starredMessage.repository');
const messageDraftRepository = require('./messageDraft.repository');

module.exports = {
    userRepository,
    contactRepository,
    contactRequestRepository,
    chatGroupRepository,
    groupMemberRepository,
    groupInvitationRepository,
    conversationRepository,
    conversationParticipantRepository,
    messageRepository,
    messageReactionRepository,
    messageViewRepository,
    statusRepository,
    statusViewRepository,
    starredMessageRepository,
    messageDraftRepository
};