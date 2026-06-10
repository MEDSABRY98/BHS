'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, List, ArrowLeft, History, Menu } from 'lucide-react';
import { generateWaterDeliveryNotePDF } from '@/lib/pdf/PdfUtils';
import { toast } from '@/components/01-Unified/Notification';
import Loading from '@/components/01-Unified/Loading';
import { bhs_supabas } from '@/lib/supabase';
import WaterEntryTab from './Components/WaterEntryTab';
import WaterSearchTab from './Components/WaterSearchTab';
import WaterDailyTab from './Components/WaterDailyTab';
import WaterHistoryTab from './Components/WaterHistoryTab';
import WaterSidebar from './Components/WaterSidebar';

export interface WaterDeliveryNoteItem {
  itemName: string;
  signature: string;
}

export interface DeliveryNoteLine {
  itemName: string;
  quantity: number;
  unitType: 'Outer';
}

export interface DailyDataRow {
  deliveryNoteNumber: string;
  date: string;
  itemName: string;
  quantity: number;
  receivedBy: string;
}

export default function WaterDeliveryNotePage() {
  const [activeTab, setActiveTab] = useState<'entry' | 'search' | 'history' | 'daily'>('entry');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [items, setItems] = useState<WaterDeliveryNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Entry Tab states (for new entries only)
  const [lines, setLines] = useState<DeliveryNoteLine[]>([
    { itemName: '', quantity: 0, unitType: 'Outer' }
  ]);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedBy, setReceivedBy] = useState('');

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
  const [editReceivedBy, setEditReceivedBy] = useState('');

  // Daily output states
  const [dailyData, setDailyData] = useState<DailyDataRow[]>([]);
  
  // Unique receivers list derived from history
  const uniqueReceivers = Array.from(new Set(dailyData.map(d => d.receivedBy).filter(Boolean))).sort();

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('waterSidebarCollapsed');
    if (stored === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('waterSidebarCollapsed', String(nextState));
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else toast.info(message);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load user permissions
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);

          // Set initial tab based on permissions
          try {
            const perms = JSON.parse(user.role || '{}');
            if (perms['water-delivery-note'] && user.name !== 'MED Sabry') {
              const allowed = perms['water-delivery-note'];
              if (allowed.length > 0 && !allowed.includes('entry')) {
                setActiveTab(allowed[0] as any);
              }
            }
          } catch (e) { }
        }

        // Fetch items from web_WATER_DB_PRODUCT
        const { data: productsData, error: productsError } = await bhs_supabas
          .from('web_WATER_DB_PRODUCT')
          .select('PRODUCT_NAME')
          .order('PRODUCT_NAME');
          
        if (productsData) {
          setItems(productsData.map(p => ({ itemName: p.PRODUCT_NAME, signature: '' })));
        }

        // Fetch next delivery note number from web_WATER_DB
        const { data: maxTxData } = await bhs_supabas
          .from('web_WATER_DB')
          .select('TRANSCTION_ID')
          .order('TRANSCTION_ID', { ascending: false })
          .limit(1);
          
        let nextNumber = 'W-0001';
        if (maxTxData && maxTxData.length > 0 && maxTxData[0].TRANSCTION_ID) {
          const match = maxTxData[0].TRANSCTION_ID.match(/W-(\d+)/);
          if (match && match[1]) {
            nextNumber = `W-${String(parseInt(match[1]) + 1).padStart(4, '0')}`;
          }
        }
        setDeliveryNoteNumber(nextNumber);

        // Fetch all delivery notes for daily output
        const { data: allData } = await bhs_supabas
          .from('web_WATER_DB')
          .select('*')
          .order('DATE', { ascending: false });
          
        if (allData) {
          setDailyData(allData.map(row => ({
            deliveryNoteNumber: row.TRANSCTION_ID,
            date: row.DATE,
            itemName: row.PRODUCT_NAME,
            quantity: Number(row.QUANTITY),
            receivedBy: row.RECEIVED_BY || ''
          })));
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
      const { data: maxTxData } = await bhs_supabas
        .from('web_WATER_DB')
        .select('TRANSCTION_ID')
        .order('TRANSCTION_ID', { ascending: false })
        .limit(1);
        
      let nextNumber = 'W-0001';
      if (maxTxData && maxTxData.length > 0 && maxTxData[0].TRANSCTION_ID) {
        const match = maxTxData[0].TRANSCTION_ID.match(/W-(\d+)/);
        if (match && match[1]) {
          nextNumber = `W-${String(parseInt(match[1]) + 1).padStart(4, '0')}`;
        }
      }
      setDeliveryNoteNumber(nextNumber);
    } catch (error) {
      console.error('Error fetching next number:', error);
      setDeliveryNoteNumber('W-0001');
    }
  };

  const handleSearch = async () => {
    if (!searchNumber.trim()) {
      showNotification('Please enter a delivery note number', 'warning');
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await bhs_supabas
        .from('web_WATER_DB')
        .select('*')
        .eq('TRANSCTION_ID', searchNumber.trim());

      if (error) throw error;

      if (!data || data.length === 0) {
        showNotification('Delivery note not found', 'error');
        setFoundDeliveryNote(null);
        setIsSearching(false);
        return;
      }

      // Format data back to the structure expected by the app
      const date = data[0].DATE;
      const receivedBy = data[0].RECEIVED_BY || '';
      const items = data.map(row => ({
        itemName: row.PRODUCT_NAME,
        quantity: Number(row.QUANTITY),
        unitType: 'Outer' as const
      }));

      setFoundDeliveryNote({ deliveryNoteNumber: searchNumber.trim(), date, items });
      setEditDeliveryNoteNumber(searchNumber.trim());
      setEditDate(date);
      setEditReceivedBy(receivedBy);
      setEditLines(items);
      setIsEditing(true);
      showNotification('Delivery note loaded successfully', 'success');
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
    setEditReceivedBy('');
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

      if (!editReceivedBy.trim()) {
        showNotification('Please enter the Received By name', 'warning');
        return;
      }

      const validLines = editLines.filter(line => line.itemName && line.quantity > 0);
      if (validLines.length === 0) {
        showNotification('Please add at least one item with quantity', 'warning');
        return;
      }

      setSaving(true);

      // First delete existing records for this delivery note
      const { error: deleteError } = await bhs_supabas
        .from('web_WATER_DB')
        .delete()
        .eq('TRANSCTION_ID', editDeliveryNoteNumber);

      if (deleteError) {
        console.error('Error deleting old records:', deleteError);
        showNotification('Error updating delivery note. Please try again.', 'error');
        setSaving(false);
        return;
      }

      // Then insert new records
      const insertData = validLines.map(line => ({
        TRANSCTION_ID: editDeliveryNoteNumber,
        DATE: editDate,
        PRODUCT_NAME: line.itemName,
        QUANTITY: line.quantity,
        RECEIVED_BY: editReceivedBy.trim() || null
      }));

      const { error: insertError } = await bhs_supabas
        .from('web_WATER_DB')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting new records:', insertError);
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
          receivedBy: editReceivedBy,
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

      if (!receivedBy.trim()) {
        showNotification('Please enter the Received By name', 'warning');
        return;
      }

      const validLines = lines.filter(line => line.itemName && line.quantity > 0);
      if (validLines.length === 0) {
        showNotification('Please add at least one item with quantity', 'warning');
        return;
      }

      setSaving(true);

      // Save to Supabase first
      try {
        const insertData = validLines.map(line => ({
          TRANSCTION_ID: deliveryNoteNumber,
          DATE: date,
          PRODUCT_NAME: line.itemName,
          QUANTITY: line.quantity,
          RECEIVED_BY: receivedBy.trim() || null
        }));

        const { error: insertError } = await bhs_supabas
          .from('web_WATER_DB')
          .insert(insertData);

        if (insertError) {
          console.error('Error saving to Supabase:', insertError);
          showNotification('Error saving to database. Please try again.', 'error');
          setSaving(false);
          return;
        }
        showNotification('Delivery note saved successfully!', 'success');
      } catch (saveError) {
        console.error('Error saving to Supabase:', saveError);
        showNotification('Error saving to database. Please try again.', 'error');
        setSaving(false);
        return;
      }

      // Generate PDF after successful save
      await generateWaterDeliveryNotePDF({
        companyName: 'Al Marai Al Arabia Trading Sole Proprietorship L.L.C',
        deliveryNoteNumber,
        date,
        receivedBy,
        lines,
        total: calculateTotal()
      });

      showNotification('PDF generated successfully!', 'success');

      // Clear form and get next number
      setLines([{ itemName: '', quantity: 0, unitType: 'Outer' }]);
      setDate(new Date().toISOString().split('T')[0]);
      setReceivedBy('');
      await fetchNextDeliveryNoteNumber();

      setSaving(false);
    } catch (error) {
      console.error('Error:', error);
      showNotification('Error processing request. Please try again.', 'error');
      setSaving(false);
    }
  };

  const handleReprintTransaction = async (txNumber: string) => {
    try {
      const { data, error } = await bhs_supabas
        .from('web_WATER_DB')
        .select('*')
        .eq('TRANSCTION_ID', txNumber);

      if (error) throw error;

      if (!data || data.length === 0) {
        showNotification('Delivery note not found for reprinting', 'error');
        return;
      }

      const date = data[0].DATE;
      const receivedBy = data[0].RECEIVED_BY || '';
      const items = data.map(row => ({
        itemName: row.PRODUCT_NAME,
        quantity: Number(row.QUANTITY),
        unitType: 'Outer' as const
      }));

      const total = items.reduce((acc, line) => {
        acc.outer += line.quantity;
        return acc;
      }, { outer: 0, pcs: 0 });

      await generateWaterDeliveryNotePDF({
        companyName: 'Al Marai Al Arabia Trading Sole Proprietorship L.L.C',
        deliveryNoteNumber: txNumber,
        date,
        receivedBy,
        lines: items,
        total
      });
      showNotification('PDF reprinted successfully!', 'success');
    } catch (error) {
      console.error('Error reprinting:', error);
      showNotification('Failed to reprint.', 'error');
    }
  };

  const handleDeleteTransaction = async (txNumber: string) => {
    try {
      const { error } = await bhs_supabas
        .from('web_WATER_DB')
        .delete()
        .eq('TRANSCTION_ID', txNumber);

      if (error) throw error;

      setDailyData(prev => prev.filter(row => row.deliveryNoteNumber !== txNumber));
      showNotification(`Delivery Note ${txNumber} deleted successfully.`, 'success');
      
      // Update next number just in case it was the latest
      await fetchNextDeliveryNoteNumber();
    } catch (error) {
      console.error('Error deleting:', error);
      showNotification('Failed to delete delivery note.', 'error');
    }
  };

  if (loading) {
    return <Loading message="Loading Water Delivery Note Data..." />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0d1e16] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <WaterSidebar
          activeTab={activeTab}
          onTabChange={(tab: string) => setActiveTab(tab as any)}
          currentUser={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d1e16] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <WaterSidebar
          activeTab={activeTab}
          onTabChange={(tab: string) => setActiveTab(tab as any)}
          currentUser={currentUser}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
          <div className="max-w-[90%] mx-auto px-4 py-3 flex items-center justify-between min-h-[5rem]">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)} 
              className="p-2.5 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex-1 flex justify-center items-center">
              <span className="text-lg font-extrabold text-slate-800 tracking-tight">
                {activeTab === 'entry' && 'New Entry'}
                {activeTab === 'search' && 'Search / Edit'}
                {activeTab === 'history' && 'History'}
                {activeTab === 'daily' && 'Daily Summary'}
              </span>
            </div>
            <div className="w-11 lg:hidden"></div> {/* Spacer for mobile balance */}
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">


        {/* Entry Tab */}
        {activeTab === 'entry' && (
          <WaterEntryTab
            deliveryNoteNumber={deliveryNoteNumber}
            date={date}
            setDate={setDate}
            receivedBy={receivedBy}
            setReceivedBy={setReceivedBy}
            lines={lines}
            items={items}
            addLine={addLine}
            updateLine={updateLine}
            removeLine={removeLine}
            calculateTotal={calculateTotal}
            handlePrint={handlePrint}
            saving={saving}
            uniqueReceivers={uniqueReceivers}
          />
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <WaterSearchTab
            searchNumber={searchNumber}
            setSearchNumber={setSearchNumber}
            isSearching={isSearching}
            handleSearch={handleSearch}
            isEditing={isEditing}
            editDeliveryNoteNumber={editDeliveryNoteNumber}
            editDate={editDate}
            setEditDate={setEditDate}
            editReceivedBy={editReceivedBy}
            setEditReceivedBy={setEditReceivedBy}
            editLines={editLines}
            items={items}
            addEditLine={addEditLine}
            updateEditLine={updateEditLine}
            removeEditLine={removeEditLine}
            calculateEditTotal={calculateEditTotal}
            handleUpdate={handleUpdate}
            saving={saving}
            handleCancelEdit={handleCancelEdit}
            uniqueReceivers={uniqueReceivers}
          />
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <WaterHistoryTab 
            dailyData={dailyData} 
            handleReprint={handleReprintTransaction} 
            handleDelete={handleDeleteTransaction} 
          />
        )}

        {/* Daily Output Tab */}
        {activeTab === 'daily' && (
          <WaterDailyTab dailyData={dailyData} />
        )}
        </div>
      </div>
    </div>
  );
}

