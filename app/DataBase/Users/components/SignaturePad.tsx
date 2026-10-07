'use client';

import { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check } from 'lucide-react';

interface SignaturePadProps {
  onSave: (base64Data: string) => void;
  initialValue?: string;
}

export default function SignaturePad({ onSave, initialValue }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Set up high-res canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set height and width based on container bounding client rect
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Brush properties
    ctx.strokeStyle = '#000000'; // Black ink for signature
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If there is an initial value, load it onto the canvas
    if (initialValue) {
      const img = new Image();
      img.src = initialValue;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
    }
  }, [initialValue]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    // Prevent scrolling on touch screens
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Prevent scrolling on touch screens
    if (e.cancelable) e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSave(''); // Clear signature in state
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasDrawn) return;

    // Convert high-res canvas to data URL (PNG)
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full h-[320px] bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair touch-none"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sign here</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 w-full">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex-1 py-3.5 px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasDrawn}
          className={`flex-1 py-3.5 px-5 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            hasDrawn
              ? 'bg-black text-[#D4AF37] hover:bg-gray-900 shadow-lg shadow-black/10'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          Apply
        </button>
      </div>
    </div>
  );
}
