const express = require('express');
const FriendRequest = require('../models/FriendRequest');
const Friend = require('../models/Friend');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();

// Send a friend request
router.post('/send-request', authenticate, async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.userId;
    console.log('Send token:', req.body.token);
    console.log('Full body:', req.body);
  
    console.log('Received friend request from:', senderId, 'to:', receiverId);
  
    try {
      const requestId = await FriendRequest.create(senderId, receiverId);
      console.log('Friend request created with ID:', requestId);
      
      res.redirect(`/users/select-receiver?token=${req.body.token}`);
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Error sending friend request' });
    }
  });
  
  

// Accept a friend request
router.post('/accept-request', authenticate, async (req, res) => {
    const { requestId } = req.body;
    console.log('Received token:', req.body.token);
    console.log('Full body:', req.body);
    console.log('Accept request called with ID:', requestId); // Debugging log
  
    try {
      // Ensure requestId is provided
      if (!requestId) {
        console.error('Request ID is missing');
        return res.status(400).json({ error: 'Request ID is required' });
      }
  
      // Update friend request status
      const updateResult = await FriendRequest.acceptRequest(requestId);
      console.log('Friend request status updated:', updateResult);
  
      // Fetch updated friend request details
      const request = await FriendRequest.findById(requestId);
      if (!request) {
        console.error('Friend request not found');
        return res.status(404).json({ error: 'Friend request not found' });
      }
  
      console.log('Friend request details:', request);
  
      // Ensure sender and receiver exist
      if (!request.sender_id || !request.receiver_id) {
        console.error('Invalid friend request data:', request);
        return res.status(500).json({ error: 'Invalid friend request data' });
      }
  
      // Add the users as friends (bidirectional)
      await Friend.create(request.sender_id, request.receiver_id);
      await Friend.create(request.receiver_id, request.sender_id);
  
      res.redirect(`/users/select-receiver?token=${req.body.token}`);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(500).json({ error: 'Error accepting friend request' });
    }
  });
  

// Reject a friend request
router.post('/reject-request', authenticate, async (req, res) => {
  const { requestId } = req.body;
  console.log('Rejected token:', req.body.token);
  console.log('Full body:', req.body);
  try {
    await FriendRequest.rejectRequest(requestId);
    res.redirect(`/users/select-receiver?token=${req.body.token}`);
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Error rejecting friend request' });
  }
});

module.exports = router;
