'use client';

import { useState, useEffect } from 'react';
import { Shield, User, Check, X, Search, Settings, Save, AlertCircle, ChevronRight, Layers } from 'lucide-react';
import Loading from './Loading';

interface UserPermissions {
    name: string;
    role: string;
}

const SYSTEMS = [
    { id: 'cash-receipt', label: 'Cash Receipt' },
    { id: 'petty-cash', label: 'Petty Cash' },
    { id: 'debit', label: 'Debit Analysis' },
    { id: 'discount-tracker', label: 'Discount Tracker' },
    { id: 'sales', label: 'Sales Analysis' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'wh20-items', label: 'WH/20 Items' },
    { id: 'employee-overtime', label: 'Employee Overtime' },
    { id: 'water-delivery-note', label: 'Water Delivery Note' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'visit-customers', label: 'Visit Customers' }
];

const SYSTEM_SUBTABS: Record<string, { id: string, label: string }[]> = {
    'debit': [
        { id: 'customers', label: 'Customers' },
        { id: 'all-transactions', label: 'All Transactions' },
        { id: 'customers-open-matches', label: 'Open Transactions' },
        { id: 'payment-tracker', label: 'Payment Tracker' },
        { id: 'salesreps', label: 'Sales Reps' },
        { id: 'history', label: 'History' },
        { id: 'ages', label: 'Ages' },
        { id: 'all-notes', label: 'All Notes' }
    ],
    'sales': [
        { id: 'sales-overview', label: 'Overview' },
        { id: 'sales-top10', label: 'Top 10' },
        { id: 'sales-customers', label: 'Customers' },
        { id: 'sales-invoice-details', label: 'Invoice Details' },
        { id: 'sales-inactive-customers', label: 'Inactive' },
        { id: 'sales-statistics', label: 'Statistics' },
        { id: 'sales-daily-sales', label: 'Daily Sales' },
        { id: 'sales-products', label: 'Products' },
        { id: 'sales-download-form', label: 'Order Form' }
    ],
    'inventory': [
        { id: 'orders', label: 'Orders Tracker' },
        { id: 'notification', label: 'Notification Order' },
        { id: 'make', label: 'Make Orders' },
        { id: 'quotation', label: 'Purchase Quotation' }
    ],
    'cash-receipt': [
        { id: 'new', label: 'New Receipt' },
        { id: 'saved', label: 'Saved Receipts' }
    ],
    'petty-cash': [
        { id: 'receipts', label: 'Receipts' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'voucher', label: 'Voucher' },
        { id: 'stats', label: 'Statistics' }
    ],
    'employee-overtime': [
        { id: 'register', label: 'Register' },
        { id: 'view', label: 'View Records' },
        { id: 'statistics', label: 'Statistics' },
        { id: 'absence', label: 'Absence' }
    ],
    'visit-customers': [
        { id: 'registration', label: 'Registration' },
        { id: 'customer-reports', label: 'Customer Reports' },
        { id: 'rep-reports', label: 'Rep Reports' }
    ]
};

