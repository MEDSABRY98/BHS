'use client';

interface TabLoaderProps {
  className?: string;
}

function ShimmerBlock({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] animate-[salesShimmer_1.4s_ease-in-out_infinite] ${className}`}
      style={style}
    />
  );
}

export default function TabLoader({ className = '' }: TabLoaderProps) {
  return (
    <div className={`w-full min-h-[360px] py-2 animate-in fade-in duration-300 ${className}`}>
      <div className="mb-8 flex items-center gap-4">
        <ShimmerBlock className="h-12 w-12 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2.5">
          <ShimmerBlock className="h-6 w-52" />
          <ShimmerBlock className="h-3 w-36 opacity-70" />
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className="h-[108px]"
            style={{ animationDelay: `${i * 0.1}s` } as React.CSSProperties}
          />
        ))}
      </div>

      <ShimmerBlock className="mb-8 h-56 rounded-2xl" />

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className="h-11"
            style={{ animationDelay: `${i * 0.08}s` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
