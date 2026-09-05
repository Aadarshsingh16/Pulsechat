'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Avatar } from '../ui/Avatar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { GroupMembersModal } from './GroupMembersModal';
import { useChatStore } from '@/stores/useChatStore';
import { MessageSquare, Users, MoreVertical, LogOut, Trash2, ChevronLeft } from 'lucide-react';

interface ChatViewportProps {
  socketRef: any;
}

export function ChatViewport({ socketRef }: ChatViewportProps) {
  const {
    activeConversationId,
    setActiveConversationId,
    conversations,
    onlineUserIds,
    updateConversationParticipants,
    removeConversation,
  } = useChatStore();

  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const other = activeConv?.otherParticipant;
  const isOnline = other ? onlineUserIds.has(other.id) : false;

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeConversationId || !activeConv) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FAF8F5]">
        <div className="w-16 h-16 rounded-3xl bg-[#F4EFE6] border border-[#E8E2D5] flex items-center justify-center text-[#C08426] mb-4 shadow-sm">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-1">Select a conversation</h3>
        <p className="text-xs text-stone-500 max-w-sm">
          Pick a contact from the sidebar or click + to start a real-time conversation with typing indicators, GIF previews, and pre-screened media uploads.
        </p>
      </div>
    );
  }

  const participantsList = activeConv.participants || [];

  // Leave Group Handler
  const handleLeaveGroup = async () => {
    if (!window.confirm(`Are you sure you want to leave "${activeConv.title || 'this group'}"?`)) return;
    setIsProcessing(true);
    setShowOptionsMenu(false);
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}/participants`, {
        method: 'DELETE',
      });
      if (res.ok) {
        removeConversation(activeConversationId);
      } else {
        alert('Failed to leave group');
      }
    } catch (err) {
      console.error('Error leaving group:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Conversation / Group Handler
  const handleDeleteChat = async () => {
    const label = activeConv.isGroup ? 'group' : 'conversation';
    if (!window.confirm(`Are you sure you want to delete this ${label}? All messages will be permanently removed.`)) return;
    setIsProcessing(true);
    setShowOptionsMenu(false);
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        removeConversation(activeConversationId);
      } else {
        alert(`Failed to delete ${label}`);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F5] relative">
      {/* Chat Header */}
      <div className="p-3 sm:p-3.5 px-3 sm:px-5 bg-white/90 backdrop-blur-xs border-b border-stone-200/80 flex items-center justify-between select-none relative z-20">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile Back to Conversation List Button */}
          <button
            onClick={() => setActiveConversationId(null)}
            className="md:hidden p-1.5 -ml-1 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors flex-shrink-0"
            aria-label="Back to conversations"
            title="Back to conversations"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
            onClick={() => activeConv.isGroup && setShowMembersModal(true)}
            title={activeConv.isGroup ? 'Click to view group members' : undefined}
          >
            <Avatar
              src={activeConv.isGroup ? null : other?.avatarUrl}
              name={activeConv.isGroup ? (activeConv.title || 'Group') : (other?.displayName || 'User')}
              isOnline={activeConv.isGroup ? false : isOnline}
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-900 leading-tight flex items-center gap-1.5 group-hover:text-[#C08426] transition-colors truncate">
                <span className="truncate">{activeConv.isGroup ? (activeConv.title || 'Group Chat') : other?.displayName}</span>
                {activeConv.isGroup && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md font-semibold shrink-0">
                    Group
                  </span>
                )}
              </div>
            <div className="text-[11px] text-stone-400">
              {activeConv.isGroup ? (
                <span className="text-stone-500 font-medium">
                  {participantsList.length} members • Click to view
                </span>
              ) : isOnline ? (
                <span className="text-emerald-600 font-medium">● Active now</span>
              ) : (
                <span>Last seen recently</span>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Right Header Options */}
        <div className="flex items-center gap-2" ref={menuRef}>
          {activeConv.isGroup && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F4EFE6] border border-stone-200/80 rounded-full text-xs font-semibold text-stone-700 hover:text-[#C08426] transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Users className="w-3.5 h-3.5 text-[#C08426]" />
              <span>{participantsList.length} Members</span>
            </button>
          )}

          {/* Three-dot Options Menu */}
          <div className="relative">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              disabled={isProcessing}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showOptionsMenu && (
              <div className="absolute right-0 top-10 w-48 bg-white border border-stone-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-stone-100">
                {activeConv.isGroup ? (
                  <>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowOptionsMenu(false);
                          setShowMembersModal(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 rounded-xl flex items-center gap-2 transition-colors text-left"
                      >
                        <Users className="w-3.5 h-3.5 text-stone-500" />
                        <span>Group Members</span>
                      </button>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={handleLeaveGroup}
                        className="w-full px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-xl flex items-center gap-2 transition-colors text-left"
                      >
                        <LogOut className="w-3.5 h-3.5 text-amber-600" />
                        <span>Leave Group</span>
                      </button>
                      <button
                        onClick={handleDeleteChat}
                        className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Delete Group</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-1">
                    <button
                      onClick={handleDeleteChat}
                      className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      <span>Delete Chat</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <MessageList conversationId={activeConversationId} socketRef={socketRef} />

      {/* Input */}
      <MessageInput socketRef={socketRef} conversationId={activeConversationId} />

      {/* Group Members Modal */}
      {showMembersModal && activeConv.isGroup && (
        <GroupMembersModal
          conversationId={activeConversationId}
          groupTitle={activeConv.title || 'Group Chat'}
          participants={participantsList}
          onlineUserIds={onlineUserIds}
          onClose={() => setShowMembersModal(false)}
          onParticipantsUpdated={(updated) => updateConversationParticipants(activeConversationId, updated)}
        />
      )}
    </div>
  );
}
