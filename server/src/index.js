const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // origin: process.env.CLIENT_URL || "http://localhost:3000",
        origin: ["http://localhost:3000", "http://0.0.0.0:3000", "http://192.168.0.11:3000"],
        methods: ["GET", "POST"]
    }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn("⚠️ Supabase keys missing in server/.env. Online status sync to DB will be disabled.");
}

const onlineUsers = new Map(); // userId -> { socketId, lastSeen }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user coming online
    socket.on('user-online', async (userData) => {
        let userId;
        let userInfo;

        if (typeof userData === 'string') {
            userId = userData;
            userInfo = { id: userId };
        } else if (userData && typeof userData === 'object') {
            // Try to find the ID in common fields
            userId = userData.id || userData.userId || userData.clerk_id;
            userInfo = userData;
        }

        if (!userId || typeof userId !== 'string') {
            console.error('❌ Invalid userId derived from:', userData);
            return;
        }

        onlineUsers.set(userId, {
            socketId: socket.id,
            lastSeen: new Date(),
            ...userInfo
        });

        socket.join(`user:${userId}`);

        // Update presence in Supabase: set online
        try {
            if (supabase) {
                await supabase
                    .from('users')
                    .update({
                        online_status: 'online',
                        last_seen: new Date().toISOString()
                    })
                    .eq('clerk_id', userId);
            }
        } catch (err) {
            console.warn('Warning: Could not update online status:', err.message);
        }

        // Broadcast to all clients that this user is online with full details
        io.emit('user-online', { userId, userInfo });

        // Send full list of online users to the new user
        const usersList = Array.from(onlineUsers.values()).map(u => ({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            profile_image: u.profile_image,
            last_seen: u.lastSeen
        }));
        socket.emit('online-users', usersList);

        // Auto-join all conversation rooms for this user
        try {
            if (supabase) {
                const { data: userConversations } = await supabase
                    .from('conversation_members')
                    .select('conversation_id')
                    .eq('user_id', userId);

                if (userConversations) {
                    userConversations.forEach(({ conversation_id }) => {
                        socket.join(`room:${conversation_id}`);
                    });
                }
            }
        } catch (err) {
            console.warn('Warning: Could not auto-join conversation rooms:', err.message);
        }
    });

    // Handle request for online users
    // Handle request for online users
    socket.on('get-online-users', () => {
        const usersList = Array.from(onlineUsers.values()).map(u => ({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            profile_image: u.profile_image,
            last_seen: u.lastSeen
        }));
        socket.emit('online-users', usersList);
    });

    socket.on('join-room', (roomId) => {
        socket.join(`room:${roomId}`);
    });

    socket.on('leave-room', (roomId) => {
        socket.leave(`room:${roomId}`);
    });

    socket.on('message:send', (message) => {
        // message should contain conversation_id, sender_id, content, etc.
        io.to(`room:${message.conversation_id}`).emit('message:receive', message);
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
        socket.to(`room:${conversationId}`).emit('user_typing', { userId, isTyping });
    });

    // Friend request events
    socket.on('friend-request:send', ({ requestId, receiverId, senderInfo }) => {
        console.log(`📨 Friend request sent from ${senderInfo.id} to ${receiverId}`);
        // Notify the receiver in real-time
        io.to(`user:${receiverId}`).emit('friend-request:received', {
            requestId,
            sender: senderInfo
        });
    });

    socket.on('friend-request:accept', async ({ requestId, userId, friendId }) => {
        console.log(`✅ Friend request accepted: ${userId} and ${friendId}`);
        // Notify both users that they are now friends
        io.to(`user:${userId}`).emit('friendship:created', { friendId });
        io.to(`user:${friendId}`).emit('friendship:created', { friendId: userId });
    });

    socket.on('disconnect', async () => {
        // Find user by socket id
        let disconnectedUserId = null;
        for (const [userId, data] of onlineUsers.entries()) {
            if (data.socketId === socket.id) {
                disconnectedUserId = userId;
                break;
            }
        }

        if (disconnectedUserId) {
            onlineUsers.delete(disconnectedUserId);
            io.emit('user-offline', disconnectedUserId);

            // Update presence in Supabase: set offline and update last_seen
            try {
                if (supabase) {
                    const now = new Date().toISOString();
                    await supabase
                        .from('users')
                        .update({
                            online_status: 'offline',
                            last_seen: now
                        })
                        .eq('clerk_id', disconnectedUserId);
                }
            } catch (err) {
                console.error('✗ Error updating presence:', err.message);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`- Network: http://192.168.0.11:${PORT}`);
});