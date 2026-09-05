import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatDateDivider(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const SENDER_COLORS = [
  'text-[#C08426]', // Warm Amber
  'text-[#047857]', // Deep Emerald
  'text-[#4338CA]', // Indigo
  'text-[#B45309]', // Warm Bronze
  'text-[#BE123C]', // Crimson / Rose
  'text-[#0F766E]', // Teal
  'text-[#7C3AED]', // Violet
  'text-[#C2410C]', // Terracotta
];

export function getSenderColor(nameOrId: string): string {
  if (!nameOrId) return 'text-[#C08426]';
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = nameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SENDER_COLORS.length;
  return SENDER_COLORS[index];
}
