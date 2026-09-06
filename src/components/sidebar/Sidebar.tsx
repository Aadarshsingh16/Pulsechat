'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, LogOut, CheckCheck, Trash2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { NewChatModal } from './NewChatModal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { ConversationSummary } from '@/types/chat';
import { formatTime, cn } from '@/lib/utils';

export function Sidebar() {
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { conversations, setConversations, activeConversationId, setActiveConversationId, onlineUserIds, isTypingMap } =
    useChatStore();

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleCreateGroup = async (participantIds: string[], title: string) => {
    setShowNewChat(false);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds, title }),
      });
      const data = await res.json();
      if (data.conversationId) {
        await loadConversations();
        setActiveConversationId(data.conversationId);
      }
    } catch (err) {
      console.error('Error creating group chat:', err);
    }
  };

  const handleDeleteSidebarChat = async (e: React.MouseEvent, conversationId: string, isGroup?: boolean) => {
    e.stopPropagation();
    const label = isGroup ? 'group' : 'chat';
    if (!window.confirm(`Delete this ${label}?`)) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      if (res.ok) {
        useChatStore.getState().removeConversation(conversationId);
      }
    } catch (err) {
      console.error('Error deleting chat from sidebar:', err);
    }
  };

  const handleStartChat = async (recipientId: string) => {
    setShowNewChat(false);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId }),
      });
      const data = await res.json();
      if (data.conversationId) {
        await loadConversations();
        setActiveConversationId(data.conversationId);
      }
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  const filtered = conversations.filter((c) =>
    c.otherParticipant.displayName.toLowerCase().includes(search.toLowerCase()) ||
    c.otherParticipant.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-full md:w-96 h-full flex flex-col bg-white border-r border-stone-200/80 select-none">
      {/* User Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center gap-2.5">
          <Avatar src={user?.avatarUrl} name={user?.displayName || 'Me'} isOnline={true} />
          <div>
            <div className="text-sm font-semibold text-stone-900 leading-tight">{user?.displayName}</div>
            <div className="text-[11px] text-stone-400 font-mono">@{user?.username}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 text-stone-600 hover:text-[#C08426] hover:bg-[#F4EFE6] rounded-full transition-colors"
            title="Start new chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={logout}
            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-stone-100">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-stone-50 border border-stone-200/70 rounded-full focus:outline-hidden focus:border-[#C08426]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-stone-50">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-6 text-center text-stone-400">
            <MessageSquare className="w-8 h-8 text-stone-300 mb-2" />
            <p className="text-xs font-medium">No conversations yet</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="mt-3 text-xs font-semibold text-[#C08426] hover:underline"
            >
              + Start a new chat
            </button>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = activeConversationId === conv.id;
            const isOnline = onlineUserIds.has(conv.otherParticipant.id);

            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveConversationId(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveConversationId(conv.id);
                  }
                }}
                className={cn(
                  'w-full p-3.5 flex items-center gap-3 transition-colors text-left relative group cursor-pointer select-none',
                  isActive ? 'bg-[#F4EFE6] border-l-3 border-[#C08426]' : 'hover:bg-stone-50/80 border-l-3 border-transparent'
                )}
              >
                <Avatar
                  src={conv.otherParticipant.avatarUrl}
                  name={conv.otherParticipant.displayName}
                  isOnline={isOnline}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-stone-900 truncate">
                      {conv.otherParticipant.displayName}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-stone-400 font-mono">
                        {formatTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="truncate pr-2">
                      {isTypingMap[conv.id]?.isTyping ? (
                        <span className="text-[#C08426] font-semibold animate-pulse flex items-center gap-1">
                          <span>{isTypingMap[conv.id]?.username ? `${isTypingMap[conv.id]?.username} is typing...` : 'typing...'}</span>
                        </span>
                      ) : conv.lastMessage ? (
                        <span>
                          <span className="font-medium text-stone-600">
                            {conv.lastMessage.senderId === user?.id
                              ? 'You: '
                              : conv.isGroup && conv.lastMessage.sender
                              ? `${conv.lastMessage.sender.displayName || conv.lastMessage.sender.username}: `
                              : ''}
                          </span>
                          {conv.lastMessage.content}
                        </span>
                      ) : (
                        'No messages yet'
                      )}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-[#C08426] rounded-full shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSidebarChat(e, conv.id, conv.isGroup)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1 shrink-0"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onSelectUser={handleStartChat} onCreateGroup={handleCreateGroup} />
      )}
    </aside>
  );
}
