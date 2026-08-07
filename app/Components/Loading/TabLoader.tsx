'use client';

import { useEffect, useState } from 'react';

interface TabLoaderProps {
  className?: string;
}

export default function TabLoader({ className = '' }: TabLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;

        let inc = 0;
        if (prev < 60) inc = Math.floor(Math.random() * 10) + 5;
        else if (prev < 85) inc = Math.floor(Math.random() * 4) + 1;
        else if (prev < 93) inc = Math.floor(Math.random() * 2) + 0.5;
        else inc = Math.random() > 0.8 ? 0.1 : 0;

        const nextVal = prev + inc;
        return nextVal >= 95 ? 95 : parseFloat(nextVal.toFixed(1));
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const displayProgress = Math.floor(progress);

  return (
    <div
      className={`w-full min-h-[calc(100vh-120px)] flex flex-col items-center justify-center select-none ${className}`}
    >
      <div className="db-load-title">
        DATABASE <span>LOADING...</span>
      </div>

      <div className="db-load-spinner">
        <div className="db-load-spinner-outer" />
        <div className="db-load-spinner-inner" />
        <div className="db-load-pct">{displayProgress}%</div>
      </div>
    </div>
  );
}
