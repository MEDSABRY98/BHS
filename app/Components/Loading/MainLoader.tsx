import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

const MainLoader = ({ message = 'BHS Analysis', className = '', fullScreen = true }: LoadingProps) => {
  const positionClasses = fullScreen ? 'fixed inset-0 z-[9999]' : 'relative w-full h-full min-h-[400px] rounded-2xl z-10';

  return (
    <div className={`${positionClasses} flex flex-col items-center justify-center bg-white overflow-hidden ${className}`} dir="ltr">

      {/* Subtle background layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Very faint top-left warm glow */}
        <div
          className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)',
          }}
        />
        {/* Very faint bottom-right cool glow */}
        <div
          className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(100,116,139,0.05) 0%, transparent 70%)',
          }}
        />
        {/* Hairline dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            opacity: 0.25,
          }}
        />
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-10 select-none" style={{ animation: 'fadeSlideIn 0.7s ease-out forwards' }}>

        {/* Emblem ring + BHS */}
        <div className="relative w-36 h-36 flex items-center justify-center">

          {/* Outer thin static ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: '1px solid rgba(212,175,55,0.18)' }}
          />

          {/* Spinning arc */}
          <div
            className="absolute inset-[-6px] rounded-full"
            style={{
              border: '1.5px solid transparent',
              borderTopColor: 'rgba(212,175,55,0.7)',
              borderRightColor: 'rgba(212,175,55,0.2)',
              animation: 'spin 2.4s linear infinite',
            }}
          />

          {/* Counter-spinning faint arc */}
          <div
            className="absolute inset-[10px] rounded-full"
            style={{
              border: '1px solid transparent',
              borderBottomColor: 'rgba(100,116,139,0.25)',
              animation: 'spinReverse 4s linear infinite',
            }}
          />

          {/* BHS wordmark */}
          <span
            style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontSize: '1.45rem',
              fontWeight: 300,
              letterSpacing: '0.35em',
              color: '#b8972e',
              paddingLeft: '0.35em',
              opacity: 0.9,
            }}
          >
            BHS
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative h-[2px] rounded-full overflow-hidden"
            style={{ width: '72px', background: 'rgba(203,213,225,0.5)' }}
          >
            <div
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.8), transparent)',
                animation: 'shimmer 1.8s ease-in-out infinite',
                width: '60%',
              }}
            />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);  }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes spinReverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(280%);  }
        }
      `}</style>
    </div>
  );
};

export default MainLoader;
