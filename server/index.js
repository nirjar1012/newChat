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
        origin: process.env.CLIENT_URL || "http://localhost:3000",
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
    // Handle user coming online
    socket.on('user-online', async (userData) => {
        console.log('DEBUG: user-online received:', JSON.stringify(userData, null, 2));

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
        console.log(`User online: ${userId}`);

        // Broadcast to all clients that this user is online with full details
        io.emit('user-online', { userId, userInfo });

        // Send full list of online users to the new user
        // We want to send the full objects, not just keys
        const usersList = Array.from(onlineUsers.values()).map(u => ({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            profile_image: u.profile_image,
            last_seen: u.lastSeen
        }));
        socket.emit('online-users', usersList);
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
        console.log(`User ${socket.id} joined room ${roomId}`);
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

    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
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

            // Update last_seen in Supabase
            try {
                if (supabase) {
                    await supabase
                        .from('users')
                        .update({ last_seen: new Date().toISOString() })
                        .eq('clerk_id', disconnectedUserId);
                    console.log(`Updated last_seen for ${disconnectedUserId}`);
                }
            } catch (err) {
                console.error('Error updating last_seen:', err);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
