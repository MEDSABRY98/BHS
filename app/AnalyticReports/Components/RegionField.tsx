'use client';

import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import Dropdown from './Dropdown';
import { INPUT } from './ui';

const NEW = '__new__';

/** Region picker: choose an existing region, or add a new one. */
export default function RegionField({ value, regions, onChange, size = 'md', disabled, className = '' }: { value: string; regions: string[]; onChange: (v: string) => void; size?: 'md' | 'sm'; disabled?: boolean; className?: string }) {
  const [adding, setAdding] = useState(false);
  const list = [...new Set([...regions, ...(value ? [value] : [])])].sort();

  if (adding)
    return (
      <input
        autoFocus
        disabled={disabled}
        value={value}
        placeholder="New region name"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => value.trim() && setAdding(false)}
        className={`${INPUT} ${size === 'sm' ? '!h-9 !text-xs' : ''} w-full ${className}`}
      />
    );

  return (
    <Dropdown
      size={size}
      disabled={disabled}
      className={className}
      value={value}
      placeholder="Region"
      onChange={(v) => (v === NEW ? (onChange(''), setAdding(true)) : onChange(v))}
      options={[...list.map((r) => ({ value: r, label: r, icon: MapPin })), { value: NEW, label: 'New region…', hint: 'Add a region that is not in the list', icon: Plus }]}
    />
  );
}
