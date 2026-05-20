'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, CheckCircle2 } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  direction?: 'up' | 'down';
}

export default function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  isLoading = false,
  direction = 'down'
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.subLabel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2 relative" ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">
          {label}
        </label>
      )}

      <div
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        className={`group flex items-center justify-between px-6 h-[68px] bg-white border-2 ${isOpen ? 'border-black shadow-[0_0_20px_rgba(0,0,0,0.05)]' : 'border-gray-50'
          } rounded-[1.5rem] cursor-pointer transition-all hover:bg-gray-50/50 hover:border-gray-200 shadow-sm`}
      >
        <div className="flex flex-col justify-center min-w-0">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className="text-sm font-black text-black truncate tracking-tight">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-gray-400 font-bold uppercase truncate leading-none mt-1 tracking-wider">
                  {selectedOption.subLabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400 font-bold uppercase tracking-widest opacity-60">
              {isLoading ? 'Loading...' : placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {value && !isLoading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isOpen ? 'bg-black text-[#D4AF37]' : 'bg-gray-50 text-gray-400'}`}>
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className={`absolute ${direction === 'up' ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]'} left-0 right-0 bg-white border border-gray-100 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] overflow-hidden animate-in fade-in ${direction === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'} duration-300`}>
          <div className="p-4 bg-gray-50/50">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
              <input
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-12 pr-6 py-4 bg-white border-2 border-transparent focus:border-black/5 rounded-2xl outline-none transition-all text-sm font-black placeholder:text-gray-300 placeholder:font-bold"
              />
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto no-scrollbar py-3">
            {filteredOptions.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-gray-200" />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No matching results</p>
              </div>
            ) : (
              <div className="px-3 space-y-1 pb-2">
                {filteredOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`px-6 py-5 cursor-pointer rounded-[1.5rem] transition-all flex items-center gap-4 relative group ${value === opt.id
                      ? 'bg-black text-white shadow-2xl shadow-black/20'
                      : 'hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${value === opt.id ? 'bg-white/10 text-[#D4AF37]' : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:text-black'
                      }`}>
                      <div className="w-5 h-5 flex items-center justify-center font-black text-xs">
                        {opt.label.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm tracking-tight ${value === opt.id ? 'font-black text-[#D4AF37]' : 'font-black text-black group-hover:text-black'}`}>
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 ${value === opt.id ? 'text-gray-400' : 'text-gray-300 group-hover:text-gray-400'
                          }`}>
                          {opt.subLabel}
                        </span>
                      )}
                    </div>

                    {value === opt.id && (
                      <div className="absolute right-6 w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
