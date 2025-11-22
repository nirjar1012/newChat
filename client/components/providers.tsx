"use client";

import { ClerkProvider, useUser } from "@clerk/nextjs";
import { SocketProvider } from "@/context/socket-context";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

function UserSync() {
    const { user, isLoaded } = useUser();

    useEffect(() => {
        if (isLoaded && user) {
            const syncUser = async () => {
                try {
                    // Check if user exists
                    const { data, error } = await supabase
                        .from("users")
                        .select("clerk_id")
                        .eq("clerk_id", user.id)
                        .single();

                    if (!data) {
                        // Insert user
                        const { error: insertError } = await supabase.from("users").insert({
                            clerk_id: user.id,
                            username: user.username || user.fullName || user.primaryEmailAddress?.emailAddress?.split("@")[0],
                            email: user.primaryEmailAddress?.emailAddress,
                            profile_image: user.imageUrl,
                        });

                        if (insertError) {
                            console.error("Error syncing user to Supabase:", JSON.stringify(insertError, null, 2));
                        } else {
                            console.log("User synced to Supabase");
                        }
                    }
                } catch (err) {
                    console.error("Error in user sync:", err);
                }
            };

            syncUser();
        }
    }, [user, isLoaded]);

    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider>
            <SocketProvider>
                <UserSync />
                {children}
            </SocketProvider>
        </ClerkProvider>
    );
}
