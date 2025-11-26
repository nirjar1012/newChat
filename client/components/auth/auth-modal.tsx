"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import { MessageSquare } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#128c7e] to-[#075e54] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-[#25d366] p-6 text-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <MessageSquare className="w-10 h-10 text-[#25d366]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome to Chat</h1>
                    <p className="text-white/90 text-sm">Connect with friends instantly</p>
                </div>

                {/* Auth Form */}
                <div className="p-8">
                    <Auth
                        supabaseClient={supabase}
                        appearance={{
                            theme: ThemeSupa,
                            variables: {
                                default: {
                                    colors: {
                                        brand: '#25d366',
                                        brandAccent: '#128c7e',
                                        brandButtonText: 'white',
                                        defaultButtonBackground: '#f0f2f5',
                                        defaultButtonBackgroundHover: '#e4e6eb',
                                        inputBackground: '#f0f2f5',
                                        inputBorder: 'transparent',
                                        inputBorderHover: '#25d366',
                                        inputBorderFocus: '#25d366',
                                    },
                                    space: {
                                        inputPadding: '12px',
                                        buttonPadding: '12px',
                                    },
                                    borderWidths: {
                                        buttonBorderWidth: '0px',
                                        inputBorderWidth: '2px',
                                    },
                                    radii: {
                                        borderRadiusButton: '8px',
                                        buttonBorderRadius: '8px',
                                        inputBorderRadius: '8px',
                                    },
                                }
                            },
                            className: {
                                container: 'space-y-4',
                                button: 'font-semibold',
                                input: 'text-gray-900',
                            }
                        }}
                        providers={[]}
                        redirectTo={typeof window !== 'undefined' ? window.location.origin : undefined}
                        view="sign_in"
                    />
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 text-center">
                    <p className="text-xs text-gray-600">
                        Secure messaging powered by Supabase
                    </p>
                </div>
            </div>
        </div>
    );
}
