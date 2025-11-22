"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { useSocket } from "@/context/socket-context";
import { Send, Paperclip, Smile, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    message_type: 'text' | 'image' | 'file';
    file_url?: string;
}

export function ChatWindow({ conversationId }: { conversationId: string | null }) {
    const { user } = useUser();
    const { socket } = useSocket();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [otherUser, setOtherUser] = useState<any>(null);
    const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);

    useEffect(() => {
        if (conversationId && user) {
            fetchMessages(conversationId);
            fetchConversationDetails(conversationId);

            if (socket) {
                socket.emit("join-room", conversationId);
            }
        }

        return () => {
            if (socket && conversationId) {
                socket.emit("leave-room", conversationId);
            }
            setOtherUser(null);
            setIsOtherUserOnline(false);
        };
    }, [conversationId, socket, user]);

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (message: Message) => {
            setMessages((prev) => [...prev, message]);
            scrollToBottom();
        };

        const handleUserTyping = ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
            if (isTyping) {
                setTypingUser(userId);
            } else {
                setTypingUser(null);
            }
        };

        socket.on("message:receive", handleReceiveMessage);
        socket.on("user_typing", handleUserTyping);

        return () => {
            socket.off("message:receive", handleReceiveMessage);
            socket.off("user_typing", handleUserTyping);
        };
    }, [socket]);

    useEffect(() => {
        if (!socket || !otherUser) return;

        // Check initial status
        socket.emit("get-online-users");

        const handleOnlineUsers = (users: any[]) => {
            const isOnline = users.some(u => u.id === otherUser.clerk_id);
            setIsOtherUserOnline(isOnline);
        };

        const handleUserOnline = ({ userId }: { userId: string }) => {
            if (userId === otherUser.clerk_id) {
                setIsOtherUserOnline(true);
            }
        };

        const handleUserOffline = (userId: string) => {
            if (userId === otherUser.clerk_id) {
                setIsOtherUserOnline(false);
            }
        };

        socket.on("online-users", handleOnlineUsers);
        socket.on("user-online", handleUserOnline);
        socket.on("user-offline", handleUserOffline);

        return () => {
            socket.off("online-users", handleOnlineUsers);
            socket.off("user-online", handleUserOnline);
            socket.off("user-offline", handleUserOffline);
        };
    }, [socket, otherUser]);

    const fetchConversationDetails = async (id: string) => {
        if (!user) return;

        const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", id);

        if (members) {
            const otherMember = members.find((m) => m.user_id !== user.id);
            if (otherMember) {
                const { data: userData } = await supabase
                    .from("users")
                    .select("*")
                    .eq("clerk_id", otherMember.user_id)
                    .single();
                setOtherUser(userData);
            }
        }
    };

    const fetchMessages = async (id: string) => {
        const { data, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", id)
            .order("created_at", { ascending: true });

        if (data) {
            setMessages(data as any);
            scrollToBottom();
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleTyping = () => {
        if (!socket || !conversationId || !user) return;

        if (!isTyping) {
            setIsTyping(true);
            socket.emit("typing", { conversationId, userId: user.id, isTyping: true });
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit("typing", { conversationId, userId: user.id, isTyping: false });
        }, 2000);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !conversationId || !user) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${conversationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat_files')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat_files')
            .getPublicUrl(filePath);

        const messageData = {
            conversation_id: conversationId,
            sender_id: user.id,
            content: file.name,
            file_url: publicUrl,
            message_type: file.type.startsWith('image/') ? 'image' : 'file'
        };

        const { data, error } = await supabase
            .from("messages")
            .insert(messageData)
            .select()
            .single();

        if (data) {
            // Update conversation timestamp
            await supabase
                .from("conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conversationId);

            if (socket) {
                socket.emit("message:send", data);
            } else {
                setMessages((prev) => [...prev, data as any]);
            }
            scrollToBottom();
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !conversationId || !user) return;

        const messageData = {
            conversation_id: conversationId,
            sender_id: user.id,
            content: newMessage,
            message_type: 'text'
        };

        const { data, error } = await supabase
            .from("messages")
            .insert(messageData)
            .select()
            .single();

        if (data) {
            // Update conversation timestamp
            await supabase
                .from("conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conversationId);

            if (socket) {
                socket.emit("message:send", data);
            } else {
                setMessages((prev) => [...prev, data as any]);
            }
            setNewMessage("");
            scrollToBottom();
        }
    };

    if (!conversationId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-500">
                Select a conversation to start chatting
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2]">
            {/* Header */}
            <div className="p-3 bg-gray-50 border-b flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden flex items-center justify-center">
                    {otherUser?.profile_image ? (
                        <img src={otherUser.profile_image} alt={otherUser.first_name} />
                    ) : (
                        <User className="w-6 h-6 text-gray-500" />
                    )}
                </div>
                <div>
                    <div className="font-semibold">
                        {otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : "Chat"}
                    </div>
                    <div className="text-xs text-gray-500">
                        {typingUser === otherUser?.clerk_id ? "typing..." : isOtherUserOnline ? "Online" : otherUser?.last_seen ? `Last seen ${new Date(otherUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Offline"}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full",
                                isMe ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[70%] p-3 rounded-lg shadow-sm",
                                    isMe ? "bg-[#d9fdd3]" : "bg-white"
                                )}
                            >
                                {msg.message_type === 'image' && msg.file_url && (
                                    <img src={msg.file_url} alt="Shared image" className="max-w-full rounded mb-2" />
                                )}
                                {msg.message_type === 'file' && msg.file_url && (
                                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 underline mb-2">
                                        <Paperclip className="w-4 h-4" />
                                        {msg.content}
                                    </a>
                                )}
                                {msg.message_type === 'text' && (
                                    <div className="text-sm">{msg.content}</div>
                                )}
                                <div className="text-[10px] text-gray-500 text-right mt-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-gray-100 flex items-center gap-2">
                <button className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
                    <Smile className="w-6 h-6" />
                </button>
                <button
                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Paperclip className="w-6 h-6" />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                />
                <input
                    type="text"
                    placeholder="Type a message"
                    className="flex-1 p-2 rounded-lg border-none focus:outline-none"
                    value={newMessage}
                    onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                    }}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                    onClick={sendMessage}
                >
                    <Send className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}
