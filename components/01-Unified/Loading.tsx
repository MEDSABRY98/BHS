import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'BHS Analysis', className = '' }: LoadingProps) => {
  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden ${className}`} dir="rtl">
      {/* Premium Ambient Background Blobs */}
      <div className="absolute inset-0 z-0 opacity-80">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-[#D4AF37]/8 rounded-full blur-[140px] animate-[float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-indigo-100/40 rounded-full blur-[160px] animate-[float_16s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[30%] right-[15%] w-[40%] h-[40%] bg-purple-100/30 rounded-full blur-[130px] animate-[float_22s_linear_infinite]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12 select-none">
        {/* Central Golden Glass Orb */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Inner Glowing Glass Circle */}
          <div className="w-54 h-54 rounded-full bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_20px_50px_rgba(212,175,55,0.12),inset_0_0_20px_white] flex items-center justify-center relative z-10 animate-[float_6s_ease-in-out_infinite]">
            <span className="text-7xl font-[1000] tracking-[-0.03em] bg-gradient-to-tr from-[#A67C1E] via-[#D4AF37] to-[#FFF3B3] bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(212,175,55,0.15)]">
              BH
            </span>
          </div>

          {/* Rotating Dashed Orbit Ring */}
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-[#D4AF37]/25 animate-[spin_25s_linear_infinite]" />

          {/* Solid Glow Outer Ring */}
          <div className="absolute inset-0 rounded-full border border-[#D4AF37]/15 scale-95" />

          {/* Orbiting Particle */}
          <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#FFF3B3] shadow-[0_0_15px_#D4AF37]" />
          </div>
        </div>

        {/* Shimmering Typography and Status */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center text-center">
            {/* English Title */}
            <h2 className="text-[15px] font-[900] tracking-[0.55em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite] pl-[0.55em]">
              BHS Analysis
            </h2>
          </div>

          {/* Luxury Linear Progress Indicator */}
          <div className="relative w-48 h-[3px] bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-[#D4AF37] to-[#D4AF37] rounded-full animate-[loading-bar_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
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
