import { Search, Loader2, X, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { DeliveryNoteLine, WaterDeliveryNoteItem } from '../page';

function Combobox({ value, onChange, options, placeholder }: { value: string, onChange: (val: string) => void, options: string[], placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={placeholder}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-blue-50 text-gray-700 focus:outline-none"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface WaterSearchTabProps {
  searchNumber: string;
  setSearchNumber: (num: string) => void;
  isSearching: boolean;
  handleSearch: () => void;
  isEditing: boolean;
  editDeliveryNoteNumber: string;
  editDate: string;
  setEditDate: (date: string) => void;
  editReceivedBy: string;
  setEditReceivedBy: (name: string) => void;
  editLines: DeliveryNoteLine[];
  items: WaterDeliveryNoteItem[];
  addEditLine: () => void;
  updateEditLine: (index: number, field: keyof DeliveryNoteLine, value: string | number) => void;
  removeEditLine: (index: number) => void;
  calculateEditTotal: () => { outer: number; pcs: number };
  handleUpdate: () => void;
  saving: boolean;
  handleCancelEdit: () => void;
  uniqueReceivers?: string[];
}

export default function WaterSearchTab({
  searchNumber,
  setSearchNumber,
  isSearching,
  handleSearch,
  isEditing,
  editDeliveryNoteNumber,
  editDate,
  setEditDate,
  editReceivedBy,
  setEditReceivedBy,
  editLines,
  items,
  addEditLine,
  updateEditLine,
  removeEditLine,
  calculateEditTotal,
  handleUpdate,
  saving,
  handleCancelEdit,
  uniqueReceivers = []
}: WaterSearchTabProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search by Delivery Note Number
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g., W-0001"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSearching || isEditing}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || isEditing}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${isSearching || isEditing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search
                </>
              )}
            </button>
            {isEditing && (
              <button
                onClick={handleCancelEdit}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Note Number
              </label>
              <input
                type="text"
                value={editDeliveryNoteNumber}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                placeholder="W-0001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Received By
              </label>
              <Combobox
                value={editReceivedBy}
                onChange={setEditReceivedBy}
                options={uniqueReceivers}
                placeholder="Recipient Name"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Items</h2>
              <button
                onClick={addEditLine}
                className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="Add Item"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {editLines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-end p-4 bg-gray-50 rounded-lg">
                  <div className="col-span-7">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Name
                    </label>
                    <select
                      value={line.itemName}
                      onChange={(e) => updateEditLine(index, 'itemName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent h-10"
                    >
                      <option value="">Select Item</option>
                      {items.map((item, idx) => (
                        <option key={idx} value={item.itemName}>
                          {item.itemName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity (Outer)
                    </label>
                    <input
                      type="number"
                      value={line.quantity === 0 ? '' : line.quantity}
                      onChange={(e) => updateEditLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent h-10"
                    />
                  </div>
                  <div className="col-span-1">
                    {editLines.length > 1 && (
                      <button
                        onClick={() => removeEditLine(index)}
                        className="w-full h-10 p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center"
                        title="Remove line"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-800">Total Outer:</span>
              <span className="text-2xl font-bold text-green-600">
                {calculateEditTotal().outer.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="flex items-center justify-center gap-2 min-w-[220px] py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold shadow-md active:scale-95 disabled:opacity-70 mx-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Update
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
