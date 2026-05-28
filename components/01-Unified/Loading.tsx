import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'BHS Analysis', className = '' }: LoadingProps) => {
  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden ${className}`} dir="rtl">
      <div className="relative z-10 flex flex-col items-center gap-12 select-none">
        {/* Central Golden Glass Orb */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Inner Glowing Glass Circle */}
          <div className="w-54 h-54 rounded-full bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_20px_50px_rgba(9,79,43,0.12),inset_0_0_20px_white] flex items-center justify-center relative z-10 animate-[float_6s_ease-in-out_infinite]">
            <span className="text-7xl font-[1000] tracking-[-0.03em] bg-gradient-to-tr from-[#094F2B] via-[#D4AF37] to-[#111827] bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(9,79,43,0.15)]">
              BH
            </span>
          </div>

          {/* Elegant Outer Gold Track */}
          <div className="absolute inset-3 rounded-full border border-[#D4AF37]/15" />

          {/* Active Golden Spinner Arc */}
          <div className="absolute inset-3 rounded-full border border-transparent border-t-[#D4AF37] border-r-[#D4AF37] animate-[spin_3s_linear_infinite]" />

          {/* Active Green Spinner Arc (Inner, reverse rotation) */}
          <div className="absolute inset-7 rounded-full border-2 border-transparent border-b-[#094F2B]/50 border-l-[#094F2B]/50 animate-[spin_2s_linear_infinite_reverse]" />

          {/* Luxury Ambient Pulse Aura */}
          <div className="absolute inset-8 rounded-full bg-emerald-500/10 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" />
        </div>

        {/* Shimmering Typography and Status */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center text-center">
            {/* English Title */}
            <h2 className="text-[15px] font-[900] tracking-[0.55em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#111827] via-[#094F2B] to-[#D4AF37] bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite] pl-[0.55em]">
              BHS Analysis
            </h2>
          </div>

          {/* Luxury Linear Progress Indicator */}
          <div className="relative w-48 h-[3px] bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-[#094F2B] via-[#D4AF37] to-[#111827] rounded-full animate-[loading-bar_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.02); }
        }
        @keyframes shimmer {
          to { bg-position: 200% center; }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default Loading;
