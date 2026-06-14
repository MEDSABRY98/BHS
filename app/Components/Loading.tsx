import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

const Loading = ({ message = 'BHS Analysis', className = '', fullScreen = true }: LoadingProps) => {
  const positionClasses = fullScreen ? 'fixed inset-0 z-[9999]' : 'relative w-full h-full min-h-[400px] rounded-2xl z-10';

  return (
    <div className={`${positionClasses} flex flex-col items-center justify-center bg-white overflow-hidden ${className}`} dir="ltr">

      {/* Soft Ambient Light Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FAF5EA]/30 rounded-full blur-[130px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#EDF3F9]/40 rounded-full blur-[130px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />

        {/* Microscopic Grid Background */}
        <div className="absolute inset-0 opacity-[0.015] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
      </div>

      {/* Main Core Center Container */}
      <div className="relative z-10 flex flex-col items-center select-none animate-[fadeIn_0.8s_ease-out_forwards]">

        {/* Centered Brand Emblem Frame */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Subtle gold center glowing aura */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-tr from-[#D4AF37]/10 to-[#D4AF37]/0 blur-xl animate-pulse" style={{ animationDuration: '3s' }} />

          {/* Elegant Thin Circle Border */}
          <div className="absolute inset-4 rounded-full border-[0.5px] border-slate-200/50 pointer-events-none" />

          {/* BHS central logo mark */}
          <div className="text-4xl font-extralight tracking-widest text-[#D4AF37] opacity-80 select-none animate-pulse" style={{ animationDuration: '4s' }}>
            BHS
          </div>
        </div>

        {/* Minimal Quiet Typography and Progress Indicator */}
        <div className="mt-4 flex flex-col items-center">
          <h2 className="text-[11px] font-extrabold tracking-[0.70em] text-slate-500 uppercase pl-[0.70em] opacity-90">
            BHS Analysis
          </h2>

          {/* Subtle Center-Expanding 1px Progress Line */}
          <div className="relative w-20 h-[1px] bg-slate-100 rounded-full overflow-hidden mt-6">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-[#D4AF37]/50 rounded-full animate-[line-expand_2s_cubic-bezier(0.25,1,0.5,1)_infinite]" />
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes line-expand {
          0% {
            width: 0%;
            opacity: 0.1;
          }
          50% {
            width: 100%;
            opacity: 0.8;
          }
          100% {
            width: 100%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Loading;
