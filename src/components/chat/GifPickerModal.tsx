'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface GifItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

interface GifPickerModalProps {
  onSelect: (gif: GifItem) => void;
  onClose: () => void;
}

export function GifPickerModal({ onSelect, onClose }: GifPickerModalProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchGifs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gifs?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setGifs(data.gifs || []);
      } catch (err) {
        console.error('Failed to load GIFs:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchGifs, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="p-3 bg-white rounded-2xl border border-stone-200 shadow-xl w-80">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 text-xs font-semibold uppercase tracking-wider text-stone-500">
        <span>Search GIFs</span>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
      </div>

      <div className="relative mb-3">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trending GIFs..."
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-[#C08426]"
          autoFocus
        />
      </div>

      <div className="h-60 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
        {loading ? (
          <div className="col-span-2 h-40 flex items-center justify-center text-xs text-stone-400 gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin text-[#C08426]" />
            <span>Finding GIFs...</span>
          </div>
        ) : (
          gifs.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                onSelect(g);
                onClose();
              }}
              className="group relative rounded-lg overflow-hidden border border-stone-100 hover:border-[#C08426] transition-all"
            >
              <img src={g.previewUrl} alt={g.title} className="w-full h-24 object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-end p-1 text-[10px] text-white font-medium transition-opacity">
                {g.title}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
