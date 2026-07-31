'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { InventoryLocationRow, InventoryLocationType } from '@/app/InventoryAnalysis/Service/location_service';

export type InventoryLocationFormValues = {
  locationName: string;
  locationType: InventoryLocationType;
};

const TYPE_LABELS: Record<InventoryLocationType, string> = {
  internal: 'Internal',
  internal_water_cluster: 'Water Cluster',
  internal_core: 'Core WH',
  inflow: 'Inflow',
  outflow: 'Outflow',
  external: 'External',
};

const LOCATION_TYPES: InventoryLocationType[] = (
  Object.keys(TYPE_LABELS) as InventoryLocationType[]
).sort((a, b) => TYPE_LABELS[a].localeCompare(TYPE_LABELS[b], undefined, { sensitivity: 'base' }));

type Props = {
  isOpen: boolean;
  editing: InventoryLocationRow | null;
  values: InventoryLocationFormValues;
  isSaving: boolean;
  onChange: (values: InventoryLocationFormValues) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function InventoryLocationModal({
  isOpen,
  editing,
  values,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const [showTypePicker, setShowTypePicker] = useState(false);

  const title = editing ? 'Edit Location' : 'Add Location';
  const subtitle = editing
    ? `ID ${editing.ID} — change display name only`
    : 'A new LOC- ID is assigned automatically';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-50 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-black tracking-tight">{title}</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-6">
          {editing && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
                ID
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-mono text-sm font-bold text-black">
                {editing.ID}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
              Location Name
            </label>
            <input
              type="text"
              required
              value={values.locationName}
              onChange={(e) => onChange({ ...values, locationName: e.target.value })}
              placeholder="e.g. M/WH/Mazyad"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-sm font-medium"
            />
          </div>

          {!editing && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
                Location Type
              </label>
              <button
                type="button"
                onClick={() => setShowTypePicker((v) => !v)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-left text-sm font-bold text-gray-800 flex items-center justify-between"
              >
                {TYPE_LABELS[values.locationType]}
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {showTypePicker ? 'Hide' : 'Change'}
                </span>
              </button>
              {showTypePicker && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {LOCATION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        onChange({ ...values, locationType: type });
                        setShowTypePicker(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                        values.locationType === type
                          ? 'bg-black text-[#D4AF37] border-black'
                          : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2 font-medium">
                Default type is inferred from the name when possible.
              </p>
            </div>
          )}

          {editing && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
                Type
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-600">
                {TYPE_LABELS[editing['LOCATION TYPE']] || editing['LOCATION TYPE']}
                <span className="block text-xs font-medium text-gray-400 mt-1">
                  Recalculated automatically when the name changes.
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 rounded-2xl border border-gray-200 text-sm font-black uppercase tracking-widest text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-5 py-3 rounded-2xl bg-black text-[#D4AF37] text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save Name' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { TYPE_LABELS };