export default function AdminPanel() {
    const [users, setUsers] = useState<UserPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [modalSystem, setModalSystem] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/users');
            const data = await res.json();
            const sortedUsers = (data.users || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
            setUsers(sortedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const parsePermissions = (roleStr: string) => {
        try {
            return JSON.parse(roleStr || '{}');
        } catch {
            // Handle legacy roles if any
            if (roleStr === 'Admin') {
                const allSystems = SYSTEMS.map(s => s.id);
                const allSubTabs: Record<string, string[]> = {};
                Object.keys(SYSTEM_SUBTABS).forEach(sysId => {
                    allSubTabs[sysId] = SYSTEM_SUBTABS[sysId].map(t => t.id);
                });
                return { systems: allSystems, ...allSubTabs };
            }
            return {};
        }
    };

    const handleToggleSystem = (systemId: string) => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);
        const systems = perms.systems || [];
        const isEnabled = systems.includes(systemId);

        let newSystems;
        if (isEnabled) {
            newSystems = systems.filter((id: string) => id !== systemId);
        } else {
            newSystems = [...systems, systemId];
        }

        setSelectedUser({
            ...selectedUser,
            role: JSON.stringify({ ...perms, systems: newSystems })
        });
    };

    const handleToggleSubTab = (systemId: string, tabId: string) => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);

        // We store subtabs by system key, e.g. perms.debit = ['customers', ...]
        // legacy used 'debit_tabs' but let's migrate or support both. 
        // For simplicity, let's use the systemId directly as the key for its tabs.
        // Except for 'debit' which was 'debit_tabs' in previous version.
        const key = systemId === 'debit' ? 'debit_tabs' : systemId;
        const tabs = perms[key] || [];

        const newTabs = tabs.includes(tabId)
            ? tabs.filter((id: string) => id !== tabId)
            : [...tabs, tabId];

        setSelectedUser({
            ...selectedUser,
            role: JSON.stringify({ ...perms, [key]: newTabs })
        });
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selectedUser.name, role: selectedUser.role })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Permissions updated successfully!' });
                setUsers(users.map(u => u.name === selectedUser.name ? selectedUser : u));
            } else {
                throw new Error('Failed to update');
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Update failed. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <Loading message="Loading Admin Panel..." />;

    const renderSubTabModal = () => {
        if (!modalSystem || !selectedUser) return null;
        const system = SYSTEMS.find(s => s.id === modalSystem);
        const subTabs = [...(SYSTEM_SUBTABS[modalSystem] || [])].sort((a, b) => a.label.localeCompare(b.label));
        const perms = parsePermissions(selectedUser.role);
        const key = modalSystem === 'debit' ? 'debit_tabs' : modalSystem;
        const enabledTabs = perms[key] || [];

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{system?.label}</h3>
                                <p className="text-xs text-slate-500">Configure sub-tab visibility</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setModalSystem(null)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-full transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2 no-scrollbar">
                        {subTabs.map(tab => {
                            const isEnabled = enabledTabs.includes(tab.id);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleToggleSubTab(modalSystem, tab.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isEnabled
                                        ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                                        : 'border-slate-100 bg-slate-50 text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-200'
                                        }`}
                                >
                                    <span className="font-bold">{tab.label}</span>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isEnabled ? 'bg-blue-500 text-white' : 'bg-slate-200'
                                        }`}>
                                        {isEnabled && <Check className="w-4 h-4" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={() => setModalSystem(null)}
                            className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500 pt-2">
            {renderSubTabModal()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User List */}
                <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[750px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredUsers.map((user) => (
                            <button
                                key={user.name}
                                onClick={() => {
                                    setSelectedUser(user);
                                    setMessage({ type: '', text: '' });
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedUser?.name === user.name
                                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg ${selectedUser?.name === user.name ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                    <User className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-sm">{user.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Permissions Panel */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 p-8 h-[750px] flex flex-col">
                    {selectedUser ? (
                        <>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <p className="text-slate-500 text-sm">Configure system access and tab visibility</p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                                >
                                    {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                                </button>
                            </div>

                            {message.text && (
                                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                    }`}>
                                    {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    <span className="font-medium">{message.text}</span>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto pr-2 space-y-8 no-scrollbar">
                                {/* Systems Section */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Settings className="w-4 h-4" /> Primary Systems (Home)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[...SYSTEMS].sort((a, b) => a.label.localeCompare(b.label)).map((system) => {
                                            const permissions = parsePermissions(selectedUser.role);
                                            const isEnabled = permissions.systems?.includes(system.id);
                                            const hasSubTabs = !!SYSTEM_SUBTABS[system.id];

                                            return (
                                                <div key={system.id} className="group relative">
                                                    <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isEnabled
                                                        ? 'border-blue-500 bg-white'
                                                        : 'border-slate-100 bg-slate-50 opacity-60 hover:opacity-100'
                                                        }`}>
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <button
                                                                onClick={() => handleToggleSystem(system.id)}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${isEnabled ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-400'
                                                                    }`}
                                                            >
                                                                <Check className={`w-5 h-5 transition-transform ${isEnabled ? 'scale-100' : 'scale-0'}`} />
                                                            </button>

                                                            <div
                                                                onClick={() => (hasSubTabs && isEnabled) && setModalSystem(system.id)}
                                                                className={`flex-1 py-1 transition-all ${(hasSubTabs && isEnabled)
                                                                    ? 'cursor-pointer hover:translate-x-1'
                                                                    : ''
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-bold transition-colors ${isEnabled ? 'text-slate-900' : 'text-slate-400'
                                                                        } ${(hasSubTabs && isEnabled) ? 'group-hover:text-blue-600' : ''}`}>
                                                                        {system.label}
                                                                    </span>
                                                                    {hasSubTabs && isEnabled && (
                                                                        <Layers className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    )}
                                                                </div>
                                                                {hasSubTabs && isEnabled && (
                                                                    <p className="text-[10px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        Click to manage sub-tabs
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <Shield className="w-20 h-20 mb-4 opacity-10" />
                            <p className="text-xl font-medium">Select a user to modify permissions</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
