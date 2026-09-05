'use client';

import React, { useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { MessagePayload, MessageStatus, UserSummary } from '@/types/chat';
import { formatTime, cn, getSenderColor } from '@/lib/utils';

interface MessageBubbleProps {
  message: MessagePayload;
  isCurrentUser: boolean;
  isGroup?: boolean;
  participants?: UserSummary[];
  onRetry?: (message: MessagePayload) => void;
}

export function MessageBubble({
  message,
  isCurrentUser,
  isGroup,
  participants = [],
  onRetry,
}: MessageBubbleProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);

  // In groups, determine which other participants have seen this message
  const readByMembers = isGroup && isCurrentUser
    ? participants.filter((p) => {
        if (p.id === message.senderId) return false;
        if (!p.lastReadAt) return false;
        return new Date(p.lastReadAt).getTime() >= new Date(message.createdAt).getTime();
      })
    : [];

  const renderStatus = (status: MessageStatus) => {
    switch (status) {
      case 'SENDING':
        return (
          <span className="flex items-center gap-0.5 text-stone-300" title="Sending...">
            <Clock className="w-2.5 h-2.5 animate-spin" />
          </span>
        );
      case 'SENT':
        return (
          <span className="flex items-center gap-0.5 text-stone-300" title="Sent to server">
            <Check className="w-3 h-3" />
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="flex items-center gap-0.5 text-stone-300" title="Delivered to recipient">
            <CheckCheck className="w-3.5 h-3.5" />
          </span>
        );
      case 'READ':
        return (
          <span
            className="flex items-center gap-0.5 text-[#F59E0B]"
            title={
              readByMembers.length > 0
                ? `Seen by ${readByMembers.map((m) => m.displayName).join(', ')}`
                : 'Read by recipient'
            }
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
            {readByMembers.length > 1 && (
              <span className="text-[8px] font-mono font-bold leading-none">{readByMembers.length}</span>
            )}
          </span>
        );
      case 'FAILED':
        if (message.isModerated) {
          return (
            <span
              className="flex items-center gap-0.5 text-red-400 font-semibold"
              title={message.moderationReason || 'Blocked by server moderation policy'}
            >
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-[8px] uppercase tracking-wider">Blocked</span>
            </span>
          );
        }
        return (
          <button
            onClick={() => onRetry && onRetry(message)}
            className="flex items-center gap-0.5 text-red-400 hover:text-red-300 hover:underline cursor-pointer"
            title="Failed to deliver. Click to retry"
          >
            <AlertCircle className="w-3 h-3" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Retry</span>
          </button>
        );
      default:
        return null;
    }
  };

  const fullDateTooltip = new Date(message.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const senderNameColor = message.sender
    ? getSenderColor(message.sender.displayName || message.sender.id)
    : 'text-[#C08426]';

  return (
    <div
      className={cn(
        'group flex flex-col mb-2 max-w-[82%] sm:max-w-[74%] transition-all duration-150 animate-in fade-in slide-in-from-bottom-1',
        isCurrentUser ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {/* Sender display name for group chat incoming messages */}
      {!isCurrentUser && isGroup && message.sender && (
        <div className="flex items-center gap-1.5 mb-1 px-2">
          <span className={cn('text-[11px] font-bold tracking-tight', senderNameColor)}>
            {message.sender.displayName || message.sender.username}
          </span>
        </div>
      )}

      {/* Moderation Flag Notice */}
      {message.isModerated && (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 mb-1 text-[10px] font-semibold text-amber-800 bg-amber-50/90 border border-amber-300/80 rounded-full shadow-2xs">
          <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{message.moderationReason || 'Content moderated by server policy'}</span>
        </div>
      )}

      {/* Message Card Container with Asymmetrical WhatsApp/Insta Tail */}
      <div
        className={cn(
          'relative px-3.5 py-2 text-[13.5px] leading-relaxed transition-all shadow-xs select-text',
          isCurrentUser
            ? 'bg-[#18181B] text-white rounded-2xl rounded-tr-xs'
            : 'bg-white text-stone-900 border border-stone-200/80 rounded-2xl rounded-tl-xs'
        )}
      >
        {/* TEXT */}
        {message.type === 'TEXT' && (
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="whitespace-pre-wrap font-normal break-words">{message.content}</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] select-none font-mono ml-auto self-end shrink-0 pt-0.5',
                isCurrentUser ? 'text-stone-400' : 'text-stone-400'
              )}
            >
              <span title={fullDateTooltip} className="hover:text-stone-300 cursor-default">
                {formatTime(message.createdAt)}
              </span>
              {isCurrentUser && <span className="inline-flex items-center">{renderStatus(message.status)}</span>}
            </span>
          </div>
        )}

        {/* IMAGE */}
        {message.type === 'IMAGE' && message.mediaUrl && (
          <div
            className="relative rounded-xl overflow-hidden cursor-pointer mb-1"
            onClick={() => !imageError && setZoomImage(true)}
          >
            {/* Loading Skeleton */}
            {!imageLoaded && !imageError && (
              <div className="w-60 h-44 bg-stone-800/80 animate-pulse rounded-xl flex flex-col items-center justify-center gap-2 text-xs text-stone-400">
                <Loader2 className="w-5 h-5 animate-spin text-[#C08426]" />
                <span>Loading image...</span>
              </div>
            )}

            {/* Error Fallback */}
            {imageError && (
              <div className="w-60 h-40 bg-stone-900/90 border border-stone-800 rounded-xl flex flex-col items-center justify-center gap-1.5 p-3 text-center text-xs text-stone-400">
                <AlertCircle className="w-6 h-6 text-red-400 mb-1" />
                <span className="font-semibold text-stone-300">Unable to load image</span>
                <span className="text-[10px] text-stone-500 font-mono truncate max-w-[200px]">Network or format issue</span>
              </div>
            )}

            {/* True Image Element (Visible to browser layout engine to prevent lazyload deadlock) */}
            <img
              src={message.mediaUrl}
              alt={message.content || 'Shared image'}
              decoding="async"
              onLoad={() => {
                setImageLoaded(true);
                setImageError(false);
              }}
              onError={() => {
                setImageError(true);
                setImageLoaded(false);
              }}
              className={cn(
                'max-w-[220px] sm:max-w-xs max-h-72 object-cover rounded-xl transition-opacity duration-300 hover:scale-[1.015]',
                imageLoaded && !imageError ? 'opacity-100 block' : 'opacity-0 absolute pointer-events-none'
              )}
            />

            {/* Optional Caption */}
            {message.content && message.content !== 'Sent an image' && (
              <p className="text-[13px] mt-1.5 px-0.5 text-stone-100 whitespace-pre-wrap break-words leading-snug">
                {message.content}
              </p>
            )}

            {/* Overlay timestamp for media */}
            <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[10px] text-stone-400 font-mono">
              <span title={fullDateTooltip}>{formatTime(message.createdAt)}</span>
              {isCurrentUser && renderStatus(message.status)}
            </div>
          </div>
        )}

        {/* GIF */}
        {message.type === 'GIF' && message.mediaUrl && (
          <div className="rounded-xl overflow-hidden mb-1">
            <img
              src={message.mediaUrl}
              alt="GIF"
              loading="lazy"
              decoding="async"
              className="max-w-[220px] sm:max-w-xs max-h-64 object-cover rounded-xl"
            />
            <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-stone-400 font-mono">
              <span title={fullDateTooltip}>{formatTime(message.createdAt)}</span>
              {isCurrentUser && renderStatus(message.status)}
            </div>
          </div>
        )}

        {/* STICKER */}
        {message.type === 'STICKER' && (
          <div className="p-1 flex flex-col items-center justify-center">
            <span className="text-5xl filter drop-shadow-sm transition-transform hover:scale-110 active:scale-95 duration-150">
              {message.content === 'party-popper' ? '🎉' :
               message.content === 'rocket' ? '🚀' :
               message.content === 'heart-eyes' ? '😍' :
               message.content === 'fire' ? '🔥' :
               message.content === 'mind-blown' ? '🤯' :
               message.content === 'thumbs-up' ? '👍' :
               message.content === 'star' ? '⭐' : '🙌'}
            </span>
            <div className="flex items-center justify-end w-full gap-1.5 mt-1 text-[10px] text-stone-400 font-mono">
              <span title={fullDateTooltip}>{formatTime(message.createdAt)}</span>
              {isCurrentUser && renderStatus(message.status)}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Zoom (Instagram style) */}
      {zoomImage && message.mediaUrl && !imageError && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomImage(false)}
        >
          <img
            src={message.mediaUrl}
            alt="Enlarged"
            className="max-w-full max-h-[92vh] rounded-2xl shadow-2xl object-contain animate-in zoom-in-95 duration-150"
          />
        </div>
      )}
    </div>
  );
}
