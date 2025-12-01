"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { X, Users as UsersIcon, Plus, Edit2, LogOut } from "lucide-react";
import toast from "react-hot-toast";

interface GroupManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GroupManagementModal({ isOpen, onClose }: GroupManagementModalProps) {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
    const [groupName, setGroupName] = useState("");
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [myGroups, setMyGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            fetchFriends();
            fetchMyGroups();
        }
    }, [isOpen, user]);

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

    const fetchMyGroups = async () => {
        if (!user) return;

        // Get all group conversation IDs for current user
        const { data: myConvs } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("user_id", user.id);

        if (myConvs && myConvs.length > 0) {
            const conversationIds = myConvs.map((m) => m.conversation_id);

            // Get group conversation details
            const { data: groups } = await supabase
                .from("conversations")
                .select(`
                    *,
                    conversation_members!inner (
                        user_id
                    )
                `)
                .in("id", conversationIds)
                .eq("is_group", true);

            if (groups) {
                setMyGroups(groups);
            }
        }
    };

    const createGroup = async () => {
        if (!user || !groupName.trim()) {
            toast.error("Please enter a group name");
            return;
        }

        if (selectedFriends.length === 0) {
            toast.error("Please select at least one friend");
            return;
        }

        setLoading(true);

        try {
            // 1. Create group conversation
            const { data: conv, error: convError } = await supabase
                .from("conversations")
                .insert({
                    is_group: true,
                    group_name: groupName,
                })
                .select()
                .single();

            if (convError) throw convError;

            // 2. Add members (current user + selected friends)
            const members = [user.id, ...selectedFriends].map(userId => ({
                conversation_id: conv.id,
                user_id: userId,
            }));

            const { error: membersError } = await supabase
                .from("conversation_members")
                .insert(members);

            if (membersError) throw membersError;

            toast.success(`Group "${groupName}" created!`);
            setGroupName("");
            setSelectedFriends([]);
            fetchMyGroups();
            setActiveTab("manage");
        } catch (error) {
            console.error("Error creating group:", error);
            toast.error("Failed to create group");
        } finally {
            setLoading(false);
        }
    };

    const leaveGroup = async (groupId: string, groupName: string) => {
        if (!user) return;

        const confirmed = confirm(`Are you sure you want to leave "${groupName}"?`);
        if (!confirmed) return;

        try {
            await supabase
                .from("conversation_members")
                .delete()
                .eq("conversation_id", groupId)
                .eq("user_id", user.id);

            toast.success(`Left "${groupName}"`);
            fetchMyGroups();
        } catch (error) {
            console.error("Error leaving group:", error);
            toast.error("Failed to leave group");
        }
    };

    const toggleFriendSelection = (friendId: string) => {
        setSelectedFriends(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-[500px] max-h-[600px] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <UsersIcon className="w-6 h-6" />
                        Groups
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        className={`flex-1 py-3 font-medium transition-colors ${activeTab === "create"
                            ? "text-[#25d366] border-b-2 border-[#25d366]"
                            : "text-gray-500 hover:text-gray-700"
                            }`}
                        onClick={() => setActiveTab("create")}
                    >
                        Create Group
                    </button>
                    <button
                        className={`flex-1 py-3 font-medium transition-colors ${activeTab === "manage"
                            ? "text-[#25d366] border-b-2 border-[#25d366]"
                            : "text-gray-500 hover:text-gray-700"
                            }`}
                        onClick={() => setActiveTab("manage")}
                    >
                        My Groups ({myGroups.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === "create" ? (
                        <div className="space-y-4">
                            {/* Group Name Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Group Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter group name"
                                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                />
                            </div>

                            {/* Member Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Members ({selectedFriends.length} selected)
                                </label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-2">
                                    {friends.length === 0 ? (
                                        <p className="text-gray-500 text-center py-4">
                                            No friends available. Add friends first!
                                        </p>
                                    ) : (
                                        friends.map(friend => (
                                            <label
                                                key={friend.clerk_id}
                                                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFriends.includes(friend.clerk_id)}
                                                    onChange={() => toggleFriendSelection(friend.clerk_id)}
                                                    className="w-4 h-4 text-[#25d366] border-gray-300 rounded focus:ring-[#25d366]"
                                                />
                                                <div className="flex items-center gap-2 flex-1">
                                                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium">
                                                        {friend.profile_image ? (
                                                            <img
                                                                src={friend.profile_image}
                                                                alt={friend.first_name}
                                                                className="w-full h-full rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <span>
                                                                {friend.first_name?.[0]}{friend.last_name?.[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="font-medium">
                                                        {friend.first_name} {friend.last_name}
                                                    </span>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Create Button */}
                            <button
                                onClick={createGroup}
                                disabled={loading || !groupName.trim() || selectedFriends.length === 0}
                                className="w-full bg-[#25d366] text-white py-2 rounded-lg font-medium hover:bg-[#20bd5a] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                {loading ? "Creating..." : "Create Group"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myGroups.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>You haven't joined any groups yet</p>
                                </div>
                            ) : (
                                myGroups.map(group => (
                                    <div
                                        key={group.id}
                                        className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-[#25d366] rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                    {group.group_name[0]}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">
                                                        {group.group_name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {group.conversation_members.length} members
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => leaveGroup(group.id, group.group_name)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Leave group"
                                            >
                                                <LogOut className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
