'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Loader2, ArrowRight, Eye, EyeOff, Sparkles, ShieldCheck } from 'lucide-react';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import './Login.css';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    autoLoginIfSaved();
  }, []);

  const autoLoginIfSaved = async () => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      const savedPassword = localStorage.getItem('userPassword');
      if (savedUser && savedPassword) {
        const userData = JSON.parse(savedUser);
        if (userData?.name) {
          const result = await verifyUserCredentials(userData.name, savedPassword);
          if (result.success && result.user) {
            onLogin(result.user);
            localStorage.setItem('userPassword', savedPassword);
            return;
          }
          localStorage.removeItem('currentUser');
          localStorage.removeItem('userPassword');
        }
      }
    } catch {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userPassword');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter your account name');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyUserCredentials(trimmedUsername, password);
      if (result.success && result.user) {
        localStorage.setItem('userPassword', password);
        setTimeout(() => onLogin(result.user), 400);
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-scene min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-8" dir="ltr">
      <div className="login-aurora" />
      <div className="login-grid" />

      <div className="relative z-10 w-full max-w-[440px] login-enter">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-white border border-slate-200 shadow-lg mb-5 relative">
            <span className="text-2xl font-black tracking-tight bg-gradient-to-br from-[#f5e6a8] via-[#d4af37] to-[#a8861e] bg-clip-text text-transparent">
              BHS
            </span>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Sign in to access your workspace
          </p>
        </div>

        <div className="login-card relative rounded-3xl p-7 sm:p-8">

          <form className="relative space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 ml-1">
                Account
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="login-input w-full h-[52px] pl-11 rounded-2xl text-[15px] font-medium text-slate-800 placeholder-slate-400"
                  placeholder="Enter your account name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 ml-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="login-input w-full h-[52px] pl-11 pr-12 rounded-2xl text-[15px] font-medium text-slate-800 placeholder-slate-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-btn w-full h-[52px] mt-2 text-[15px] font-bold rounded-2xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="relative mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
            <span className="text-xs font-medium">Secure internal access</span>
          </div>
        </div>

      </div>
    </div>
  );
}
