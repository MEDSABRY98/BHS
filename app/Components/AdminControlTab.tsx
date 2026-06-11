'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Shield, User, Check, X, Search, Settings, Save, AlertCircle, ChevronRight, Layers, CheckCircle2,
    CreditCard, Wallet, BarChart3, TrendingUp, Package, Warehouse, Droplet, Truck, FileText, FileCheck, MapPin, ClipboardList, ShoppingCart, Database,
    Lock, Users, ShieldAlert, Sparkles, Trash2
} from 'lucide-react';
import Loading from '@/app/Components/Loading';

interface UserPermissions {
    name: string;
    role: string;
}

const SYSTEMS = [
    { id: 'cash-receipt', label: 'Cash Receipt' },
    { id: 'petty-cash', label: 'Petty Cash' },
    { id: 'debit', label: 'Debit Analysis' },
    { id: 'sales', label: 'Sales Analysis' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'inventory-scrap', label: 'Inventory Scrap' },
    { id: 'wh20-items', label: 'WarehouseS' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'customers-summaries', label: 'Customers Summaries' },
    { id: 'customers-documents', label: 'Customers Documents' },
    { id: 'documents-tracking', label: 'Documents Tracking' },
    { id: 'lpo-management', label: "LPO's" },
    { id: 'database', label: 'Database' }
];

const SYSTEM_SUBTABS: Record<string, { id: string, label: string }[]> = {
    'debit': [
        { id: 'customers', label: 'Customers' },
        { id: 'customers-group', label: 'Customers Group' },
        { id: 'all-transactions', label: 'All Transactions' },
        { id: 'customers-open-matches', label: 'Open Transactions' },
        { id: 'payment-tracker', label: 'Payment Tracker' },
        { id: 'salesreps', label: 'Sales Reps' },
        { id: 'history', label: 'History' },
        { id: 'ages', label: 'Ages' }
    ],
    'sales': [
        { id: 'sales-overview', label: 'Sales Overview' },
        { id: 'sales-top10', label: 'Top 10' },
        { id: 'sales-customers', label: 'Customers' },
        { id: 'sales-customers-comparison', label: 'Comparison' },
        { id: 'sales-inactive-customers', label: 'Inactive' },
        { id: 'sales-statistics', label: 'Statistics' },
        { id: 'sales-daily-sales', label: 'Daily Sales' },
        { id: 'sales-categories', label: 'Product Category' },
        { id: 'sales-products', label: 'Products' },
        { id: 'sales-new-listings', label: 'New Listings' },
        { id: 'sales-download-form', label: 'Stock Report' },
        { id: 'sales-my-customers', label: 'My Customers' }
    ],
    'inventory': [
        { id: 'orders', label: 'Products' },
        { id: 'item_code', label: 'Item Code' },
        { id: 'counting', label: 'Inventory Counting' },
        { id: 'normal_total', label: 'Normal Count' },
        { id: 'normal_record', label: 'Normal Record' },
        { id: 'damage_total', label: 'Damage & Expire Count' },
        { id: 'damage_record', label: 'Damage & Expire Record' }
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
    'customers-documents': [
        { id: 'checklist', label: 'Checklist' },
        { id: 'expiration', label: 'Expiration Tracker' }
    ],
    'wh20-items': [
        { id: 'entry', label: 'Entry' },
        { id: 'edit', label: 'Edit Transaction' },
        { id: 'history', label: 'History' },
        { id: 'people', label: 'People Inventory' }
    ],
    'suppliers': [
        { id: 'statements', label: 'Statements' },
        { id: 'matching', label: 'Matching' }
    ],
    'documents-tracking': [
        { id: 'register', label: 'Register' },
        { id: 'list', label: 'All Documents' },
        { id: 'receivers', label: 'Receivers' }
    ],
    'lpo-management': [
        { id: 'lpo-dashboard', label: 'Dashboard' },
        { id: 'lpo-orders', label: 'Orders' },
        { id: 'lpo-create-orders', label: 'Create Orders' },
        { id: 'lpo-reports', label: 'Reports' }
    ],
    'database': [
        { id: 'db-dashboard', label: 'Dashboard' },
        { id: 'db-customers', label: 'Customers DB' },
        { id: 'db-products', label: 'Products DB' },
        { id: 'db-users', label: 'Users DB' }
    ]
};

const SYSTEM_ACTIONS: Record<string, { id: string; label: string; icon: string }[]> = {
    'sales': [
        { id: 'view-costs', label: 'View Cost Columns', icon: '💰' }
    ],
    'lpo-management': [
        { id: 'view', label: 'Viewer (Read Only)', icon: '👁️' },
        { id: 'edit', label: 'Editor (Add/Edit)', icon: '✏️' },
        { id: 'delete', label: 'Admin (Add/Edit/Delete)', icon: '🗑️' }
    ],
    'database': [
        { id: 'view', label: 'Viewer (Read Only)', icon: '👁️' },
        { id: 'edit', label: 'Editor (Add/Edit)', icon: '✏️' },
        { id: 'delete', label: 'Admin (Add/Edit/Delete)', icon: '🗑️' }
    ]
};

const getSystemIcon = (id: string) => {
    switch (id) {
        case 'cash-receipt': return <CreditCard className="w-5 h-5 text-indigo-500" />;
        case 'petty-cash': return <Wallet className="w-5 h-5 text-emerald-500" />;
        case 'debit': return <BarChart3 className="w-5 h-5 text-rose-500" />;
        case 'sales': return <TrendingUp className="w-5 h-5 text-blue-500" />;
        case 'inventory': return <Package className="w-5 h-5 text-amber-500" />;
        case 'inventory-scrap': return <Trash2 className="w-5 h-5 text-orange-500" />;
        case 'wh20-items': return <Warehouse className="w-5 h-5 text-cyan-500" />;
        case 'suppliers': return <Truck className="w-5 h-5 text-purple-500" />;
        case 'customers-summaries': return <FileText className="w-5 h-5 text-teal-500" />;
        case 'customers-documents': return <FileCheck className="w-5 h-5 text-pink-500" />;
        case 'documents-tracking': return <ClipboardList className="w-5 h-5 text-violet-500" />;
        case 'lpo-management': return <ShoppingCart className="w-5 h-5 text-fuchsia-500" />;
        case 'database': return <Database className="w-5 h-5 text-slate-500" />;
        default: return <Settings className="w-5 h-5 text-slate-500" />;
    }
};

const getUserInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getAvatarGradient = (name: string) => {
    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-purple-500 to-indigo-600',
        'from-cyan-500 to-sky-600'
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
        sum += name.charCodeAt(i);
    }
    return gradients[sum % gradients.length];
};

