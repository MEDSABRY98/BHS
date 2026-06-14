'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Lock, ChevronDown, Check, Loader2, ArrowRight } from 'lucide-react';

import Loading from '@/app/Components/Loading';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [users, setUsers] = useState<{ name: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(true);
  const [openUserDropdown, setOpenUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = searchQuery.trim() === ''
    ? []
    : users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

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
          const response = await fetch('/DataBase/Users/api', {
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
      const response = await fetch('/DataBase/Users/api');
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
    
    let userToLogin = selectedUser;
    if (!userToLogin && searchQuery) {
      const exactMatch = users.find(u => u.name.toLowerCase() === searchQuery.trim().toLowerCase());
      if (exactMatch) {
        userToLogin = exactMatch.name;
      }
    }

    if (!userToLogin) {
      setError('Please select a valid user account');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/DataBase/Users/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userToLogin, password: password }),
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
    return <Loading message="Loading Accounts..." />;
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
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      setOpenUserDropdown(val.trim() !== '');
                      const match = users.find(u => u.name.toLowerCase() === val.trim().toLowerCase());
                      if (match) {
                        setSelectedUser(match.name);
                      } else {
                        setSelectedUser('');
                      }
                    }}
                    onFocus={() => {
                      if (searchQuery.trim() !== '') {
                        setOpenUserDropdown(true);
                      }
                    }}
                    placeholder="Type to search your account..."
                    className={`w-full h-14 pl-4 pr-12 bg-slate-50 border-2 rounded-xl text-base font-medium text-slate-900 placeholder-slate-400 transition-all duration-200 outline-none hover:border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 ${openUserDropdown && filteredUsers.length > 0 ? 'border-indigo-600 ring-4 ring-indigo-500/10' : 'border-slate-100'}`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedUser('');
                          setOpenUserDropdown(false);
                        }}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <User className="w-5 h-5 text-slate-400" />
                  </div>

                  {openUserDropdown && filteredUsers.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 space-y-1">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.name}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user.name);
                              setSearchQuery(user.name);
                              setOpenUserDropdown(false);
                            }}
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
