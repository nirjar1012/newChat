"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { useSocket } from "@/context/socket-context";
import { Send, Paperclip, Smile, User } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    message_type: 'text' | 'image' | 'file';
    file_url?: string;
    read_at?: string | null;
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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        if (conversationId && user) {
            fetchMessages(conversationId);
            fetchConversationDetails(conversationId);
            markMessagesAsRead(conversationId);

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
            if (message.sender_id === user?.id) return;

            if (conversationId && (message as any).conversation_id === conversationId) {
                if (message.sender_id !== user?.id) {
                    setMessages((prev) => [...prev, message]);
                    scrollToBottom();
                    markMessagesAsRead(conversationId);
                }
            }
        };

        const handleUserTyping = ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
            if (userId !== user?.id) {
                if (isTyping) {
                    setTypingUser(userId);
                } else {
                    setTypingUser(null);
                }
            }
        };

        socket.on("message:receive", handleReceiveMessage);
        socket.on("user_typing", handleUserTyping);

        return () => {
            socket.off("message:receive", handleReceiveMessage);
            socket.off("user_typing", handleUserTyping);
        };
    }, [socket, conversationId, user]);

    useEffect(() => {
        if (!socket || !otherUser) return;

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

    const markMessagesAsRead = async (convId: string) => {
        if (!user) return;

        await supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("conversation_id", convId)
            .neq("sender_id", user.id)
            .is("read_at", null);
    };

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
        // Optimistic update
        setMessages((prev) => [...prev, messageData as any]);
        scrollToBottom();

        const { data, error } = await supabase
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: messageData.content,
                message_type: messageData.message_type,
                file_url: messageData.file_url
            })
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
            }
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !conversationId || !user) return;

        const messageData = {
            id: `temp-${Date.now()}-${Math.random()}`,
            conversation_id: conversationId,
            sender_id: user.id,
            content: newMessage,
            message_type: 'text',
            created_at: new Date().toISOString(),
            read_at: null
        };

        // Optimistic update
        setMessages((prev) => [...prev, messageData as any]);
        setNewMessage("");
        scrollToBottom();

        const { data, error } = await supabase
            .from("messages")
            .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: messageData.content,
                message_type: 'text'
            })
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
            }
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
                    <div className="font-bold text-black text-lg">
                        {otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : "Chat"}
                    </div>
                    <div className="text-xs text-gray-500">
                        {typingUser === otherUser?.clerk_id ? "typing..." : isOtherUserOnline ? "Online" : otherUser?.last_seen ? `Last seen ${new Date(otherUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Offline"}
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#efeae2]">
                {messages.reduce((acc: React.ReactNode[], msg, index) => {
                    const isMe = msg.sender_id === user?.id;
                    const previousMsg = messages[index - 1];
                    const isFirstInGroup = !previousMsg || previousMsg.sender_id !== msg.sender_id;

                    // Date Separator Logic
                    const msgDate = new Date(msg.created_at);
                    const prevDate = previousMsg ? new Date(previousMsg.created_at) : null;

                    if (!prevDate || msgDate.toDateString() !== prevDate.toDateString()) {
                        let dateLabel = msgDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);

                        if (msgDate.toDateString() === today.toDateString()) {
                            dateLabel = "Today";
                        } else if (msgDate.toDateString() === yesterday.toDateString()) {
                            dateLabel = "Yesterday";
                        }

                        acc.push(
                            <div key={`date-${index}-${msgDate.toDateString()}`} className="flex justify-center my-4">
                                <span className="bg-white/90 text-gray-600 text-xs py-1 px-3 rounded-lg shadow-sm border border-gray-100">
                                    {dateLabel}
                                </span>
                            </div>
                        );
                    }

                    acc.push(
                        <div
                            key={`msg-${msg.id}`}
                            className={cn(
                                "flex w-full",
                                isMe ? "justify-end" : "justify-start",
                                isFirstInGroup ? "mt-2" : "mt-0.5"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[70%] px-2 py-1 rounded-lg shadow-sm relative group",
                                    isMe ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"
                                )}
                            >
                                {msg.message_type === 'image' && msg.file_url && (
                                    <div className="mb-1 rounded overflow-hidden">
                                        <img src={msg.file_url} alt="Shared image" className="max-w-full max-h-64 object-cover" />
                                    </div>
                                )}
                                {msg.message_type === 'file' && msg.file_url && (
                                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 bg-black/5 rounded mb-1 hover:bg-black/10 transition-colors">
                                        <div className="bg-red-100 p-2 rounded-full">
                                            <Paperclip className="w-4 h-4 text-red-500" />
                                        </div>
                                        <span className="text-sm text-gray-900 font-medium truncate max-w-[150px]">{msg.content}</span>
                                    </a>
                                )}
                                {msg.message_type === 'text' && (
                                    <div className="text-sm text-gray-800 leading-relaxed px-1 pt-1">
                                        {msg.content}
                                    </div>
                                )}
                                <div className={cn(
                                    "text-[10px] text-gray-500 text-right flex items-center justify-end gap-1",
                                    msg.message_type === 'text' ? "-mt-1 mb-0.5" : "mt-1"
                                )}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                                    {isMe && (
                                        <span className={cn("ml-1", msg.read_at ? "text-blue-500" : "text-gray-400")}>
                                            {/* Double tick icon */}
                                            <svg viewBox="0 0 16 15" width="16" height="15" className="w-3 h-3">
                                                <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.473-.018l5.358-7.717a.42.42 0 0 0-.063-.51zM6.013 3.316l-.478-.372a.365.365 0 0 0-.51.063L.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.473-.018l5.358-7.717a.42.42 0 0 0-.063-.51z" />
                                            </svg>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                    return acc;
                }, [])}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-gray-100 flex items-center gap-2 relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-16 left-4 z-50">
                        <EmojiPicker
                            onEmojiClick={(emojiData) => {
                                setNewMessage((prev) => prev + emojiData.emoji);
                                setShowEmojiPicker(false);
                            }}
                            width={350}
                            height={400}
                        />
                    </div>
                )}
                <button
                    className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
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
                    className="flex-1 p-2 rounded-lg border-none focus:outline-none text-gray-900"
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
