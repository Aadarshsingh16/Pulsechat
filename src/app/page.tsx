'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatViewport } from '@/components/chat/ChatViewport';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { useSocket } from '@/hooks/useSocket';
import { Loader2, MessageSquare } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, checkAuth } = useAuthStore();
  const { activeConversationId } = useChatStore();
  const socketRef = useSocket();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-editorial-pattern flex items-center justify-center">
        <div className="flex items-center gap-2 text-stone-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-[#C08426]" />
          <span>Starting PulseChat session...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen w-screen bg-editorial-pattern flex flex-col overflow-hidden">
      {/* Floating Pill Top Navigation Banner */}
      <header className="px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-stone-200/80 bg-white/70 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F4EFE6] border border-[#E8E2D5] flex items-center justify-center text-[#C08426]">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="font-bold text-stone-900 text-sm tracking-tight">
            Pulse<span className="text-[#C08426]">Chat</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-stone-400 font-mono uppercase tracking-wider hidden sm:inline">
            Real-time messaging
          </span>
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-emerald-50 text-emerald-700 font-medium rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] sm:text-xs">Live</span>
          </div>
        </div>
      </header>

      {/* Main App Surface (Responsive Single-Pane on Mobile, Split-Pane on Desktop) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Full width on mobile when no conversation is active; always 384px (md:w-96) on desktop */}
        <div
          className={`w-full md:w-96 md:flex-shrink-0 h-full ${
            activeConversationId ? 'hidden md:block' : 'block'
          }`}
        >
          <Sidebar />
        </div>

        {/* Chat Viewport: Full width on mobile when active; hidden on mobile when viewing list */}
        <div
          className={`flex-1 min-w-0 h-full ${
            activeConversationId ? 'block' : 'hidden md:block'
          }`}
        >
          <ChatViewport socketRef={socketRef} />
        </div>
      </div>
    </div>
  );
}
