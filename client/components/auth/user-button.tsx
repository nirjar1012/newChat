"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User as UserIcon, LogOut, Settings, Mail } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function UserButton() {
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Get current user
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            if (user) {
                fetchProfile(user.id);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        }

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMenu]);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        setProfile(data);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setShowMenu(false);
    };

    if (!user) return null;

    const displayName = profile?.first_name || profile?.last_name
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        : profile?.username || user.email?.split('@')[0] || 'User';

    // Get initials for avatar
    const initials = profile?.first_name && profile?.last_name
        ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
        : displayName.substring(0, 2).toUpperCase();

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 rounded-full bg-[#25d366] hover:bg-[#128c7e] flex items-center justify-center text-white font-bold transition-all hover:shadow-lg active:scale-95"
                title={displayName}
            >
                {profile?.profile_image ? (
                    <img
                        src={profile.profile_image}
                        alt={displayName}
                        className="w-full h-full rounded-full object-cover"
                    />
                ) : (
                    <span className="text-sm">{initials}</span>
                )}
            </button>

            {showMenu && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />

                    {/* Menu */}
                    <div className="absolute top-14 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 w-72 z-50 animate-in slide-in-from-top-2">
                        {/* User Info Section */}
                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-[#25d366] flex items-center justify-center text-white font-bold text-lg">
                                    {profile?.profile_image ? (
                                        <img
                                            src={profile.profile_image}
                                            alt={displayName}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span>{initials}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {user.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                            <button
                                onClick={handleSignOut}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-3 text-red-600 font-medium transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
