'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  isOnline?: boolean;
}

export function Avatar({ src, name, className, isOnline }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className={cn('relative inline-block select-none', className)}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs tracking-wider text-[#A66F1C] bg-[#F4EFE6] border border-[#E8E2D5] overflow-hidden shadow-xs">
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#FAF8F5]',
            isOnline ? 'bg-emerald-500' : 'bg-stone-300'
          )}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
