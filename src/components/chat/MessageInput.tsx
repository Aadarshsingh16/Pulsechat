'use client';

import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Smile, Film, AlertTriangle, X, FileImage, Loader2 } from 'lucide-react';
import { StickerPicker } from './StickerPicker';
import { GifPickerModal } from './GifPickerModal';
import { useChatStore } from '@/stores/useChatStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  socketRef: any;
  conversationId: string;
}

interface SelectedImageState {
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
}

export function MessageInput({ socketRef, conversationId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<SelectedImageState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const user = useAuthStore((s) => s.user);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);

  // Handle Typing Throttle
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);

    if (socketRef.current) {
      if (!typingTimeoutRef.current) {
        socketRef.current.emit('typing:start', { conversationId });
      } else {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit('typing:stop', { conversationId });
        }
        typingTimeoutRef.current = null;
      }, 3000);
    }
  };

  // Pre-Send Image File Picker Handler
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image exceeds 5MB upload limit');
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setUploadError('Allowed image formats: JPEG, PNG, WebP, GIF');
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setSelectedImage({
      file,
      previewUrl,
      name: file.name,
      sizeFormatted,
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelSelectedImage = () => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    setSelectedImage(null);
  };

  // Unified Message Dispatch (Text or Image with Caption)
  const handleSend = () => {
    if (!user) return;

    // A. Sending Selected Image with optional caption
    if (selectedImage) {
      const imageToSend = selectedImage;
      const caption = content.trim();
      const clientTempId = `temp-img-${Date.now()}`;

      // 1. Dispatch optimistic image message immediately so user sees thumbnail in chat stream
      const optimisticMessage = {
        id: clientTempId,
        clientTempId,
        conversationId,
        senderId: user.id,
        type: 'IMAGE' as const,
        content: caption || 'Sent an image',
        mediaUrl: imageToSend.previewUrl,
        status: 'SENDING' as const,
        isModerated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          lastSeenAt: user.lastSeenAt,
        },
      };

      addMessage(optimisticMessage);
      setContent('');
      setSelectedImage(null);
      setIsUploading(true);
      setUploadError(null);

      // 2. Perform upload and pre-visibility moderation
      const formData = new FormData();
      formData.append('file', imageToSend.file);
      formData.append('conversationId', conversationId);
      formData.append('clientTempId', clientTempId);
      if (caption) formData.append('content', caption);

      fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            updateMessageStatus(clientTempId, clientTempId, 'FAILED');
            setUploadError(data.details || data.error || 'Image rejected by moderation policy');
            setTimeout(() => setUploadError(null), 6000);
          } else if (data.success && data.message) {
            updateMessage(clientTempId, {
              id: data.message.id,
              mediaUrl: data.message.mediaUrl,
              status: data.message.status,
            });
          }
        })
        .catch((err) => {
          console.error('Upload network error:', err);
          updateMessageStatus(clientTempId, clientTempId, 'FAILED');
          setUploadError('Failed to upload image due to network error');
          setTimeout(() => setUploadError(null), 5000);
        })
        .finally(() => {
          setIsUploading(false);
        });

      return;
    }

    // B. Sending Plain Text Message
    const trimmed = content.trim();
    if (!trimmed) return;

    // Pre-Send Linguistic Profanity Inspection
    const profanityRegex = /\b(?:f+[\W_]*u+[\W_]*c+[\W_]*k+|s+[\W_]*h+[\W_]*i+[\W_]*t+|b+[\W_]*i+[\W_]*t+[\W_]*c+[\W_]*h+|b+[\W_]*a+[\W_]*s+[\W_]*t+[\W_]*a+[\W_]*r+[\W_]*d+|a+[\W_]*s+[\W_]*s+[\W_]*h+[\W_]*o+[\W_]*l+[\W_]*e+|d+[\W_]*a+[\W_]*m+[\W_]*n+|c+[\W_]*u+[\W_]*n+[\W_]*t+|w+[\W_]*h+[\W_]*o+[\W_]*r+[\W_]*e+)\b/i;
    if (profanityRegex.test(trimmed)) {
      setModerationError('Message contains disallowed profanity and cannot be sent');
      setTimeout(() => setModerationError(null), 4000);
      return;
    }

    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const optimisticMessage = {
      id: clientTempId,
      clientTempId,
      conversationId,
      senderId: user.id,
      type: 'TEXT' as const,
      content: trimmed,
      status: 'SENDING' as const,
      isModerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        lastSeenAt: user.lastSeenAt,
      },
    };

    addMessage(optimisticMessage);
    setContent('');

    if (socketRef.current) {
      socketRef.current.emit(
        'message:send',
        {
          conversationId,
          clientTempId,
          type: 'TEXT',
          content: trimmed,
        },
        (res: any) => {
          if (res?.success && res.message) {
            updateMessageStatus(clientTempId, res.message.id, res.message.status);
          } else {
            updateMessageStatus(clientTempId, clientTempId, 'FAILED');
          }
        }
      );
    }
  };

  const handleSendSticker = (stickerName: string) => {
    if (!user) return;
    const clientTempId = `temp-stk-${Date.now()}`;

    const optimisticMessage = {
      id: clientTempId,
      clientTempId,
      conversationId,
      senderId: user.id,
      type: 'STICKER' as const,
      content: stickerName,
      status: 'SENDING' as const,
      isModerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        lastSeenAt: user.lastSeenAt,
      },
    };

    addMessage(optimisticMessage);

    if (socketRef.current) {
      socketRef.current.emit(
        'message:send',
        {
          conversationId,
          clientTempId,
          type: 'STICKER',
          content: stickerName,
        },
        (res: any) => {
          if (res?.success && res.message) {
            updateMessageStatus(clientTempId, res.message.id, res.message.status);
          } else {
            updateMessageStatus(clientTempId, clientTempId, 'FAILED');
          }
        }
      );
    }
  };

  const handleSendGif = (gif: any) => {
    if (!user) return;
    const clientTempId = `temp-gif-${Date.now()}`;

    const optimisticMessage = {
      id: clientTempId,
      clientTempId,
      conversationId,
      senderId: user.id,
      type: 'GIF' as const,
      content: gif.title,
      mediaUrl: gif.url,
      status: 'SENDING' as const,
      isModerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        lastSeenAt: user.lastSeenAt,
      },
    };

    addMessage(optimisticMessage);

    if (socketRef.current) {
      socketRef.current.emit(
        'message:send',
        {
          conversationId,
          clientTempId,
          type: 'GIF',
          content: gif.title || 'GIF',
          mediaUrl: gif.url,
        } as any,
        (res: any) => {
          if (res?.success && res.message) {
            updateMessageStatus(clientTempId, res.message.id, res.message.status);
          } else {
            updateMessageStatus(clientTempId, clientTempId, 'FAILED');
          }
        }
      );
    }
  };

  return (
    <div className="relative p-2 sm:p-3 sm:px-5 bg-white/95 backdrop-blur-md border-t border-stone-200/80 select-none">
      {/* Moderation Rejection Error Toast */}
      {uploadError && (
        <div className="absolute -top-12 left-2 right-2 sm:left-4 sm:right-4 bg-red-50 border border-red-200 text-red-700 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md animate-bounce z-40">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="truncate">{uploadError}</span>
        </div>
      )}

      {/* Text Moderation Rejection Toast */}
      {moderationError && (
        <div className="absolute -top-12 left-2 right-2 sm:left-4 sm:right-4 bg-red-50 border border-red-300 text-red-800 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md animate-in fade-in duration-200 z-40">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-medium truncate">{moderationError}</span>
        </div>
      )}

      {/* Popovers */}
      {showStickers && (
        <div className="absolute bottom-16 left-2 sm:left-4 max-w-[calc(100vw-1rem)] z-40">
          <StickerPicker onSelect={handleSendSticker} onClose={() => setShowStickers(false)} />
        </div>
      )}

      {showGifs && (
        <div className="absolute bottom-16 left-2 sm:left-12 max-w-[calc(100vw-1rem)] z-40">
          <GifPickerModal onSelect={handleSendGif} onClose={() => setShowGifs(false)} />
        </div>
      )}

      {/* Pre-Send Image Preview Card (WhatsApp / Instagram DM Style) */}
      {selectedImage && (
        <div className="mb-2 p-2 sm:p-2.5 bg-[#FAF8F5] border border-stone-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-stone-200 shrink-0 bg-stone-100">
              <img
                src={selectedImage.previewUrl}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 truncate">
                <FileImage className="w-3.5 h-3.5 text-[#C08426] shrink-0" />
                <span className="truncate">{selectedImage.name}</span>
              </div>
              <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                {selectedImage.sizeFormatted} • Ready to send
              </div>
              <div className="text-[10px] text-[#C08426] font-medium mt-0.5">
                Add an optional caption below
              </div>
            </div>
          </div>
          <button
            onClick={handleCancelSelectedImage}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/70 rounded-full transition-colors shrink-0 cursor-pointer"
            title="Remove image"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Instagram/WhatsApp Dock */}
      <div className="flex items-center gap-1 sm:gap-1.5 bg-stone-100/80 border border-stone-200/90 rounded-full p-1 pl-2 transition-all focus-within:bg-white focus-within:border-[#C08426] focus-within:ring-2 focus-within:ring-[#C08426]/15">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageFileSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'p-1.5 rounded-full transition-colors shrink-0 cursor-pointer',
            selectedImage
              ? 'text-[#C08426] bg-[#F4EFE6]'
              : 'text-stone-400 hover:text-[#C08426] hover:bg-stone-200/50'
          )}
          title={selectedImage ? 'Change image' : 'Attach image'}
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setShowGifs(!showGifs);
            setShowStickers(false);
          }}
          className="p-1.5 text-stone-400 hover:text-[#C08426] hover:bg-stone-200/50 rounded-full transition-colors shrink-0 cursor-pointer"
          title="Send GIF"
        >
          <Film className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setShowStickers(!showStickers);
            setShowGifs(false);
          }}
          className="p-1.5 text-stone-400 hover:text-[#C08426] hover:bg-stone-200/50 rounded-full transition-colors shrink-0 cursor-pointer"
          title="Send Sticker"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Text / Caption Input with min-w-0 for narrow mobile screens */}
        <input
          type="text"
          value={content}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={selectedImage ? 'Add a caption... (optional)' : 'Message...'}
          className="flex-1 min-w-0 py-1.5 px-2 sm:px-2.5 text-xs sm:text-sm bg-transparent border-none focus:outline-hidden placeholder:text-stone-400"
        />

        {/* Dynamic Send Button (Instagram Style) */}
        <button
          onClick={handleSend}
          disabled={(!content.trim() && !selectedImage) || isUploading}
          className={cn(
            'p-2 rounded-full transition-all duration-150 shrink-0 flex items-center justify-center cursor-pointer',
            (content.trim() || selectedImage) && !isUploading
              ? 'bg-[#18181B] text-white hover:bg-[#C08426] active:scale-90 shadow-xs'
              : 'text-stone-300 cursor-not-allowed opacity-60'
          )}
          title={selectedImage ? 'Send image' : 'Send message'}
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
