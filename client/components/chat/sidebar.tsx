"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@/components/auth/user-button";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Search, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/context/socket-context";
import { FriendRequestModal } from "./friend-request-modal";
import toast from "react-hot-toast";

interface Conversation {
    id: string;
    is_group: boolean;
    group_name: string | null;
    group_image: string | null;
    last_message?: {
        content: string;
        created_at: string;
        message_type: 'text' | 'image' | 'file';
    };
    participants: any[];
    other_user?: any;
    last_message_at?: string;
}

export function Sidebar({ onSelectConversation, selectedConversationId }: { onSelectConversation: (id: string) => void, selectedConversationId: string | null }) {
    const [user, setUser] = useState<User | null>(null);
    const { socket } = useSocket();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [showFriendModal, setShowFriendModal] = useState(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // Get authenticated user
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            fetchConversations();
            fetchFriends();
            fetchUnreadCounts();
            fetchPendingRequestsCount();
        }
    }, [user]);

    useEffect(() => {
        if (!socket) return;

        socket.emit("get-online-users");

        const handleOnlineUsers = (users: any[]) => {
            console.log('📋 Received online users list:', users);
            setOnlineUsers(users);
        };

        const handleUserOnline = ({ userId, userInfo }: { userId: string, userInfo: any }) => {
            console.log('🟢 User came online:', userId, userInfo);

            // Don't add current user to their own online list
            if (userId === user?.id) {
                console.log('Skipping current user from online list');
                return;
            }

            setOnlineUsers((prev) => {
                const exists = prev.find(u => u?.id === userId || u?.id === userId);
                if (exists) {
                    console.log('User already in list, skipping');
                    return prev;
                }
                // Ensure userInfo has the id field
                const newUser = { ...userInfo, id: userId };
                console.log('Adding user to online list:', newUser);
                return [...prev, newUser];
            });
        };

        const handleUserOffline = (userId: string) => {
            console.log('🔴 User went offline:', userId);
            setOnlineUsers((prev) => prev.filter((u) => u?.id !== userId));
        };

        const handleNewMessage = (message: any) => {
            if (message.sender_id !== user?.id) {
                if (selectedConversationId !== message.conversation_id) {
                    setUnreadCounts(prev => ({
                        ...prev,
                        [message.conversation_id]: (prev[message.conversation_id] || 0) + 1
                    }));
                }
                fetchConversations(); // Refresh list to show new message preview
            }
        };

        const handleFriendshipCreated = async ({ friendId }: { friendId: string }) => {
            console.log('🎉 New friendship created with:', friendId);

            // Fetch the friend's details
            const { data: friendData } = await supabase
                .from("users")
                .select("*")
                .eq("id", friendId)
                .single();

            if (friendData) {
                const friendName = `${friendData.first_name} ${friendData.last_name}`.trim() || friendData.username;
                toast.success(`${friendName} is now your friend! 🎉`, {
                    duration: 4000,
                    icon: '👋',
                });

                // Refresh friends list
                fetchFriends();
                fetchPendingRequestsCount();
            }
        };

        socket.on("online-users", handleOnlineUsers);
        socket.on("user-online", handleUserOnline);
        socket.on("user-offline", handleUserOffline);
        socket.on("message:receive", handleNewMessage);
        socket.on("friendship:created", handleFriendshipCreated);

        return () => {
            socket.off("online-users", handleOnlineUsers);
            socket.off("user-online", handleUserOnline);
            socket.off("user-offline", handleUserOffline);
            socket.off("message:receive", handleNewMessage);
            socket.off("friendship:created", handleFriendshipCreated);
        };
    }, [socket, user, selectedConversationId]);

    const fetchUnreadCounts = async () => {
        if (!user) return;

        const { data: unreadData } = await supabase
            .from("messages")
            .select("conversation_id")
            .neq("sender_id", user.id)
            .is("read_at", null);

        if (unreadData) {
            const counts: { [key: string]: number } = {};
            unreadData.forEach((msg: any) => {
                counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
            });
            setUnreadCounts(counts);
        }
    };

    const fetchFriends = async () => {
        if (!user) return;

        // Get all friendships where user is either user1 or user2
        const { data: friendships } = await supabase
            .from("friends")
            .select("*")
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        if (friendships) {
            // Extract friend IDs and fetch their details
            const friendIds = friendships.map(f =>
                f.user1_id === user.id ? f.user2_id : f.user1_id
            );

            if (friendIds.length > 0) {
                const { data: friendsData } = await supabase
                    .from("users")
                    .select("*")
                    .in("id", friendIds);

                if (friendsData) {
                    setFriends(friendsData);
                }
            }
        }
    };

    const fetchPendingRequestsCount = async () => {
        if (!user) return;

        const { data } = await supabase
            .from("friend_requests")
            .select("id")
            .eq("receiver_id", user.id)
            .eq("status", "pending");

        if (data) {
            setPendingRequestsCount(data.length);
        }
    };

    const fetchConversations = async () => {
        if (!user) return;

        // 1. Get all conversation IDs for current user
        const { data: myConvs } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", user.id);

        if (myConvs && myConvs.length > 0) {
            const conversationIds = myConvs.map((m) => m.conversation_id);

            // 2. Get conversation details
            const { data: convs } = await supabase
                .from("conversations")
                .select(`
                    *,
                    conversation_members!inner (
                        user_id
                    )
                `)
                .in("id", conversationIds)
                .order("last_message_at", { ascending: false });

            if (convs) {
                // 3. For each conversation, fetch the OTHER user's details
                const enrichedConvs = await Promise.all(convs.map(async (conv: any) => {
                    const otherMember = conv.conversation_members.find((m: any) => m.user_id !== user.id);
                    let otherUser = null;

                    if (otherMember) {
                        const { data: userData } = await supabase
                            .from("users")
                            .select("*")
                            .eq("id", otherMember.user_id)
                            .single();
                        otherUser = userData;
                    }

                    // Fetch last message
                    const { data: lastMsg } = await supabase
                        .from("messages")
                        .select("content, created_at, message_type")
                        .eq("conversation_id", conv.id)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .single();

                    return {
                        ...conv,
                        other_user: otherUser,
                        last_message: lastMsg,
                        participants: [otherUser]
                    };
                }));

                setConversations(enrichedConvs);
            }
        }
    };

    const handleCreateConversation = async (friendId: string) => {
        if (!user) return;

        try {
            // Check if conversation already exists
            const { data: existingConvs } = await supabase
                .from("conversation_members")
                .select("conversation_id")
                .eq("user_id", user.id);

            if (existingConvs) {
                for (const conv of existingConvs) {
                    const { data: otherMember } = await supabase
                        .from("conversation_members")
                        .select("*")
                        .eq("conversation_id", conv.conversation_id)
                        .eq("user_id", friendId)
                        .single();

                    if (otherMember) {
                        onSelectConversation(conv.conversation_id);
                        setSearchQuery(""); // Clear search
                        return;
                    }
                }
            }

            // Create new conversation
            const { data: newConv, error: convError } = await supabase
                .from("conversations")
                .insert({
                    is_group: false,
                    created_at: new Date().toISOString(),
                    last_message_at: new Date().toISOString()
                })
                .select()
                .single();

            if (convError) throw convError;

            // Add members
            await supabase
                .from("conversation_members")
                .insert([
                    { conversation_id: newConv.id, user_id: user.id, joined_at: new Date().toISOString() },
                    { conversation_id: newConv.id, user_id: friendId, joined_at: new Date().toISOString() }
                ]);

            fetchConversations();
            onSelectConversation(newConv.id);
            setSearchQuery(""); // Clear search
        } catch (error) {
            console.error("Error creating conversation:", error);
            toast.error("Failed to start conversation");
        }
    };

    const filteredItems = searchQuery
        ? friends.filter(friend =>
            friend.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : conversations;

    return (
        <div className="w-[400px] h-full bg-white border-r flex flex-col">
            {/* Header */}
            <div className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between shrink-0">
                <UserButton />
                <div className="flex gap-4 text-[#54656f]">
                    <button
                        onClick={() => setShowFriendModal(true)}
                        className="p-2 hover:bg-black/10 rounded-full relative"
                        title="Friend Requests"
                    >
                        <Plus className="w-6 h-6" />
                        {pendingRequestsCount > 0 && (
                            <span className="absolute top-0 right-0 w-5 h-5 bg-[#25d366] rounded-full border-2 border-[#f0f2f5] flex items-center justify-center text-[10px] font-bold text-white">
                                {pendingRequestsCount}
                            </span>
                        )}
                    </button>
                    <button className="p-2 hover:bg-black/10 rounded-full">
                        <MessageSquare className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="p-2 bg-white border-b shrink-0">
                <div className="bg-[#f0f2f5] rounded-lg flex items-center px-4 py-2">
                    <Search className="w-5 h-5 text-[#54656f] mr-4" />
                    <input
                        type="text"
                        placeholder="Search or start new chat"
                        className="bg-transparent w-full focus:outline-none text-[#3b4a54] placeholder:text-[#54656f]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {searchQuery && filteredItems.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                        No friends found. Add friends to start chatting!
                    </div>
                )}

                {filteredItems.map((item: any) => {
                    // Determine if item is a conversation or a friend (search result)
                    const isConversation = !searchQuery;
                    const u = isConversation ? item.other_user : item;

                    if (!u) return null;

                    return (
                        <div
                            key={isConversation ? item.id : u.id}
                            className={cn(
                                "flex items-center px-3 py-2 cursor-pointer hover:bg-[#f5f6f6] group transition-colors",
                                selectedConversationId === (isConversation ? item.id : null) && "bg-[#f0f2f5]"
                            )}
                            onClick={() => isConversation ? onSelectConversation(item.id) : handleCreateConversation(u.id)}
                        >
                            <div className="relative w-12 h-12 mr-3 shrink-0">
                                <div className="w-12 h-12 rounded-full overflow-hidden">
                                    {u.profile_image ? (
                                        <img src={u.profile_image} alt={u.first_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#dfe3e5] text-[#54656f] font-medium text-lg">
                                            {u.first_name?.[0] || u.username?.[0] || 'U'}{u.last_name?.[0] || ''}
                                        </div>
                                    )}
                                </div>
                                {onlineUsers.some(onlineUser => onlineUser.id === u.id) && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-white"></div>
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden border-b border-gray-100 group-hover:border-transparent pb-3 pt-1 pr-2">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <div className="font-semibold text-black text-[17px] truncate">
                                        {u.first_name || u.last_name
                                            ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                                            : u.username || 'User'
                                        }
                                    </div>
                                    {isConversation && item.last_message?.created_at && (
                                        <div className="text-xs text-[#667781] shrink-0">
                                            {new Date(item.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-sm text-[#667781] truncate max-w-[200px]">
                                        {isConversation ? (
                                            item.last_message ? (
                                                item.last_message.message_type === 'image' ? (
                                                    <span className="flex items-center gap-1"><span className="text-xs">📷</span> Photo</span>
                                                ) : item.last_message.message_type === 'file' ? (
                                                    <span className="flex items-center gap-1"><span className="text-xs">📎</span> File</span>
                                                ) : (
                                                    item.last_message.content
                                                )
                                            ) : (
                                                <span className="italic text-xs">Start a conversation</span>
                                            )
                                        ) : (
                                            <span className="text-xs">Click to start chat</span>
                                        )}
                                    </div>
                                    {isConversation && unreadCounts[item.id] > 0 && (
                                        <div className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                            {unreadCounts[item.id]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Friend Request Modal */}
            <FriendRequestModal
                isOpen={showFriendModal}
                onClose={() => {
                    setShowFriendModal(false);
                    fetchFriends(); // Refresh friends list
                    fetchPendingRequestsCount(); // Refresh count
                }}
            />
        </div>
    );
}
