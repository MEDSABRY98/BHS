'use client';

import type { Tone } from './Types';

const CLASS: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};

export default function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${CLASS[tone]}`}>{children}</span>;
}

export const TONE_TEXT: Record<Tone | 'ink' | 'gold', string> = {
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  slate: 'text-slate-900',
  ink: 'text-slate-900',
  gold: 'text-[#B8860B]',
};

export const TONE_BAR: Record<Tone | 'ink' | 'gold', string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  slate: 'bg-slate-300',
  ink: 'bg-slate-900',
  gold: 'bg-[#D4AF37]',
};
