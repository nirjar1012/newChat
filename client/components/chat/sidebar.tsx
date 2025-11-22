"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { Search, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/context/socket-context";

interface Conversation {
    id: string;
    is_group: boolean;
    group_name: string | null;
    group_image: string | null;
    last_message?: {
        content: string;
        created_at: string;
    };
    participants: any[];
}

export function Sidebar({ onSelectConversation, selectedConversationId }: { onSelectConversation: (id: string) => void, selectedConversationId: string | null }) {
    const { user } = useUser();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const { socket } = useSocket();

    useEffect(() => {
        if (user) {
            fetchConversations();
        }
    }, [user]);

    useEffect(() => {
        if (!socket) return;

        socket.emit("get-online-users");

        socket.on("online-users", (users: any[]) => {
            setOnlineUsers(users);
        });

        socket.on("user-online", ({ userId, userInfo }: { userId: string, userInfo: any }) => {
            setOnlineUsers((prev) => {
                const exists = prev.find(u => u.id === userId);
                if (exists) return prev;
                return [...prev, userInfo];
            });
        });

        socket.on("user-offline", (userId: string) => {
            setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
        });

        return () => {
            socket.off("online-users");
            socket.off("user-online");
            socket.off("user-offline");
        };
    }, [socket]);

    const fetchConversations = async () => {
        if (!user) return;

        // 1. Get all conversation IDs for current user
        const { data: myConvs, error } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", user.id);

        if (myConvs && myConvs.length > 0) {
            const conversationIds = myConvs.map((m) => m.conversation_id);

            // 2. Get conversation details
            const { data: convs, error: convError } = await supabase
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

                setConversations(enrichedConvs);
            }
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length > 2) {
            setIsSearching(true);
            // Search by first_name, last_name, or username
            const { data, error } = await supabase
                .from("users")
                .select("*")
                .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,username.ilike.%${query}%`)
                .neq("clerk_id", user?.id || "");

            if (data) {
                setSearchResults(data);
            }
            setIsSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    const startConversation = async (otherUserId: string) => {
        if (!user) return;

        // Check if conversation already exists
        // This is a bit complex with Supabase, for now let's just create a new one or find existing if simple
        // For MVP, let's just create if not exists logic is hard, but ideally we check.
        // Let's try to find one.

        // ... (Simplified for brevity, assuming create new for now or we can improve this logic)
        // Actually, let's just create one, but we should check if one exists between these two users.

        const { data: conv, error: convError } = await supabase
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
            setSearchResults([]);
        }
    };

    return (
        <div className="w-[400px] border-r h-full flex flex-col bg-white border-gray-200">
            {/* Header */}
            <div className="h-[60px] px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-gray-200 shrink-0">
                <UserButton />
                <div className="flex gap-4 text-[#54656f]">
                    <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <MessageSquare className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <Plus className="w-5 h-5" />
                    </button>
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
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Online Users (Custom Feature - kept but styled) */}
            <div className="py-3 px-4 border-b border-gray-100 overflow-x-auto whitespace-nowrap bg-white">
                <div className="text-xs text-[#008069] font-medium mb-3 uppercase tracking-wider">Online Now</div>
                <div className="flex gap-4">
                    {onlineUsers.filter(u => u && u.id && u.id !== user?.id).map(u => (
                        <div key={u.id} className="flex flex-col items-center cursor-pointer group" onClick={() => startConversation(u.id)}>
                            <div className="relative">
                                <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-[#008069] transition-all">
                                    {u.profile_image ? <img src={u.profile_image} alt={u.first_name} className="w-full h-full object-cover" /> : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#dfe3e5] text-[#54656f] font-medium text-lg">
                                            {u.first_name?.[0]}{u.last_name?.[0]}
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#25d366] rounded-full border-2 border-white"></div>
                            </div>
                            <div className="text-xs mt-1.5 text-[#3b4a54] font-medium max-w-[70px] truncate">
                                {u.first_name}
                            </div>
                        </div>
                    ))}
                    {onlineUsers.filter(u => u && u.id && u.id !== user?.id).length === 0 && (
                        <div className="text-sm text-[#8696a0] italic py-2">No one else is online</div>
                    )}
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {searchQuery.length > 0 ? (
                    <div className="py-2">
                        <div className="px-4 py-2 text-xs text-[#008069] font-medium uppercase">Search Results</div>
                        {searchResults.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 px-3 py-3 hover:bg-[#f0f2f5] cursor-pointer transition-colors"
                                onClick={() => startConversation(u.clerk_id)}
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                                        {u.profile_image ? <img src={u.profile_image} alt={u.username} className="w-full h-full object-cover" /> : null}
                                    </div>
                                </div>
                                <div className="border-b border-gray-100 flex-1 py-1">
                                    <div className="font-semibold text-black text-[17px]">{u.first_name} {u.last_name}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        {conversations.map((conv: any) => {
                            const otherUser = conv.other_user;
                            const isOnline = otherUser && onlineUsers.some(u => u.id === otherUser.clerk_id);
                            const isActive = selectedConversationId === conv.id;

                            return (
                                <div
                                    key={conv.id}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors group",
                                        isActive ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                                    )}
                                    onClick={() => onSelectConversation(conv.id)}
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-[49px] h-[49px] bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                                            {otherUser?.profile_image ? (
                                                <img src={otherUser.profile_image} alt={otherUser.first_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <UserButton />
                                            )}
                                        </div>
                                        {isOnline && (
                                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-white"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden border-b border-gray-100 group-hover:border-transparent pb-3 pt-1 pr-2">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <div className="font-semibold text-black text-[17px] truncate">
                                                {otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : "Unknown User"}
                                            </div>
                                            {conv.last_message?.created_at && (
                                                <div className="text-xs text-[#667781] shrink-0">
                                                    {new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-sm text-[#667781] truncate max-w-[200px]">
                                                {conv.last_message?.message_type === 'image' ? (
                                                    <span className="flex items-center gap-1"><span className="text-xs">📷</span> Photo</span>
                                                ) : conv.last_message?.message_type === 'file' ? (
                                                    <span className="flex items-center gap-1"><span className="text-xs">📎</span> File</span>
                                                ) : (
                                                    conv.last_message?.content || 'No messages yet'
                                                )}
                                            </div>
                                            {/* Unread badge placeholder */}
                                            {/* <div className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">2</div> */}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
