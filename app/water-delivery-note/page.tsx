'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Printer, ArrowLeft, Save, Loader2, Search, Edit2, X } from 'lucide-react';
import { generateWaterDeliveryNotePDF } from '@/lib/pdfUtils';
import { NotificationContainer, NotificationType } from '@/components/Notification';
import Loading from '@/components/Loading';

interface WaterDeliveryNoteItem {
  itemName: string;
  signature: string;
}

interface DeliveryNoteLine {
  itemName: string;
  quantity: number;
  unitType: 'Outer';
}

export default function WaterDeliveryNotePage() {
  const [activeTab, setActiveTab] = useState<'entry' | 'search' | 'daily'>('entry');
  const [items, setItems] = useState<WaterDeliveryNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Entry Tab states (for new entries only)
  const [lines, setLines] = useState<DeliveryNoteLine[]>([
    { itemName: '', quantity: 0, unitType: 'Outer' }
  ]);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Search Tab states (for editing existing entries)
  const [searchNumber, setSearchNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [foundDeliveryNote, setFoundDeliveryNote] = useState<any>(null);
  const [editLines, setEditLines] = useState<DeliveryNoteLine[]>([
    { itemName: '', quantity: 0, unitType: 'Outer' }
  ]);
  const [editDeliveryNoteNumber, setEditDeliveryNoteNumber] = useState('');
  const [editDate, setEditDate] = useState(new Date().toISOString().split('T')[0]);

  // Daily output states
  const [dailyData, setDailyData] = useState<any[]>([]);

  // Notifications state
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: NotificationType }>>([]);

  const showNotification = (message: string, type: NotificationType = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch items
        const itemsResponse = await fetch('/api/water-delivery-note');
        const itemsData = await itemsResponse.json();
        if (itemsData.data) {
          setItems(itemsData.data);
        }

        // Fetch next delivery note number
        const numberResponse = await fetch('/api/water-delivery-note?action=next-number');
        const numberData = await numberResponse.json();
        if (numberData.nextNumber) {
          setDeliveryNoteNumber(numberData.nextNumber);
        } else {
          // Fallback to DN-001 if no number returned
          setDeliveryNoteNumber('DN-001');
        }

        // Fetch all delivery notes for daily output
        const allDataResponse = await fetch('/api/water-delivery-note?action=all');
        const allDataJson = await allDataResponse.json();
        if (allDataJson.data) {
          setDailyData(allDataJson.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const addLine = () => {
    setLines([...lines, { itemName: '', quantity: 0, unitType: 'Outer' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof DeliveryNoteLine, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  // Edit line helpers (for Search tab)
  const addEditLine = () => {
    setEditLines([...editLines, { itemName: '', quantity: 0, unitType: 'Outer' }]);
  };

  const removeEditLine = (index: number) => {
    if (editLines.length > 1) {
      setEditLines(editLines.filter((_, i) => i !== index));
    }
  };

  const updateEditLine = (index: number, field: keyof DeliveryNoteLine, value: string | number) => {
    const newLines = [...editLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setEditLines(newLines);
  };

  const calculateTotal = () => {
    const totals = lines.reduce((acc, line) => {
      acc.outer += line.quantity;
      return acc;
    }, { outer: 0, pcs: 0 });
    return totals;
  };

  const calculateEditTotal = () => {
    const totals = editLines.reduce((acc, line) => {
      acc.outer += line.quantity;
      return acc;
    }, { outer: 0, pcs: 0 });
    return totals;
  };

  const fetchNextDeliveryNoteNumber = async () => {
    try {
      const numberResponse = await fetch('/api/water-delivery-note?action=next-number');
      const numberData = await numberResponse.json();
      if (numberData.nextNumber) {
        setDeliveryNoteNumber(numberData.nextNumber);
      } else {
        setDeliveryNoteNumber('DN-001');
      }
    } catch (error) {
      console.error('Error fetching next number:', error);
      setDeliveryNoteNumber('DN-001');
    }
  };

  const handleSearch = async () => {
    if (!searchNumber.trim()) {
      showNotification('Please enter a delivery note number', 'warning');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/water-delivery-note?number=${encodeURIComponent(searchNumber.trim())}`);
      if (response.status === 404) {
        showNotification('Delivery note not found', 'error');
        setFoundDeliveryNote(null);
        setIsSearching(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to search');
      }

      const data = await response.json();
      if (data.data) {
        setFoundDeliveryNote(data.data);
        setEditDeliveryNoteNumber(data.data.deliveryNoteNumber);
        setEditDate(data.data.date);
        setEditLines(data.data.items.map((item: any) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unitType: 'Outer' as const
        })));
        setIsEditing(true);
        showNotification('Delivery note loaded successfully', 'success');
      }
    } catch (error) {
      console.error('Error searching:', error);
      showNotification('Error searching for delivery note. Please try again.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelEdit = async () => {
    setIsEditing(false);
    setFoundDeliveryNote(null);
    setSearchNumber('');
    setEditLines([{ itemName: '', quantity: 0, unitType: 'Outer' }]);
    setEditDate(new Date().toISOString().split('T')[0]);
    setEditDeliveryNoteNumber('');
  };

  const handleUpdate = async () => {
    try {
      if (!editDeliveryNoteNumber.trim()) {
        showNotification('Delivery Note Number is missing.', 'warning');
        return;
      }

      if (!editDate) {
        showNotification('Please select a date', 'warning');
        return;
      }

      const validLines = editLines.filter(line => line.itemName && line.quantity > 0);
      if (validLines.length === 0) {
        showNotification('Please add at least one item with quantity', 'warning');
        return;
      }

      setSaving(true);

      const updateResponse = await fetch('/api/water-delivery-note', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryNoteNumber: editDeliveryNoteNumber,
          date: editDate,
          items: validLines.map(line => ({
            itemName: line.itemName,
            quantity: line.quantity
          }))
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error('Error updating:', errorData);
        showNotification('Error updating delivery note. Please try again.', 'error');
        setSaving(false);
        return;
      }

      showNotification('Delivery note updated successfully!', 'success');

      // Generate PDF after successful update
      try {
        await generateWaterDeliveryNotePDF({
          companyName: 'Al Marai Al Arabia Trading Sole Proprietorship L.L.C',
          deliveryNoteNumber: editDeliveryNoteNumber,
          date: editDate,
          lines: editLines,
          total: calculateEditTotal()
        });
        showNotification('PDF generated successfully!', 'success');
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        showNotification('Delivery note updated but failed to generate PDF. You can print it manually.', 'warning');
      }

      await handleCancelEdit();
      setSaving(false);
    } catch (error) {
      console.error('Error updating:', error);
      showNotification('Error updating delivery note. Please try again.', 'error');
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    try {
      // Validate required fields
      if (!deliveryNoteNumber.trim()) {
        showNotification('Delivery Note Number is missing. Please refresh the page.', 'error');
        return;
      }

      if (!date) {
        showNotification('Please select a date', 'warning');
        return;
      }

      const validLines = lines.filter(line => line.itemName && line.quantity > 0);
      if (validLines.length === 0) {
        showNotification('Please add at least one item with quantity', 'warning');
        return;
      }

      setSaving(true);

      // Save to Google Sheets first
      try {
        const saveResponse = await fetch('/api/water-delivery-note', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date,
            deliveryNoteNumber,
            items: validLines.map(line => ({
              itemName: line.itemName,
              quantity: line.quantity
            }))
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json();
          console.error('Error saving to sheets:', errorData);
          showNotification('Error saving to Google Sheets. Please try again.', 'error');
          setSaving(false);
          return;
        }
        showNotification('Delivery note saved successfully!', 'success');
      } catch (saveError) {
        console.error('Error saving to sheets:', saveError);
        showNotification('Error saving to Google Sheets. Please try again.', 'error');
        setSaving(false);
        return;
      }

      // Generate PDF after successful save
      await generateWaterDeliveryNotePDF({
        companyName: 'Al Marai Al Arabia Trading Sole Proprietorship L.L.C',
        deliveryNoteNumber,
        date,
        lines,
        total: calculateTotal()
      });

      showNotification('PDF generated successfully!', 'success');

      // Clear form and get next number
      setLines([{ itemName: '', quantity: 0, unitType: 'Outer' }]);
      setDate(new Date().toISOString().split('T')[0]);
      await fetchNextDeliveryNoteNumber();

      setSaving(false);
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error processing request. Please try again.', 'error');
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading Water Delivery Note Data..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Water - Delivery Note</h1>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="p-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab('entry')}
              className={`w-40 px-8 py-3 rounded-lg font-bold transition-all ${activeTab === 'entry'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
            >
              Entry
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`w-40 px-8 py-3 rounded-lg font-bold transition-all ${activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`w-40 px-8 py-3 rounded-lg font-bold transition-all ${activeTab === 'daily'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
            >
              Daily Output
            </button>
          </div>
        </div>


        {/* Entry Tab */}
        {activeTab === 'entry' && (
          <>
            {/* Form */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Note Number
                  </label>
                  <input
                    type="text"
                    value={deliveryNoteNumber}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    placeholder="DN-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Lines */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Items</h2>
                  <button
                    onClick={addLine}
                    className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Add Item"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-end p-4 bg-gray-50 rounded-lg">
                      <div className="col-span-7">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Item Name
                        </label>
                        <select
                          value={line.itemName}
                          onChange={(e) => updateLine(index, 'itemName', e.target.value)}
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
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent h-10"
                        />
                      </div>
                      <div className="col-span-1">
                        {lines.length > 1 && (
                          <button
                            onClick={() => removeLine(index)}
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

              {/* Total */}
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-800">Total Outer:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {calculateTotal().outer.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handlePrint}
                  disabled={saving}
                  className={`w-1/2 px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${saving
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save & Print
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
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
                    placeholder="e.g., DN-001"
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

            {/* Edit Form (shown when editing) */}
            {isEditing && (
              <div className="mt-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Note Number
                    </label>
                    <input
                      type="text"
                      value={editDeliveryNoteNumber}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                      placeholder="DN-001"
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
                </div>

                {/* Lines */}
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

                {/* Total */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-800">Total Outer:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {calculateEditTotal().outer.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleUpdate}
                    disabled={saving}
                    className={`w-1/2 px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${saving
                      ? 'bg-green-400 text-white cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-5 h-5" />
                        Update
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Daily Output Tab */}
        {activeTab === 'daily' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Daily Output</h2>

            {dailyData.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No delivery notes found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <th className="border border-gray-300 px-4 py-3 text-center font-bold sticky left-0 bg-blue-600 z-10">
                        Date
                      </th>
                      {(() => {
                        // Get unique product names and sort alphabetically
                        const productNames = Array.from(new Set(dailyData.map(d => d.itemName))).sort();
                        return productNames.map(product => (
                          <th key={product} className="border border-gray-300 px-4 py-3 text-center font-bold min-w-[120px]">
                            {product}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group data by date
                      const dateMap = new Map<string, Map<string, number>>();

                      dailyData.forEach(entry => {
                        if (!dateMap.has(entry.date)) {
                          dateMap.set(entry.date, new Map());
                        }
                        const productMap = dateMap.get(entry.date)!;
                        const currentQty = productMap.get(entry.itemName) || 0;
                        productMap.set(entry.itemName, currentQty + entry.quantity);
                      });

                      // Sort dates (newest first)
                      const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
                        return new Date(b).getTime() - new Date(a).getTime();
                      });

                      // Get unique product names sorted alphabetically
                      const productNames = Array.from(new Set(dailyData.map(d => d.itemName))).sort();

                      return sortedDates.map((date, idx) => {
                        const productMap = dateMap.get(date)!;
                        return (
                          <tr key={date} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 px-4 py-3 font-bold text-gray-800 text-center sticky left-0 bg-inherit z-10">
                              {date}
                            </td>
                            {productNames.map(product => {
                              const qty = productMap.get(product) || 0;
                              return (
                                <td
                                  key={product}
                                  className={`border border-gray-300 px-4 py-3 text-center font-mono ${qty > 0 ? 'text-gray-800 font-bold' : 'text-gray-400'
                                    }`}
                                >
                                  {qty > 0 ? qty.toLocaleString() : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="border border-gray-300 px-4 py-3 text-gray-900 sticky left-0 bg-gray-100 z-10">
                        TOTAL
                      </td>
                      {(() => {
                        const productNames = Array.from(new Set(dailyData.map(d => d.itemName))).sort();
                        return productNames.map(product => {
                          const total = dailyData
                            .filter(d => d.itemName === product)
                            .reduce((sum, d) => sum + d.quantity, 0);
                          return (
                            <td key={product} className="border border-gray-300 px-4 py-3 text-center font-mono text-blue-700 font-bold">
                              {total.toLocaleString()}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

