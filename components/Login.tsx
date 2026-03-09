'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Lock, ChevronDown, Check, Loader2, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [users, setUsers] = useState<{ name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(true);
  const [openUserDropdown, setOpenUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setOpenUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchUsers();
    autoLoginIfSaved();
  }, []);

  const autoLoginIfSaved = async () => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      const savedPassword = localStorage.getItem('userPassword');
      if (savedUser && savedPassword) {
        const userData = JSON.parse(savedUser);
        if (userData?.name) {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: userData.name, password: savedPassword }),
          });
          const result = await response.json();
          if (response.ok && result.success) {
            onLogin(result.user);
            localStorage.setItem('userPassword', savedPassword);
            return;
          }
          else {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userPassword');
          }
        }
      }
    } catch (err) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userPassword');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setFetchingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedUser) {
      setError('Please select a user account');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedUser, password: password }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        localStorage.setItem('userPassword', password);
        setTimeout(() => onLogin(result.user), 500);
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden relative" dir="rtl">
        {/* Soft Modern Background Decor - Subtle & Premium */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-50/50 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-14">
          {/* Larger Logo Container - Premium & Strong */}
          <div className="relative group scale-110">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_30px_70px_rgba(0,0,0,0.08)] flex items-center justify-center animate-in zoom-in-95 fade-in duration-1000">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">BH</span>
            </div>
            {/* Premium Static Halo - Full Circle Pulsing */}
            <div className="absolute -inset-4">
              <svg className="w-40 h-40">
                <circle
                  cx="80"
                  cy="80"
                  r="76"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="1.5"
                  className="opacity-50"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="76"
                  fill="transparent"
                  stroke="#4F46E5"
                  strokeWidth="2.5"
                  className="animate-[breathe_3s_ease-in-out_infinite]"
                  style={{ filter: 'drop-shadow(0 0 12px rgba(79, 70, 229, 0.4))' }}
                />
              </svg>
            </div>
          </div>

          {/* Text Section */}
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-base font-black text-slate-900 tracking-[0.4em] uppercase opacity-90">BHS Analysis</h2>
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>

        <style jsx>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.3; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-white overflow-hidden" dir="ltr">

      {/* Left Side: Brand / Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0f172a] items-center justify-center overflow-hidden">
        {/* Abstract geometric shapes */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 text-center px-12">
          <div className="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
            <span className="text-4xl font-extrabold text-white tracking-tighter">BH</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
            Financial <span className="text-blue-400">Excellence</span> <br /> redefined.
          </h1>
        </div>

        <div className="absolute bottom-10 left-0 w-full text-center">
          <p className="text-slate-600 text-sm font-medium">© {new Date().getFullYear()} BH Group. All rights reserved.</p>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24 bg-white relative">
        <div className="w-full max-w-md space-y-10">

          <div className="text-center lg:text-left">
            <div className="lg:hidden mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 shadow-lg">
              <span className="text-2xl font-bold text-white tracking-tighter">BH</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h2>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Account Selection */}
              <div ref={userDropdownRef} className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">Account</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenUserDropdown(!openUserDropdown)}
                    className={`w-full h-14 px-4 bg-slate-50 border-2 rounded-xl flex items-center justify-between transition-all duration-200 outline-none hover:border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 ${openUserDropdown ? 'border-indigo-600 ring-4 ring-indigo-500/10' : 'border-slate-100'}`}
                  >
                    <span className={`text-base font-medium ${selectedUser ? 'text-slate-900' : 'text-slate-400'}`}>
                      {selectedUser || 'Select your account'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${openUserDropdown ? 'rotate-180 text-indigo-600' : ''}`} />
                  </button>

                  {openUserDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 space-y-1">
                        {users.map((user) => (
                          <button
                            key={user.name}
                            type="button"
                            onClick={() => { setSelectedUser(user.name); setOpenUserDropdown(false); }}
                            className={`w-full px-4 py-3.5 rounded-lg flex items-center justify-between text-base transition-colors ${selectedUser === user.name ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedUser === user.name ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              {user.name}
                            </div>
                            {selectedUser === user.name && <Check className="w-5 h-5 text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full h-14 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 outline-none text-base font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold rounded-xl transition-all duration-200 shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

          <div className="pt-8 border-t border-slate-100 text-center lg:text-left">
            <p className="text-slate-500 font-medium mb-1">Having trouble accessing?</p>
            <p className="text-lg font-bold text-slate-900">Contact Mohamed Sabry</p>
          </div>
        </div>
      </div>
    </div>
  );
}
