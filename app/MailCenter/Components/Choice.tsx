'use client';

/** small segmented buttons, all the same width */
export default function Choice<T extends string>({ value, options, onChange, width = 'w-36' }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; width?: string }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`h-8 ${width} px-2 rounded-lg text-xs font-black whitespace-nowrap transition-all ${value === o.id ? 'bg-black text-[#C4A052] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
