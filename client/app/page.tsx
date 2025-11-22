"use client";

import { useState } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";

export default function Home() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            onSelectConversation={setSelectedConversationId}
            selectedConversationId={selectedConversationId}
          />
          <ChatWindow conversationId={selectedConversationId} />
        </div>
      </SignedIn>
    </>
  );
}
