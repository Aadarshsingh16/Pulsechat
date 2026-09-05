'use client';

import React from 'react';

const STICKERS = [
  { id: 'party-popper', label: 'Party', emoji: '🎉' },
  { id: 'rocket', label: 'Launch', emoji: '🚀' },
  { id: 'heart-eyes', label: 'Love', emoji: '😍' },
  { id: 'fire', label: 'Fire', emoji: '🔥' },
  { id: 'mind-blown', label: 'Shocked', emoji: '🤯' },
  { id: 'thumbs-up', label: 'Approval', emoji: '👍' },
  { id: 'star', label: 'Superstar', emoji: '⭐' },
  { id: 'high-five', label: 'High Five', emoji: '🙌' },
];

interface StickerPickerProps {
  onSelect: (stickerId: string) => void;
  onClose: () => void;
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  return (
    <div className="p-3 bg-white rounded-2xl border border-stone-200 shadow-xl w-64">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 text-xs font-semibold uppercase tracking-wider text-stone-500">
        <span>Pulse Sticker Pack</span>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STICKERS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              onSelect(s.id);
              onClose();
            }}
            className="h-12 flex items-center justify-center rounded-xl text-2xl hover:bg-[#F4EFE6] transition-transform hover:scale-110"
            title={s.label}
          >
            {s.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
