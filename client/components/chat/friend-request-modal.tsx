"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { X, UserPlus, Clock, Check, X as XIcon } from "lucide-react";
import { useSocket } from "@/context/socket-context";
import toast from "react-hot-toast";

interface FriendRequest {
    id: string;
    sender_id: string;
    receiver_email: string;
    receiver_id: string | null;
    status: string;
    created_at: string;
    sender?: {
        first_name: string;
        last_name: string;
        username: string;
        profile_image: string;
        email: string;
    };
}

export function FriendRequestModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useUser();
    const { socket } = useSocket();
    const [email, setEmail] = useState("");
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
    const [activeTab, setActiveTab] = useState<"send" | "incoming" | "sent">("send");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            fetchIncomingRequests();
            fetchSentRequests();
        }
    }, [isOpen, user]);

    const fetchIncomingRequests = async () => {
        if (!user) return;

        const { data } = await supabase
            .from("friend_requests")
            .select("*")
            .eq("receiver_id", user.id)
            .eq("status", "pending");

        if (data) {
            // Fetch sender details
            const requestsWithSenders = await Promise.all(
                data.map(async (req) => {
                    const { data: sender } = await supabase
                        .from("users")
                        .select("*")
                        .eq("clerk_id", req.sender_id)
                        .single();
                    return { ...req, sender };
                })
            );
            setIncomingRequests(requestsWithSenders);
        }
    };

    const fetchSentRequests = async () => {
        if (!user) return;

        const { data } = await supabase
            .from("friend_requests")
            .select("*")
            .eq("sender_id", user.id)
            .eq("status", "pending");

        if (data) {
            setSentRequests(data);
        }
    };

    const sendFriendRequest = async () => {
        if (!email.trim() || !user) return;
        setLoading(true);

        try {
            // Check if user exists with this email
            const { data: receiver } = await supabase
                .from("users")
                .select("*")
                .eq("email", email.trim())
                .single();

            if (!receiver) {
                toast.error("No user found with this email address");
                setLoading(false);
                return;
            }

            if (receiver.clerk_id === user.id) {
                toast.error("You cannot send a friend request to yourself");
                setLoading(false);
                return;
            }

            // Check if already friends
            const { data: existingFriendship } = await supabase
                .from("friends")
                .select("*")
                .or(`and(user1_id.eq.${user.id},user2_id.eq.${receiver.clerk_id}),and(user1_id.eq.${receiver.clerk_id},user2_id.eq.${user.id})`);

            if (existingFriendship && existingFriendship.length > 0) {
                toast.error("You are already friends with this user");
                setLoading(false);
                return;
            }

            // Check if request already sent
            const { data: existingRequest } = await supabase
                .from("friend_requests")
                .select("*")
                .eq("sender_id", user.id)
                .eq("receiver_email", email.trim())
                .eq("status", "pending");

            if (existingRequest && existingRequest.length > 0) {
                toast.error("Friend request already sent");
                setLoading(false);
                return;
            }

            // Send friend request
            const { data: request, error } = await supabase
                .from("friend_requests")
                .insert({
                    sender_id: user.id,
                    receiver_email: email.trim(),
                    receiver_id: receiver.clerk_id,
                    status: "pending"
                })
                .select()
                .single();

            if (error) throw error;

            // Emit socket event for real-time notification
            if (socket) {
                socket.emit("friend-request:send", {
                    requestId: request.id,
                    receiverId: receiver.clerk_id,
                    senderInfo: {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.primaryEmailAddress?.emailAddress,
                        profileImage: user.imageUrl
                    }
                });
            }

            setEmail("");
            fetchSentRequests();
            toast.success("Friend request sent!");
        } catch (error) {
            console.error("Error sending friend request:", error);
            toast.error("Failed to send friend request");
        } finally {
            setLoading(false);
        }
    };

    const acceptRequest = async (requestId: string, senderId: string) => {
        if (!user) return;

        try {
            // Update request status
            await supabase
                .from("friend_requests")
                .update({ status: "accepted", updated_at: new Date().toISOString() })
                .eq("id", requestId);

            // Create friendship
            await supabase
                .from("friends")
                .insert({
                    user1_id: user.id,
                    user2_id: senderId
                });

            // Emit socket event
            if (socket) {
                socket.emit("friend-request:accept", {
                    requestId,
                    userId: user.id,
                    friendId: senderId
                });
            }

            fetchIncomingRequests();
            toast.success("Friend request accepted!");
        } catch (error) {
            console.error("Error accepting request:", error);
            toast.error("Failed to accept request");
        }
    };

    const rejectRequest = async (requestId: string) => {
        try {
            await supabase
                .from("friend_requests")
                .update({ status: "rejected", updated_at: new Date().toISOString() })
                .eq("id", requestId);

            fetchIncomingRequests();
        } catch (error) {
            console.error("Error rejecting request:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Friend Requests</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-900">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        className={`flex-1 p-3 text-sm font-medium ${activeTab === "send" ? "border-b-2 border-[#25d366] text-[#25d366]" : "text-gray-600"}`}
                        onClick={() => setActiveTab("send")}
                    >
                        Send Request
                    </button>
                    <button
                        className={`flex-1 p-3 text-sm font-medium relative ${activeTab === "incoming" ? "border-b-2 border-[#25d366] text-[#25d366]" : "text-gray-600"}`}
                        onClick={() => setActiveTab("incoming")}
                    >
                        Incoming
                        {incomingRequests.length > 0 && (
                            <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {incomingRequests.length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`flex-1 p-3 text-sm font-medium ${activeTab === "sent" ? "border-b-2 border-[#25d366] text-[#25d366]" : "text-gray-600"}`}
                        onClick={() => setActiveTab("sent")}
                    >
                        Sent
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === "send" && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Enter the email address of the user you want to add as a friend</p>
                            <input
                                type="email"
                                placeholder="friend@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:outline-none focus:border-[#25d366] text-gray-900"
                                onKeyDown={(e) => e.key === "Enter" && sendFriendRequest()}
                            />
                            <button
                                onClick={sendFriendRequest}
                                disabled={loading || !email.trim()}
                                className="w-full bg-[#25d366] text-white p-3 rounded-lg font-medium hover:bg-[#128c7e] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                {loading ? "Sending..." : "Send Friend Request"}
                            </button>
                        </div>
                    )}

                    {activeTab === "incoming" && (
                        <div className="space-y-3">
                            {incomingRequests.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No pending requests</p>
                            ) : (
                                incomingRequests.map((request) => (
                                    <div key={request.id} className="border rounded-lg p-3 flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
                                            {request.sender?.profile_image ? (
                                                <img src={request.sender.profile_image} alt={request.sender.first_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                                                    {request.sender?.first_name?.[0]}{request.sender?.last_name?.[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">
                                                {request.sender?.first_name} {request.sender?.last_name}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">{request.sender?.email}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => acceptRequest(request.id, request.sender_id)}
                                                className="p-2 bg-[#25d366] text-white rounded-full hover:bg-[#128c7e]"
                                                title="Accept"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => rejectRequest(request.id)}
                                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                title="Reject"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "sent" && (
                        <div className="space-y-3">
                            {sentRequests.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No pending requests</p>
                            ) : (
                                sentRequests.map((request) => (
                                    <div key={request.id} className="border rounded-lg p-3 flex items-center gap-3">
                                        <Clock className="w-5 h-5 text-gray-400" />
                                        <div className="flex-1">
                                            <div className="font-medium">{request.receiver_email}</div>
                                            <div className="text-xs text-gray-500">Pending</div>
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