const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const { getMessages,deleteMessage} = require('../controllers/messageController');
const User = require('../models/Users');
const Friend = require('../models/Friend');
const FriendRequest = require('../models/FriendRequest');

const router = express.Router();

// Render the chat page (protected route)
router.get('/chat', authenticate, async (req, res) => {
  const { receiverId } = req.query;
  if (!receiverId) {
    return res.status(400).json({ error: 'Receiver ID is required' });
  }
  try {
    console.log("Receiver ID: ", receiverId);
    // Check if the receiver is a friend
    const isFriend = await Friend.isFriend(req.userId, receiverId);
    if (!isFriend) {
      return res.status(403).json({ error: 'You can only chat with friends' });
    }

    // Fetch messages
    const messages = await getMessages(req, res);
   
    // Fetch receiver's username
    const receiver = await User.findByUserId(receiverId);
    const receiverUsername = receiver ? receiver.username : 'Unknown';

    // Fetch all users except the logged-in user
    const users = await User.findAllExcept(req.userId);
    const friends = await FriendRequest.getFriends(req.userId);
    const currentUser = await User.findByUserId(req.userId);

    // Fetch pending friend requests
    const friendRequests = await FriendRequest.findByReceiverId(req.userId);

    // Render the chat template
    res.render('chat', {
      userId: req.userId,
      receiverId,
      receiverUsername,
      messages: messages || [],
      token: req.query.token,
      friends,
      users,
      currentUser,
      friendRequests, // Pass pending friend requests to the template
    });
  } catch (error) {
    console.error('Error rendering chat page:', error);
    res.status(500).json({ error: 'Error rendering chat page' });
  }
});

router.delete('/delete/:messageId', authenticate, deleteMessage);

module.exports = router;