const Message = require('../models/Message');

const sendMessage = async (req, res) => {
    const { receiverId, message, token } = req.body;
    const senderId = req.userId;
    try {
        await Message.create(senderId, receiverId, message);
        res.status(201).redirect(`/messages/chat?token=${token}&receiverId=${receiverId}`);
    } catch (error) {
        res.status(500).json({ error: 'Error sending message' });
    }
};

const getMessages = async (req, res) => {
    const { receiverId } = req.query;
    const senderId = req.userId;
    try {
        const messages = await Message.findByUsers(senderId, receiverId);
        messages.filter(message => message.is_deleted === 0);
        // Format the created_at timestamp
        const formattedMessages = messages.map(message => ({
            ...message,
            created_at: new Date(message.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }),
        }));

        return formattedMessages;
    } catch (error) {
        console.error('Error fetching messages:', error); // Log the error
        res.status(500).json({ error: 'Error fetching messages' });
    }
};

const updateMessage = async (req, res) => {
    const { messageId } = req.params;
    const { newMessage , token, receiverId } = req.body;
    try {
        await Message.update(messageId, newMessage);
        res.redirect(`/messages/chat?token=${token}&receiverId=${receiverId}`);
    } catch (error) {
        res.status(500).json({ error: 'Error updating message' });
    }
};

const deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const { token, receiverId } = req.body;

    try {
        const result = await Message.delete(messageId);
        
        if (result === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Successfully deleted the message
        res.json({ success: true, token, receiverId });
    } catch (error) {
        console.error('Error deleting message:', error); // Log more details
        res.status(500).json({ error: 'Error deleting message' });
    }
};



module.exports = { sendMessage, getMessages, updateMessage, deleteMessage };