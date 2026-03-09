import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'BHS Analysis', className = '' }: LoadingProps) => {
  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden ${className}`} dir="rtl">
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
          {/* Expanded Minimalist Progress Ring */}
          <div className="absolute -inset-3">
            <svg className="w-38 h-38 transform -rotate-90 ml-[-4px] mt-[-4px]">
              <circle
                cx="76"
                cy="76"
                r="72"
                fill="transparent"
                stroke="#F8FAFC"
                strokeWidth="2"
              />
              <circle
                cx="76"
                cy="76"
                r="72"
                fill="transparent"
                stroke="#4F46E5"
                strokeWidth="2"
                strokeDasharray="452"
                className="animate-[dash_2.5s_ease-in-out_infinite]"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Text Section */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-base font-black text-slate-900 tracking-[0.4em] uppercase opacity-90">BHS Analysis</h2>
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes dash {
          0% { stroke-dashoffset: 452; }
          50% { stroke-dashoffset: 120; transform: rotate(0); }
          100% { stroke-dashoffset: 452; transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Loading;
