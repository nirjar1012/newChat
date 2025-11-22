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
        <div className="w-80 border-r h-full flex flex-col bg-white">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <UserButton />
                <div className="font-semibold">Chats</div>
                <button className="p-2 hover:bg-gray-200 rounded-full">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="p-2">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Online Users Section */}
            <div className="p-3 border-b overflow-x-auto whitespace-nowrap">
                <div className="text-xs text-gray-500 mb-2 font-semibold">ONLINE USERS</div>
                <div className="flex gap-4">
                    {onlineUsers.filter(u => u && u.id && u.id !== user?.id).map(u => (
                        <div key={u.id} className="flex flex-col items-center cursor-pointer" onClick={() => startConversation(u.id)}>
                            <div className="relative">
                                <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
                                    {u.profile_image ? <img src={u.profile_image} alt={u.first_name} /> : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-xs">
                                            {u.first_name?.[0]}{u.last_name?.[0]}
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="text-xs mt-1 max-w-[60px] truncate">
                                {u.first_name}
                            </div>
                        </div>
                    ))}
                    {onlineUsers.filter(u => u.id !== user?.id).length === 0 && <div className="text-xs text-gray-400 italic">No one else is online</div>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {searchQuery.length > 0 ? (
                    <div className="p-2">
                        <div className="text-xs text-gray-500 mb-2">Search Results</div>
                        {searchResults.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer"
                                onClick={() => startConversation(u.clerk_id)}
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
                                        {u.profile_image ? <img src={u.profile_image} alt={u.username} /> : null}
                                    </div>
                                    {onlineUsers.some(ou => ou.id === u.clerk_id) && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-medium">{u.first_name} {u.last_name}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        {conversations.map((conv: any) => {
                            const otherUser = conv.other_user;
                            const isOnline = otherUser && onlineUsers.some(u => u.id === otherUser.clerk_id);

                            return (
                                <div
                                    key={conv.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-50",
                                        selectedConversationId === conv.id && "bg-gray-100"
                                    )}
                                    onClick={() => onSelectConversation(conv.id)}
                                >
                                    <div className="relative">
                                        <div className="w-12 h-12 bg-gray-300 rounded-full overflow-hidden flex items-center justify-center">
                                            {otherUser?.profile_image ? (
                                                <img src={otherUser.profile_image} alt={otherUser.first_name} />
                                            ) : (
                                                <UserButton />
                                            )}
                                        </div>
                                        {isOnline ? (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                        ) : (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-medium truncate">
                                            {otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : "Unknown User"}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate flex justify-between">
                                            <span className="truncate max-w-[140px]">
                                                {conv.last_message?.message_type === 'image' ? '📷 Image' :
                                                    conv.last_message?.message_type === 'file' ? '📎 File' :
                                                        conv.last_message?.content || 'No messages yet'}
                                            </span>
                                            {conv.last_message?.created_at && (
                                                <span className="text-xs ml-2">
                                                    {new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
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
