'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { User, Lock, Eye, EyeOff, ChevronDown, ReceiptText, Loader2, ShieldCheck } from 'lucide-react';

interface AppUser {
  ID: string;
  NAME: string;
  ROLE: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('app_lpos_user');
    if (storedUser) {
      router.replace('/app_lpos_dashboard');
      return;
    }
    setIsCheckingSession(false);
    fetchUsers();
  }, [router]);

  async function fetchUsers() {
    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_USERS')
        .select('*');

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select your user profile');
      return;
    }
    if (!password) {
      setError('Please enter your access code');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const { data, error } = await app_lpos_supabase
        .from('app_lpos_USERS')
        .select('*')
        .eq('ID', selectedUser.ID)
        .eq('PASSWORD', password)
        .single();

      if (error || !data) {
        throw new Error('Incorrect password. Please try again.');
      }

      localStorage.setItem('app_lpos_user', JSON.stringify(data));
      router.push('/app_lpos_dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#D4AF37]/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-black/5 rounded-full blur-[120px] animate-pulse delay-700"></div>
        <div className="w-20 h-20 bg-black rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-black/20 animate-bounce">
          <ReceiptText className="w-10 h-10 text-[#D4AF37]" />
        </div>
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 md:p-6 font-sans overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#D4AF37]/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-black/5 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <div className="w-full max-w-[440px] relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-black rounded-[2rem] mb-6 shadow-2xl shadow-black/20 transform hover:rotate-3 transition-transform duration-500 group">
            <ReceiptText className="w-12 h-12 text-[#D4AF37] group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-5xl font-normal text-black tracking-tighter mb-2">BHS LPO'S</h1>
          <p className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.4em]">Administration Panel</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white relative overflow-hidden">
          {/* Progress Bar for Logging In */}
          {isLoggingIn && (
            <div className="absolute top-0 left-0 h-1 bg-[#D4AF37] animate-[shimmer_2s_infinite]"></div>
          )}

          <form onSubmit={handleLogin} className="space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                {error}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">NAME</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full flex items-center px-6 py-5 bg-gray-50/50 border rounded-[1.5rem] text-left transition-all duration-300 ${isDropdownOpen ? 'border-black ring-4 ring-black/5' : 'border-gray-100'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mr-4 transition-colors ${selectedUser ? 'bg-black text-[#D4AF37]' : 'bg-gray-100 text-gray-400'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <span className={`flex-1 font-bold text-sm ${!selectedUser ? 'text-gray-300' : 'text-black'}`}>
                    {isLoading ? 'Loading...' : (selectedUser?.NAME || 'Select User Profile')}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-500 ${isDropdownOpen ? 'rotate-180 text-black' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-3 bg-white border border-gray-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="max-h-64 overflow-y-auto no-scrollbar p-2">
                      {users.length === 0 ? (
                        <div className="px-6 py-8 text-gray-400 text-center font-bold italic">No active users found</div>
                      ) : (
                        users.map((user) => (
                          <button
                            key={user.ID}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full flex items-center px-4 py-4 hover:bg-gray-50 rounded-2xl transition-all group"
                          >
                            <div className="w-10 h-10 bg-gray-50 group-hover:bg-black rounded-xl flex items-center justify-center mr-4 transition-all group-hover:rotate-6">
                              <User className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37]" />
                            </div>
                            <div className="text-left">
                              <p className="font-black text-sm text-gray-700 group-hover:text-black">{user.NAME}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{user.ROLE}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] ml-1">PASSWORD</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                </div>
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Access Code"
                  className="w-full pl-14 pr-14 py-5 bg-gray-50/50 border border-gray-100 rounded-[1.5rem] focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all text-black font-bold placeholder:text-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute inset-y-0 right-0 pr-6 flex items-center text-gray-300 hover:text-black transition-colors"
                >
                  {isPasswordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-6 bg-black text-[#D4AF37] rounded-[1.5rem] font-black tracking-[0.2em] text-xs uppercase shadow-2xl shadow-black/20 hover:shadow-black/40 hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 mr-3" />
                  Enter Dashboard
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <p className="mt-12 text-center text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
          &copy; 2026 BHS LPO'S &bull; Secure Access Only
        </p>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
