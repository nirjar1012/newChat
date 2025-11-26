"use client";

import { SocketProvider } from "@/context/socket-context";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Toaster } from "react-hot-toast";
import { AuthModal } from "@/components/auth/auth-modal";
import type { User } from "@supabase/supabase-js";

function UserSync() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Get initial user
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUser(user);
                syncUser(user);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                await syncUser(currentUser);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const syncUser = async (authUser: User) => {
        try {
            // Check if user profile exists
            const { data: existingUser } = await supabase
                .from("users")
                .select("*")
                .eq("id", authUser.id)
                .maybeSingle();

            if (!existingUser) {
                // Create new user profile
                const { error } = await supabase
                    .from("users")
                    .upsert({
                        id: authUser.id,
                        email: authUser.email!,
                        first_name: authUser.user_metadata?.first_name || '',
                        last_name: authUser.user_metadata?.last_name || '',
                        username: authUser.email?.split('@')[0] || '',
                        profile_image: authUser.user_metadata?.avatar_url || '',
                    }, { onConflict: 'id', ignoreDuplicates: true });

                if (error) {
                    console.warn("Error creating user profile:", error.message);
                }
            }
        } catch (err) {
            console.warn("User sync error:", err instanceof Error ? err.message : "Unknown error");
        }
    };

    return null;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
            if (!session?.user) {
                setShowAuthModal(true);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setShowAuthModal(!session?.user);

            // Clean up URL after auth redirect
            if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#25d366] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <AuthModal isOpen={showAuthModal} onClose={() => { }} />
            {user && children}
        </>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthWrapper>
            <SocketProvider>
                <UserSync />
                {children}
                <Toaster
                    position="top-center"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#333',
                            color: '#fff',
                        },
                        success: {
                            iconTheme: {
                                primary: '#25d366',
                                secondary: '#fff',
                            },
                        },
                    }}
                />
            </SocketProvider>
        </AuthWrapper>
    );
}
