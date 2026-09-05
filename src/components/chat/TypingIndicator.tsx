'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  username?: string;
}

export function TypingIndicator({ username }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-stone-500 bg-white/80 backdrop-blur-xs rounded-full border border-stone-200/60 shadow-2xs w-fit">
      <span>{username ? `${username} is typing` : 'Typing'}</span>
      <div className="flex items-center gap-1">
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full bg-[#C08426]"
        />
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full bg-[#C08426]"
        />
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4, ease: 'easeInOut' }}
          className="w-1.5 h-1.5 rounded-full bg-[#C08426]"
        />
      </div>
    </div>
  );
}
