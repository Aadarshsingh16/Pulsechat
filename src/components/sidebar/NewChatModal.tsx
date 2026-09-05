'use client';

import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Users, X, Loader2, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt: string;
}

interface NewChatModalProps {
  onClose: () => void;
  onSelectUser: (userId: string) => void;
  onCreateGroup?: (participantIds: string[], title: string) => void;
}

export function NewChatModal({ onClose, onSelectUser, onCreateGroup }: NewChatModalProps) {
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Group state
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const search = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroupSubmit = () => {
    if (!groupTitle.trim() || selectedIds.length === 0 || !onCreateGroup) return;
    onCreateGroup(selectedIds, groupTitle.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('direct')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                tab === 'direct' ? 'bg-[#18181B] text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Direct Chat</span>
            </button>
            <button
              onClick={() => setTab('group')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                tab === 'group' ? 'bg-[#C08426] text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>New Group (Bonus)</span>
            </button>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Group Name input if tab === 'group' */}
        {tab === 'group' && (
          <div className="p-3 bg-stone-50/70 border-b border-stone-100">
            <input
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name (e.g. Engineering Team)..."
              className="w-full px-3.5 py-1.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-hidden focus:border-[#C08426]"
              autoFocus
            />
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b border-stone-100">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-full focus:outline-hidden focus:border-[#C08426]"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-64 overflow-y-auto p-2 divide-y divide-stone-50">
          {loading ? (
            <div className="h-28 flex items-center justify-center text-xs text-stone-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#C08426]" />
              <span>Finding people...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-stone-400">
              No users found
            </div>
          ) : (
            users.map((u) => {
              const isSelected = selectedIds.includes(u.id);

              return (
                <button
                  key={u.id}
                  onClick={() => {
                    if (tab === 'direct') onSelectUser(u.id);
                    else toggleSelect(u.id);
                  }}
                  className="w-full p-2.5 flex items-center gap-3 hover:bg-[#F4EFE6] rounded-2xl transition-colors text-left"
                >
                  <Avatar src={u.avatarUrl} name={u.displayName} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">{u.displayName}</div>
                    <div className="text-xs text-stone-400 truncate">@{u.username}</div>
                  </div>
                  {tab === 'group' && (
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-[#C08426] border-[#C08426] text-white' : 'border-stone-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer for Group Creation */}
        {tab === 'group' && (
          <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
            <span className="text-xs text-stone-500 font-medium">
              {selectedIds.length} member{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleCreateGroupSubmit}
              disabled={!groupTitle.trim() || selectedIds.length === 0}
              className="px-4 py-2 bg-[#C08426] hover:bg-[#A66F1C] disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
            >
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
