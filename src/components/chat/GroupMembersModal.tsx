'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, X, Check, Search, Loader2, LogOut, Trash2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { UserSummary } from '@/types/chat';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatTime } from '@/lib/utils';

interface GroupMembersModalProps {
  conversationId: string;
  groupTitle: string;
  participants: UserSummary[];
  onlineUserIds: Set<string>;
  onClose: () => void;
  onParticipantsUpdated: (updated: UserSummary[]) => void;
}

export function GroupMembersModal({
  conversationId,
  groupTitle,
  participants,
  onlineUserIds,
  onClose,
  onParticipantsUpdated,
}: GroupMembersModalProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'members' | 'add'>('members');

  // Add members state
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const existingMemberIds = new Set(participants.map((p) => p.id));

  // Search available users not in the group
  useEffect(() => {
    if (activeTab !== 'add') return;

    const fetchUsers = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        // Filter out users already in this group
        const available = (data.users || []).filter((u: any) => !existingMemberIds.has(u.id));
        setAllUsers(available);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchUsers, 200);
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery]);

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleLeaveGroupInsideModal = async () => {
    if (!window.confirm(`Are you sure you want to leave "${groupTitle}"?`)) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/participants`, { method: 'DELETE' });
      if (res.ok) {
        onClose();
        useAuthStore.getState();
        window.location.reload();
      }
    } catch (err) {
      console.error('Error leaving group:', err);
    }
  };

  const handleDeleteGroupInsideModal = async () => {
    if (!window.confirm(`Are you sure you want to delete "${groupTitle}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      if (res.ok) {
        onClose();
        window.location.reload();
      }
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0 || isAdding) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      const data = await res.json();
      if (data.participants) {
        onParticipantsUpdated(data.participants);
        setSelectedUserIds([]);
        setActiveTab('members');
      }
    } catch (err) {
      console.error('Failed to add participants:', err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200 shadow-2xl w-full sm:max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-[#18181B] text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members ({participants.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'add'
                  ? 'bg-[#C08426] text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Members</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TAB 1: MEMBERS LIST */}
        {activeTab === 'members' && (
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-stone-50">
            <div className="px-2 py-1 mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              Group: {groupTitle}
            </div>
            <div className="space-y-1">
            {participants.map((p) => {
              const isOnline = onlineUserIds.has(p.id);
              const isMe = p.id === currentUser?.id;

              return (
                <div
                  key={p.id}
                  className="p-2.5 flex items-center justify-between rounded-2xl hover:bg-stone-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={p.avatarUrl} name={p.displayName} isOnline={isOnline} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-stone-900 truncate">
                          {p.displayName}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 truncate">@{p.username}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs">
                      {isOnline ? (
                        <span className="text-emerald-600 font-medium">● Online</span>
                      ) : (
                        <span className="text-stone-400">Offline</span>
                      )}
                    </div>
                    {p.lastReadAt && (
                      <div className="text-[10px] text-stone-400 font-mono" title="Last read timestamp">
                        Seen {formatTime(p.lastReadAt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            {/* Danger Zone Actions */}
            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                onClick={handleLeaveGroupInsideModal}
                className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Group</span>
              </button>
              <button
                onClick={handleDeleteGroupInsideModal}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Group</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ADD MEMBERS SEARCH & SELECT */}
        {activeTab === 'add' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-stone-100">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search people to add..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-full focus:outline-hidden focus:border-[#C08426]"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-stone-50">
              {isSearching ? (
                <div className="h-32 flex items-center justify-center text-xs text-stone-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C08426]" />
                  <span>Searching contacts...</span>
                </div>
              ) : allUsers.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-xs text-stone-400">
                  {searchQuery ? 'No matching contacts found' : 'All available contacts are already in this group'}
                </div>
              ) : (
                allUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);

                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelectUser(u.id)}
                      className="w-full p-2.5 flex items-center gap-3 hover:bg-[#F4EFE6] rounded-2xl transition-colors text-left"
                    >
                      <Avatar src={u.avatarUrl} name={u.displayName} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-stone-900 truncate">{u.displayName}</div>
                        <div className="text-xs text-stone-400 truncate">@{u.username}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-[#C08426] border-[#C08426] text-white' : 'border-stone-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-500 font-medium">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleAddMembers}
                disabled={selectedUserIds.length === 0 || isAdding}
                className="px-4 py-2 bg-[#C08426] hover:bg-[#A66F1C] disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                {isAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add to Group</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
