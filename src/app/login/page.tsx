'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ArrowRight, Sparkles, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        router.push('/');
      }
    } catch {
      setError('Network error during login');
    } finally {
      setLoading(false);
    }
  };

  // Quick Seed Credentials Filler
  const fillCredentials = (email: string) => {
    setIdentifier(email);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-editorial-pattern flex flex-col items-center justify-center p-4">
      {/* Editorial Floating Pill Header */}
      <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#E8E2D5] shadow-xs text-xs font-semibold text-stone-700">
        <span className="text-[#C08426]">01 — AUTHENTICATION</span>
        <span className="text-stone-300">•</span>
        <span>Secure HttpOnly JWT</span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E8E2D5] shadow-xl p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#F4EFE6] border border-[#E8E2D5] flex items-center justify-center text-[#C08426]">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Sign in to PulseChat</h1>
            <p className="text-xs text-stone-500">Real-time 1-on-1 messaging platform</p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Email or Username
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. alice@pulsechat.io or alice"
              required
              className="w-full px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-[#C08426] focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-[#C08426] focus:bg-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#18181B] hover:bg-[#C08426] text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>{loading ? 'Authenticating...' : 'Continue to Chat'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Test Accounts (Alice & Bob for Two-Window Testing) */}
        <div className="mt-6 pt-5 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C08426]" />
            <span>One-Click Test Accounts</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('alice@pulsechat.io')}
              className="p-2.5 bg-stone-50 hover:bg-[#F4EFE6] border border-stone-200 rounded-xl text-left transition-colors"
            >
              <div className="text-xs font-bold text-stone-900">Alice Cooper</div>
              <div className="text-[10px] text-stone-500 truncate">Browser 1 (Tab A)</div>
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('bob@pulsechat.io')}
              className="p-2.5 bg-stone-50 hover:bg-[#F4EFE6] border border-stone-200 rounded-xl text-left transition-colors"
            >
              <div className="text-xs font-bold text-stone-900">Bob Vance</div>
              <div className="text-[10px] text-stone-500 truncate">Incognito (Tab B)</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
