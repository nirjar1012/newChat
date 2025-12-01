"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { Search, Plus, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/context/socket-context";
import { FriendRequestModal } from "./friend-request-modal";
import { GroupManagementModal } from "./group-management-modal";
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
    const { user } = useUser();
    const { socket } = useSocket();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [friends, setFriends] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
    const [showFriendModal, setShowFriendModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

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
                const exists = prev.find(u => u?.id === userId || u?.clerk_id === userId);
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
            setOnlineUsers((prev) => prev.filter((u) => u?.id !== userId && u?.clerk_id !== userId));
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
                .eq("clerk_id", friendId)
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
                    .in("clerk_id", friendIds);

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
                            .eq("clerk_id", otherMember.user_id)
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
                        last_message: lastMsg
                    };
                }));

                setConversations(enrichedConvs as Conversation[]);
            }
        }
    };

    const startConversation = async (otherUserId: string) => {
        if (!user) return;

        // Check if conversation already exists
        const { data: existingMembers } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", user.id);

        let existingConvId = null;

        if (existingMembers) {
            for (const member of existingMembers) {
                const { data: otherMember } = await supabase
                    .from("conversation_members")
                    .select("conversation_id")
                    .eq("conversation_id", member.conversation_id)
                    .eq("user_id", otherUserId)
                    .single();

                if (otherMember) {
                    existingConvId = otherMember.conversation_id;
                    break;
                }
            }
        }

        if (existingConvId) {
            // Clear unread count for this conversation
            setUnreadCounts(prev => {
                const newCounts = { ...prev };
                delete newCounts[existingConvId];
                return newCounts;
            });

            onSelectConversation(existingConvId);
            setSearchQuery("");
        } else {
            const { data: conv } = await supabase
                .from("conversations")
                .insert({ is_group: false })
                .select()
                .single();

            if (conv) {
                await supabase.from("conversation_members").insert([
                    { conversation_id: conv.id, user_id: user.id },
                    { conversation_id: conv.id, user_id: otherUserId }
                ]);

                fetchConversations();
                onSelectConversation(conv.id);
                setSearchQuery("");
            }
        }
    };

    // Merge conversations with friends to create a unified list
    const getUnifiedList = () => {
        const unifiedMap = new Map();

        // 1. Add all friends first
        friends.forEach((u: any) => {
            unifiedMap.set(u.clerk_id, {
                user: u,
                conversation: null,
                last_message: null,
                isOnline: onlineUsers.some(ou => ou.id === u.clerk_id),
                unreadCount: 0
            });
        });

        // 2. Overlay conversations (both individual and groups)
        conversations.forEach(conv => {
            if (conv.is_group) {
                // Group conversation - add as separate item
                unifiedMap.set(`group_${conv.id}`, {
                    user: null,
                    conversation: conv,
                    last_message: conv.last_message,
                    isOnline: false,
                    unreadCount: unreadCounts[conv.id] || 0,
                    isGroup: true,
                    groupName: conv.group_name,
                    memberCount: conv.conversation_members?.length || 0
                });
            } else {
                // Individual conversation
                const otherUser = conv.other_user;
                if (otherUser && unifiedMap.has(otherUser.clerk_id)) {
                    unifiedMap.set(otherUser.clerk_id, {
                        ...unifiedMap.get(otherUser.clerk_id),
                        conversation: conv,
                        last_message: conv.last_message,
                        unreadCount: unreadCounts[conv.id] || 0
                    });
                }
            }
        });

        // 3. Convert to array and sort
        return Array.from(unifiedMap.values()).sort((a: any, b: any) => {
            // Sort by online status first
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;

            // Then by last message time
            const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
            const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;

            if (timeA !== timeB) return timeB - timeA;

            // Finally alphabetical
            return (a.user.first_name || "").localeCompare(b.user.first_name || "");
        });
    };

    const unifiedList = getUnifiedList();
    const filteredList = unifiedList.filter((item: any) => {
        if (!searchQuery) return true;
        const fullName = `${item.user.first_name} ${item.user.last_name}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="w-[400px] border-r h-full flex flex-col bg-white border-gray-200">
            {/* Header */}
            <div className="h-[60px] px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-gray-200 shrink-0">
                <UserButton />
                <div className="flex gap-4 text-[#54656f]">
                    <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <MessageSquare className="w-5 h-5" />
                    </button>
                    <div className="relative">
                        <button
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors relative"
                            onClick={() => setShowDropdown(!showDropdown)}
                        >
                            <Plus className="w-5 h-5" />
                            {pendingRequestsCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {pendingRequestsCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {showDropdown && (
                            <div className="absolute right-0 top-12 bg-white shadow-lg rounded-lg border w-56 z-50">
                                <button
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                                    onClick={() => {
                                        setShowFriendModal(true);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Manage Friends</span>
                                </button>
                                <button
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                    onClick={() => {
                                        setShowGroupModal(true);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <Users className="w-4 h-4" />
                                    <span>Create/Manage Groups</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="p-2 bg-white border-b border-gray-100">
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f]">
                        <Search className="w-4 h-4" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search or start new chat"
                        className="w-full pl-10 pr-4 py-1.5 bg-[#f0f2f5] rounded-lg text-sm focus:outline-none text-[#3b4a54] placeholder:text-[#54656f]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Unified List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredList.map((item: any) => {
                    const u = item.user;
                    const conv = item.conversation;
                    const isActive = conv && selectedConversationId === conv.id;
                    const isGroup = item.isGroup;

                    return (
                        <div
                            key={isGroup ? `group_${conv.id}` : u.clerk_id}
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors group",
                                isActive ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                            )}
                            onClick={() => isGroup ? onSelectConversation(conv.id) : startConversation(u.clerk_id)}
                        >
                            <div className="relative shrink-0">
                                <div className="w-[49px] h-[49px] bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                                    {isGroup ? (
                                        <div className="w-full h-full flex items-center justify-center bg-[#25d366] text-white font-bold text-lg">
                                            <Users className="w-6 h-6" />
                                        </div>
                                    ) : u.profile_image ? (
                                        <img src={u.profile_image} alt={u.first_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#dfe3e5] text-[#54656f] font-medium text-lg">
                                            {u.first_name?.[0] || u.username?.[0] || 'U'}{u.last_name?.[0] || ''}
                                        </div>
                                    )}
                                </div>
                                {!isGroup && item.isOnline && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-white"></div>
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden border-b border-gray-100 group-hover:border-transparent pb-3 pt-1 pr-2">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <div className="font-semibold text-black text-[17px] truncate">
                                        {isGroup 
                                            ? item.groupName
                                            : (u.first_name || u.last_name
                                                ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                                                : u.username || 'User')
                                        }
                                    </div>
                                    {item.last_message?.created_at && (
                                        <div className="text-xs text-[#667781] shrink-0">
                                            {new Date(item.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-sm text-[#667781] truncate max-w-[200px]">
                                        {item.last_message ? (
                                            item.last_message.message_type === 'image' ? (
                                                <span className="flex items-center gap-1"><span className="text-xs">📷</span> Photo</span>
                                            ) : item.last_message.message_type === 'file' ? (
                                                <span className="flex items-center gap-1"><span className="text-xs">📎</span> File</span>
                                            ) : (
                                                item.last_message.content
                                            )
                                        ) : (
                                            <span className="italic text-xs">Start a conversation</span>
                                        )}
                                    </div>
                                    {item.unreadCount > 0 && (
                                        <div className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                            {item.unreadCount}
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