export default function AdminControlTab() {
    const [users, setUsers] = useState<UserPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [modalSystem, setModalSystem] = useState<string | null>(null);
    const [modalInnerTab, setModalInnerTab] = useState<'tabs' | 'actions'>('tabs');
    const [systemSearch, setSystemSearch] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/DataBase/Users/api');
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
            // Handle legacy 'Admin' role
            if (roleStr === 'Admin') {
                const allSystems = SYSTEMS.map(s => s.id);
                const allSubTabs: Record<string, string[]> = {};
                Object.keys(SYSTEM_SUBTABS).forEach(sysId => {
                    allSubTabs[sysId] = SYSTEM_SUBTABS[sysId].map(t => t.id);
                });
                const allActions: Record<string, string[]> = {};
                Object.keys(SYSTEM_ACTIONS).forEach(sysId => {
                    allActions[`${sysId}-actions`] = SYSTEM_ACTIONS[sysId].map(a => a.id);
                });
                return { systems: allSystems, ...allSubTabs, ...allActions };
            }
            return {};
        }
    };

    const handleToggleSystem = (systemId: string) => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);
        const currentSystems = perms.systems !== undefined ? perms.systems : SYSTEMS.map(s => s.id);
        const isEnabled = currentSystems.includes(systemId);

        let newSystems;
        if (isEnabled) {
            newSystems = currentSystems.filter((id: string) => id !== systemId);
        } else {
            newSystems = [...currentSystems, systemId];
        }

        setSelectedUser({
            ...selectedUser,
            role: JSON.stringify({ ...perms, systems: newSystems })
        });
    };

    const handleToggleSubTab = (systemId: string, tabId: string) => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);
        const key = systemId;
        const currentTabs = perms[key] !== undefined ? perms[key] : (SYSTEM_SUBTABS[systemId] || []).map(t => t.id);
        const newTabs = currentTabs.includes(tabId)
            ? currentTabs.filter((id: string) => id !== tabId)
            : [...currentTabs, tabId];
        setSelectedUser({ ...selectedUser, role: JSON.stringify({ ...perms, [key]: newTabs }) });
    };

    const handleToggleAction = (systemId: string, actionId: string) => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);
        const key = `${systemId}-actions`;
        const currentActions = perms[key] !== undefined ? perms[key] : (SYSTEM_ACTIONS[systemId] || []).map(a => a.id);
        const newActions = currentActions.includes(actionId)
            ? currentActions.filter((id: string) => id !== actionId)
            : [...currentActions, actionId];
        setSelectedUser({ ...selectedUser, role: JSON.stringify({ ...perms, [key]: newActions }) });
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/DataBase/Users/api', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selectedUser.name, role: selectedUser.role })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Permissions updated successfully!' });
                setUsers(users.map(u => u.name === selectedUser.name ? selectedUser : u));
                setTimeout(() => setMessage({ type: '', text: '' }), 4000);
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

    // Filter systems based on system search box
    const filteredSystems = useMemo(() => {
        const sorted = [...SYSTEMS].sort((a, b) => a.label.localeCompare(b.label));
        if (!systemSearch) return sorted;
        const q = systemSearch.toLowerCase();
        return sorted.filter(s => s.label.toLowerCase().includes(q));
    }, [systemSearch]);

    if (loading) return <Loading message="Loading Admin Control..." />;

    const renderSubTabModal = () => {
        if (!modalSystem || !selectedUser) return null;
        const system = SYSTEMS.find(s => s.id === modalSystem);
        const subTabs = [...(SYSTEM_SUBTABS[modalSystem] || [])].sort((a, b) => a.label.localeCompare(b.label));
        const perms = parsePermissions(selectedUser.role);
        const key = modalSystem;
        const subTabIds = subTabs.map(t => t.id);
        const enabledTabs = perms[key] !== undefined
            ? perms[key].filter((id: string) => subTabIds.includes(id))
            : subTabIds;
        const systemActions = SYSTEM_ACTIONS[modalSystem] || [];
        const actionIds = systemActions.map(a => a.id);
        const actionsKey = `${modalSystem}-actions`;
        const enabledActions = perms[actionsKey] !== undefined
            ? perms[actionsKey].filter((id: string) => actionIds.includes(id))
            : actionIds;
        const hasActions = systemActions.length > 0;

        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white/95 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/50 animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/10">
                                {getSystemIcon(modalSystem)}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{system?.label}</h3>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Configuration Panel</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setModalSystem(null); setModalInnerTab('tabs'); }}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Inner Tab Switcher — only show if system has actions */}
                    {hasActions && (
                        <div className="flex gap-1 p-2 bg-slate-50 border-b border-slate-100">
                            <button
                                onClick={() => setModalInnerTab('tabs')}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${modalInnerTab === 'tabs'
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-200/60'
                                    }`}
                            >
                                Sub-Tabs ({enabledTabs.length}/{subTabs.length})
                            </button>
                            <button
                                onClick={() => setModalInnerTab('actions')}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${modalInnerTab === 'actions'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-200/60'
                                    }`}
                            >
                                Actions ({enabledActions.length}/{systemActions.length})
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-3 no-scrollbar">
                        {/* Tabs panel */}
                        {(!hasActions || modalInnerTab === 'tabs') && (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Enable/Disable Specific Tabs</p>
                                {subTabs.map(tab => {
                                    const isEnabled = enabledTabs.includes(tab.id);
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleToggleSubTab(modalSystem, tab.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 text-left ${isEnabled
                                                ? 'border-slate-900 bg-slate-50 text-slate-900 shadow-sm'
                                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-700'
                                                }`}
                                        >
                                            <span className="font-bold text-sm">{tab.label}</span>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isEnabled ? 'bg-slate-900 text-white' : 'bg-slate-100 border border-slate-200'}`}>
                                                {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Actions panel */}
                        {hasActions && modalInnerTab === 'actions' && (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Configure Action-Level Access</p>
                                {systemActions.map(action => {
                                    const isEnabled = enabledActions.includes(action.id);
                                    return (
                                        <button
                                            key={action.id}
                                            onClick={() => handleToggleAction(modalSystem, action.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 text-left ${isEnabled
                                                ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900'
                                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-700'
                                                }`}
                                        >
                                            <span className="font-bold text-sm flex items-center gap-2.5">
                                                <span className="text-lg bg-white p-1 rounded shadow-sm border border-slate-100">{action.icon}</span>
                                                {action.label}
                                            </span>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 border border-slate-200'}`}>
                                                {isEnabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={() => { setModalSystem(null); setModalInnerTab('tabs'); }}
                            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95 text-sm uppercase tracking-wider"
                        >
                            Confirm Settings
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-500 pt-2">
            {renderSubTabModal()}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Panel: User List */}
                <div className="lg:col-span-4 bg-white rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden flex flex-col h-[800px] transition-all">
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-slate-900 text-white p-2 rounded-xl">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Users Management</h3>
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Select user to edit</p>
                            </div>
                        </div>

                        {/* Search Box */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 focus:border-slate-900 rounded-2xl text-sm font-semibold outline-none transition-all placeholder-slate-400"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Users List Container */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                        {filteredUsers.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-bold italic">No users found</div>
                        ) : (
                            filteredUsers.map((user) => {
                                const isSelected = selectedUser?.name === user.name;
                                return (
                                    <button
                                        key={user.name}
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setMessage({ type: '', text: '' });
                                        }}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-200 ${isSelected
                                                ? 'border-slate-950 bg-slate-50 text-slate-900 shadow-md shadow-slate-100'
                                                : 'border-transparent bg-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.name)} text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0`}>
                                                {getUserInitials(user.name)}
                                            </div>
                                            <div className="text-left truncate">
                                                <p className="font-bold text-sm truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                    {user.name === 'MED Sabry' ? 'Super Admin' : 'System User'}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'translate-x-1 text-slate-900' : ''}`} />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel: Permissions Config */}
                <div className="lg:col-span-8 bg-white rounded-3xl shadow-xl border border-slate-200/50 p-6 md:p-8 h-[800px] flex flex-col transition-all">
                    {selectedUser ? (
                        <>
                            {/* Profile Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(selectedUser.name)} text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100`}>
                                        {getUserInitials(selectedUser.name)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedUser.name}</h2>
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 mt-1">
                                            <Lock className="w-3 h-3 text-slate-500" /> Custom Permissions
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 px-6 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-black hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-slate-200 shrink-0 min-w-[160px]"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            <span>Saving Changes...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Save Changes</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Toast Notification */}
                            {message.text && (
                                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
                                    }`}>
                                    {message.type === 'success' ? (
                                        <div className="bg-emerald-500 text-white p-1 rounded-lg"><Check className="w-4 h-4 stroke-[3]" /></div>
                                    ) : (
                                        <div className="bg-rose-500 text-white p-1 rounded-lg"><AlertCircle className="w-4 h-4 stroke-[3]" /></div>
                                    )}
                                    <span className="font-bold text-sm">{message.text}</span>
                                </div>
                            )}

                            {/* Section Controls */}
                            <div className="mb-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search system modules..."
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200/80 rounded-xl text-xs font-semibold outline-none focus:border-slate-900 transition-all placeholder-slate-400 bg-slate-50/50 focus:bg-white"
                                        value={systemSearch}
                                        onChange={(e) => setSystemSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> {filteredSystems.length} modules
                                </div>
                            </div>

                            {/* Grid of Systems */}
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                                    {filteredSystems.map((system) => {
                                        const permissions = parsePermissions(selectedUser.role);
                                        const isEnabled = permissions.systems !== undefined
                                            ? permissions.systems.includes(system.id)
                                            : true;
                                        const hasSubTabs = !!SYSTEM_SUBTABS[system.id];
                                        const subTabs = SYSTEM_SUBTABS[system.id] || [];
                                        const subTabIds = subTabs.map(t => t.id);
                                        const enabledTabsCount = subTabs.length > 0
                                            ? (permissions[system.id] !== undefined
                                                ? permissions[system.id].filter((id: string) => subTabIds.includes(id)).length
                                                : subTabs.length)
                                            : 0;

                                        return (
                                            <div
                                                key={system.id}
                                                className={`group rounded-2xl border-2 p-4 transition-all duration-200 flex flex-col justify-between ${isEnabled
                                                        ? 'border-slate-200 bg-white hover:border-slate-900 shadow-sm'
                                                        : 'border-slate-100 bg-slate-50/60 opacity-60 hover:opacity-90'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                                            {getSystemIcon(system.id)}
                                                        </div>
                                                        <div className="text-left">
                                                            <h4 className={`font-black text-sm transition-colors ${isEnabled ? 'text-slate-900 group-hover:text-slate-950' : 'text-slate-400'}`}>
                                                                {system.label}
                                                            </h4>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                                {isEnabled ? 'Access Granted' : 'Access Blocked'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleSystem(system.id)}
                                                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isEnabled
                                                                ? 'bg-slate-900 text-white shadow-md'
                                                                : 'bg-white border-2 border-slate-200 text-transparent hover:border-slate-400'
                                                            }`}
                                                    >
                                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                    </button>
                                                </div>

                                                {/* Configure Link */}
                                                {hasSubTabs && isEnabled && (
                                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                            {enabledTabsCount} / {subTabs.length} Tabs
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setModalSystem(system.id)}
                                                            className="text-[11px] text-slate-900 hover:text-black font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                                        >
                                                            Configure <ChevronRight className="w-3 h-3 stroke-[2]" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20 select-none">
                            <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl shadow-sm mb-4">
                                <ShieldAlert className="w-16 h-16 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-black text-slate-700 uppercase tracking-wider">Select a user</h3>
                            <p className="text-sm text-slate-400 font-semibold mt-1">Configure individual access modules and settings</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
