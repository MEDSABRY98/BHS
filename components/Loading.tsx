import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'BHS Analysis', className = '' }: LoadingProps) => {
  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50 overflow-hidden ${className}`} dir="rtl">
      {/* 
          ANIMATED MESH GRADIENT BACKGROUND 
          - Slow moving organic shapes for a premium, alive feel
      */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-indigo-200/40 rounded-full blur-[140px] animate-[float_15s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-blue-200/40 rounded-full blur-[140px] animate-[float_12s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-purple-100/30 rounded-full blur-[120px] animate-[float_18s_linear_infinite]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-16">
        {/* 
            CENTRAL GLASS CORE 
            - Using glassmorphism for the logo container
        */}
        <div className="relative group scale-125">
          {/* Inner Glass Box */}
          <div className="w-32 h-32 rounded-[2.8rem] bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_32px_80px_rgba(0,0,0,0.06),inset_0_0_20px_white] flex items-center justify-center relative z-10">
            <span className="text-5xl font-[950] text-slate-900 tracking-[-0.05em] drop-shadow-sm">BH</span>
          </div>

          {/* DUAL MAGNETIC AURA - Two rings pulsing at different speeds */}
          <div className="absolute -inset-6 z-0">
            {/* Outer Ring - Slow & Subtle */}
            <div className="absolute inset-0 rounded-full border-[1px] border-indigo-100/50 animate-[breathe_4s_ease-in-out_infinite]" />

            {/* Inner Ring - Primary Accent with Glow */}
            <div className="absolute inset-2 rounded-full border-[2.5px] border-indigo-500/30 animate-[breathe_3s_ease-in-out_infinite_0.5s]">
              <div className="absolute inset-[-2px] rounded-full border-[2.5px] border-indigo-500 blur-[8px] opacity-10" />
            </div>
          </div>
        </div>

        {/* 
            DYNAMIC TEXT SECTION 
            - Shimmering text instead of simple dots
        */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <h2 className="text-[14px] font-[900] text-slate-900 tracking-[0.6em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-600 to-slate-900 bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
              BHS Analysis
            </h2>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="w-1.5 h-1.5 bg-indigo-600/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 bg-indigo-600/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 bg-indigo-600/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(4%, 6%) scale(1.1); }
          66% { transform: translate(-5%, 8%) scale(0.95); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(0.96); opacity: 0.2; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes shimmer {
          to { bg-position: 200% center; }
        }
      `}</style>
    </div>
  );
};

export default Loading;
