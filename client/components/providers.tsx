"use client";

import { ClerkProvider, useUser } from "@clerk/nextjs";
import { SocketProvider } from "@/context/socket-context";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Toaster } from "react-hot-toast";

function UserSync() {
    const { user, isLoaded } = useUser();
    const syncAttemptedRef = useRef(false);

    useEffect(() => {
        // Only attempt sync once per mount when user is loaded
        if (isLoaded && user && !syncAttemptedRef.current) {
            syncAttemptedRef.current = true;
            syncUser();
        }

        // Reset ref when user changes
        if (!user) {
            syncAttemptedRef.current = false;
        }
    }, [user, isLoaded]);

    const syncUser = async () => {
        if (!user) return;

        try {
            // UPSERT: Insert if not exists, Update if exists (idempotent)
            const { error } = await supabase
                .from("users")
                .upsert(
                    {
                        clerk_id: user.id,
                        username: user.username || user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "User",
                        first_name: user.firstName || "",
                        last_name: user.lastName || "",
                        email: user.primaryEmailAddress?.emailAddress || "",
                        profile_image: user.imageUrl || "",
                        online_status: 'online',
                        last_seen: new Date().toISOString(),
                    },
                    {
                        onConflict: 'clerk_id',  // Specify conflict resolution on clerk_id
                        ignoreDuplicates: false  // Always update on conflict
                    }
                );

            if (error) {
                // Only log critical errors, suppress expected conflicts
                "use client";

                import { ClerkProvider, useUser } from "@clerk/nextjs";
                import { SocketProvider } from "@/context/socket-context";
                import { useEffect, useRef } from "react";
                import { supabase } from "@/lib/supabase";
                import { Toaster } from "react-hot-toast";

                function UserSync() {
                    const { user, isLoaded } = useUser();
                    const syncAttemptedRef = useRef(false);

                    useEffect(() => {
                        // Only attempt sync once per mount when user is loaded
                        if (isLoaded && user && !syncAttemptedRef.current) {
                            syncAttemptedRef.current = true;
                            syncUser();
                        }

                        // Reset ref when user changes
                        if (!user) {
                            syncAttemptedRef.current = false;
                        }
                    }, [user, isLoaded]);

                    const syncUser = async () => {
                        if (!user) return;

                        try {
                            // UPSERT: Insert if not exists, Update if exists (idempotent)
                            const { error } = await supabase
                                .from("users")
                                .upsert(
                                    {
                                        clerk_id: user.id,
                                        username: user.username || user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "User",
                                        first_name: user.firstName || "",
                                        last_name: user.lastName || "",
                                        email: user.primaryEmailAddress?.emailAddress || "",
                                        profile_image: user.imageUrl || "",
                                        online_status: 'online',
                                        last_seen: new Date().toISOString(),
                                    },
                                    {
                                        onConflict: 'clerk_id',  // Specify conflict resolution on clerk_id
                                        ignoreDuplicates: false  // Always update on conflict
                                    }
                                );

                            if (error) {
                                // Only log critical errors, suppress expected conflicts
                                if (error.code !== '23505') {  // 23505 = unique violation (shouldn't happen with upsert)
                                    console.warn("User sync warning:", error.message);
                                }
                            }
                        } catch (err) {
                            // Graceful error handling - don't crash the app
                            console.warn("User sync error:", err instanceof Error ? err.message : "Unknown error");
                            background: '#333',
                                color: '#fff',
                                        },
                        success: {
                            iconTheme: {
                                primary: '#25d366',
                                    secondary: '#fff',
                                            },
                        },
                    }
                }
                                />
                            </SocketProvider >
                        </ClerkProvider >
                    );
}
