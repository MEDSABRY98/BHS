'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Shield, Check, X, Search, Settings, Save, AlertCircle, ChevronRight, Layers,
    CreditCard, Wallet, BarChart3, TrendingUp, Package, Truck, FileCheck,
    ClipboardList, ShoppingCart, Database, Users, Sparkles, Trash2, ListChecks, FileSpreadsheet, ArrowLeft, CheckCheck, Ban, Hash
} from 'lucide-react';
import Loading from '@/app/Components/Loading';
import NoData from '@/app/Components/NoDataTab';
import { fetchUsersList, updateUserRole } from '@/app/DataBase/Service/database_service';

interface UserPermissions {
    name: string;
    role: string;
}

const INVENTORY_COUNTING_TAB_IDS = ['total_count', 'user_comparison', 'normal_total', 'damage_total', 'record'];
const LEGACY_INVENTORY_COUNTING_IDS = ['counting', 'normal_record', 'damage_record', ...INVENTORY_COUNTING_TAB_IDS];

const LEGACY_DB_TAB_IDS: Record<string, string> = {
    'db-inv-count-products': 'db-products',
    'db-inv-products': 'db-products',
    'db-suppliers-purchase': 'db-suppliers-purchase-details',
};

const SYSTEMS = [
    { id: 'cash-receipt', label: 'Cash Receipt' },
    { id: 'cash-handover', label: 'Cash Handover' },
    { id: 'petty-cash', label: 'Petty Cash' },
    { id: 'documents-tracking', label: 'Documents Tracking' },
    { id: 'customers-summaries', label: 'Customers Summaries' },
    { id: 'debit', label: 'Debit Analysis' },
    { id: 'customers-documents', label: 'Customers Documents' },
    { id: 'inventory', label: 'Inventory Analysis' },
    { id: 'inventory-item-code', label: 'Inventory Item Code' },
    { id: 'inventory-counting', label: 'Inventory Counting' },
    { id: 'inventory-scrap', label: 'Inventory Scrap' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'purchase-price-tracking', label: 'Purchase Price Tracking' },
    { id: 'sales', label: 'Sales Analysis' },
    { id: 'lpo-management', label: "LPO's" },
    { id: 'sales-reports-tables', label: 'Sales Reports Tables' },
    { id: 'customers-discounts', label: 'Customers Discounts' },
    { id: 'database', label: 'Database' },
];

const SYSTEM_SUBTABS: Record<string, { id: string, label: string }[]> = {
    'debit': [
        { id: 'customers', label: 'Customers' },
        { id: 'credit-limit', label: 'Credit Limit' },
        { id: 'customers-group', label: 'Customers Group' },
        { id: 'payment-reconciliation', label: 'Payment Reconciliation' },
        { id: 'all-transactions', label: 'All Transactions' },
        { id: 'customers-open-matches', label: 'Open Transactions' },
        { id: 'payment-tracker', label: 'Payment Tracker' },
        { id: 'salesreps', label: 'Sales Reps' },
        { id: 'history', label: 'History' },
        { id: 'ages', label: 'Ages' }
    ],
    'sales': [
        { id: 'sales-overview', label: 'Overview' },
        { id: 'sales-top10', label: 'Top 10' },
        { id: 'sales-customers', label: 'Customers' },
        { id: 'sales-customers-comparison', label: 'Comparison' },
        { id: 'sales-inactive-customers', label: 'Inactive Customers' },
        { id: 'sales-statistics', label: 'Statistics' },
        { id: 'sales-reports', label: 'Reports' },
        { id: 'sales-targets', label: 'Targets' },
        { id: 'sales-daily-sales', label: 'Daily Sales' },
        { id: 'sales-categories', label: 'Product Category' },
        { id: 'sales-products', label: 'Products' },
        { id: 'sales-new-listings', label: 'New Listings' },
        { id: 'sales-download-form', label: 'Stock Report' },
        { id: 'sales-my-customers', label: 'Set Customers' },
    ],
    'sales-reports-tables': [
        { id: 'sales-invoices', label: 'Sales Invoices' },
        { id: 'return-invoices', label: 'Returns' },
        { id: 'top-customers', label: 'Top Customers' },
        { id: 'top-return-customers', label: 'Return Customers' },
        { id: 'growing', label: 'Growing' },
        { id: 'declining', label: 'Declining' },
        { id: 'at-risk', label: 'At-Risk' },
        { id: 'products', label: 'Products' },
        { id: 'categories', label: 'Categories' },
    ],
    'inventory': [
        { id: 'products_balance', label: 'Products Balance' },
        { id: 'inventory_count', label: 'Inventory Count' },
        { id: 'categories', label: 'Categories Analysis' },
    ],
    'inventory-counting': [
        { id: 'total_count', label: 'Total Count' },
        { id: 'user_comparison', label: 'User Comparison' },
        { id: 'normal_total', label: 'Normal Count' },
        { id: 'damage_total', label: 'Damage & Expire Count' },
        { id: 'record', label: 'Record' },
    ],
    'inventory-scrap': [
        { id: 'record', label: 'Log Scrap' },
        { id: 'sessions', label: 'View Sessions' },
        { id: 'report', label: 'Scrap Report' },
        { id: 'history', label: 'Saved Reports' },
    ],
    'cash-receipt': [
        { id: 'new', label: 'New Receipt' },
        { id: 'saved', label: 'Saved Receipts' },
        { id: 'stats', label: 'Statistics' },
    ],
    'cash-handover': [
        { id: 'new', label: 'New Handover' },
        { id: 'saved', label: 'Saved Handovers' }
    ],
    'petty-cash': [
        { id: 'receipts', label: 'Receipts' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'voucher', label: 'Voucher' },
        { id: 'stats', label: 'Statistics' },
        { id: 'history', label: 'History' },
    ],
    'suppliers': [
        { id: 'statements', label: 'Statements' },
        { id: 'matching', label: 'Matching' },
    ],
    'documents-tracking': [
        { id: 'register', label: 'تسجيل شيك جديد' },
        { id: 'list', label: 'استعراض الشيكات' },
        { id: 'receivers', label: 'مستلمي المكتب' },
    ],
    'lpo-management': [
        { id: 'lpo-dashboard', label: 'Dashboard' },
        { id: 'lpo-orders', label: 'Orders' },
        { id: 'lpo-create-orders', label: 'Create Orders' },
        { id: 'lpo-reports', label: 'Reports' }
    ],
    'database': [
        { id: 'db-customers', label: 'Customers DB' },
        { id: 'db-debit', label: 'Debit DB' },
        { id: 'db-emails', label: 'Emails DB' },
        { id: 'db-lulu-emails', label: 'Lulu Emails DB' },
        { id: 'db-products', label: 'Products DB' },
        { id: 'db-inv-itemcode', label: 'Inventory Item Code' },
        { id: 'db-inv-moves', label: 'Inventory Moves' },
        { id: 'db-sales', label: 'Sales DB' },
        { id: 'db-suppliers', label: 'Suppliers DB' },
        { id: 'db-suppliers-invoices', label: 'Suppliers Invoices' },
        { id: 'db-suppliers-refund', label: 'Suppliers Refund' },
        { id: 'db-suppliers-purchase-details', label: 'Suppliers Purchase Details' },
        { id: 'db-personnel', label: 'Personnel DB' },
        { id: 'db-users', label: 'Users DB' },
    ],
    'purchase-price-tracking': [
        { id: 'product-history', label: 'Product History' },
        { id: 'supplier-comparison', label: 'Supplier Comparison' },
        { id: 'supplier-history', label: 'Supplier History' },
        { id: 'reports', label: 'Excel Reports' },
    ],
    'customers-discounts': [
        { id: 'grid', label: 'Customers List' },
        { id: 'months', label: 'Monthly Overview' },
        { id: 'stats', label: 'Statistics' },
        { id: 'add', label: 'Add New Config' },
        { id: 'details', label: 'Discount Details' },
        { id: 'pending', label: 'Pending' },
        { id: 'semi', label: 'Semi Settled' },
        { id: 'settled', label: 'Settled' },
    ],
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
        case 'sales-reports-tables': return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
        case 'inventory': return <Package className="w-5 h-5 text-amber-500" />;
        case 'inventory-item-code': return <Hash className="w-5 h-5 text-blue-500" />;
        case 'inventory-counting': return <ListChecks className="w-5 h-5 text-blue-500" />;
        case 'inventory-scrap': return <Trash2 className="w-5 h-5 text-orange-500" />;
        case 'suppliers': return <Truck className="w-5 h-5 text-purple-500" />;
        case 'customers-summaries': return <FileSpreadsheet className="w-5 h-5 text-teal-500" />;
        case 'customers-documents': return <FileCheck className="w-5 h-5 text-pink-500" />;
        case 'documents-tracking': return <ClipboardList className="w-5 h-5 text-violet-500" />;
        case 'lpo-management': return <ShoppingCart className="w-5 h-5 text-fuchsia-500" />;
        case 'cash-handover': return <ClipboardList className="w-5 h-5 text-purple-600" />;
        case 'purchase-price-tracking': return <Layers className="w-5 h-5 text-blue-600" />;
        case 'customers-discounts': return <Shield className="w-5 h-5 text-amber-500" />;
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

const CARD_GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4';

export default function AdminControlTab() {
    const [users, setUsers] = useState<UserPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
    const [view, setView] = useState<'users' | 'modules'>('users');
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
            const data = await fetchUsersList();
            if (data.success && data.users) {
                const sortedUsers = data.users.sort((a: any, b: any) => a.name.localeCompare(b.name));
                setUsers(sortedUsers);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const normalizePermissions = (perms: Record<string, any>) => {
        const next = { ...perms };

        if (Array.isArray(next['inventory-counting'])) {
            const countingTabs = next['inventory-counting'] as string[];
            const hasLegacyRecord =
                countingTabs.includes('normal_record') || countingTabs.includes('damage_record');

            if (hasLegacyRecord) {
                const migratedTabs = countingTabs.filter(
                    (id) => id !== 'normal_record' && id !== 'damage_record'
                );
                if (!migratedTabs.includes('record')) migratedTabs.push('record');
                next['inventory-counting'] = migratedTabs;
            }
        }

        if (Array.isArray(next.inventory)) {
            const legacyCounting = next.inventory.filter((id: string) => LEGACY_INVENTORY_COUNTING_IDS.includes(id));

            if (legacyCounting.length > 0) {
                const currentCounting = Array.isArray(next['inventory-counting']) ? next['inventory-counting'] : [];
                const migratedTabs = [
                    ...currentCounting,
                    ...legacyCounting.filter((id: string) => INVENTORY_COUNTING_TAB_IDS.includes(id)),
                    ...(legacyCounting.includes('counting') ? INVENTORY_COUNTING_TAB_IDS : []),
                ];

                next['inventory-counting'] = [...new Set(migratedTabs)];
                next.inventory = next.inventory.filter((id: string) => !LEGACY_INVENTORY_COUNTING_IDS.includes(id));

                const systems = Array.isArray(next.systems) ? next.systems : SYSTEMS.map(s => s.id);
                if (!systems.includes('inventory-counting')) {
                    next.systems = [...systems, 'inventory-counting'];
                }
            }
        }

        if (Array.isArray(next.database)) {
            next.database = [
                ...new Set(
                    next.database.map((id: string) => LEGACY_DB_TAB_IDS[id] || id),
                ),
            ];
        }

        return next;
    };

    const parsePermissions = (roleStr: string) => {
        try {
            return normalizePermissions(JSON.parse(roleStr || '{}'));
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

    const handleEnableAllSystems = () => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);
        setSelectedUser({
            ...selectedUser,
            role: JSON.stringify({ ...perms, systems: SYSTEMS.map(s => s.id) })
        });
    };

    const handleDisableAllSystems = () => {
        if (!selectedUser) return;
        const perms = parsePermissions(selectedUser.role);
        setSelectedUser({
            ...selectedUser,
            role: JSON.stringify({ ...perms, systems: [] })
        });
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const normalizedRole = JSON.stringify(normalizePermissions(parsePermissions(selectedUser.role)));
            const result = await updateUserRole(selectedUser.name, normalizedRole);
            if (result.success) {
                setMessage({ type: 'success', text: 'Permissions updated successfully!' });
                const savedUser = { ...selectedUser, role: normalizedRole };
                setSelectedUser(savedUser);
                setUsers(users.map(u => u.name === savedUser.name ? savedUser : u));
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

    const filteredSystems = useMemo(() => {
        const sorted = [...SYSTEMS].sort((a, b) => a.label.localeCompare(b.label));
        if (!systemSearch) return sorted;
        const q = systemSearch.toLowerCase();
        return sorted.filter(s => s.label.toLowerCase().includes(q));
    }, [systemSearch]);

    const getEnabledSystemsCount = (roleStr: string) => {
        const perms = parsePermissions(roleStr);
        const currentSystems = perms.systems !== undefined ? perms.systems : SYSTEMS.map(s => s.id);
        return currentSystems.length;
    };

    const openUserModules = (user: UserPermissions) => {
        const normalizedRole = JSON.stringify(normalizePermissions(parsePermissions(user.role)));
        setSelectedUser({ ...user, role: normalizedRole });
        setMessage({ type: '', text: '' });
        setSystemSearch('');
        setView('modules');
    };

    const backToUsers = () => {
        setView('users');
        setModalSystem(null);
        setModalInnerTab('tabs');
    };

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
        <div className="max-w-[1600px] mx-auto p-4 md:p-6 animate-in fade-in duration-500">
            {renderSubTabModal()}

            {/* Top bar */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 md:p-6 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        {view === 'modules' && selectedUser && (
                            <button
                                onClick={backToUsers}
                                className="p-3 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-2xl transition-all shrink-0"
                                title="Back to users"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shrink-0">
                                {view === 'users' ? <Users className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 truncate">
                                    {view === 'users' ? 'Users Management' : selectedUser?.name}
                                </h2>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                    {view === 'users'
                                        ? 'Select a user to configure modules'
                                        : 'Enable modules and configure tabs'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 sm:min-w-[260px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder={view === 'users' ? 'Search users...' : 'Search modules...'}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 focus:border-slate-900 rounded-2xl text-sm font-semibold outline-none transition-all placeholder-slate-400"
                                value={view === 'users' ? search : systemSearch}
                                onChange={(e) => view === 'users' ? setSearch(e.target.value) : setSystemSearch(e.target.value)}
                            />
                        </div>

                        {view === 'modules' && selectedUser && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                title="Save changes"
                                className="flex items-center justify-center bg-slate-900 text-white p-3 rounded-2xl hover:bg-black transition-all disabled:opacity-50 shadow-lg shrink-0"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {message.text && view === 'modules' && (
                    <div className={`mt-4 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 ${
                        message.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            : 'bg-rose-50 text-rose-800 border border-rose-100'
                    }`}>
                        {message.type === 'success' ? (
                            <div className="bg-emerald-500 text-white p-1 rounded-lg"><Check className="w-4 h-4 stroke-[3]" /></div>
                        ) : (
                            <div className="bg-rose-500 text-white p-1 rounded-lg"><AlertCircle className="w-4 h-4 stroke-[3]" /></div>
                        )}
                        <span className="font-bold text-sm">{message.text}</span>
                    </div>
                )}
            </div>

            {/* Users grid */}
            {view === 'users' && (
                filteredUsers.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-12">
                        <NoData title="No users found" />
                    </div>
                ) : (
                    <div className={CARD_GRID}>
                        {filteredUsers.map((user) => (
                            <button
                                key={user.name}
                                onClick={() => openUserModules(user)}
                                className="group bg-white rounded-3xl border-2 border-slate-100 hover:border-slate-900 hover:shadow-lg p-5 text-left transition-all duration-200 flex flex-col min-h-[180px]"
                            >
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(user.name)} text-white flex items-center justify-center font-black text-lg shadow-md mb-4`}>
                                    {getUserInitials(user.name)}
                                </div>
                                <h3 className="font-black text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-slate-950">
                                    {user.name}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                                    {user.name === 'MED Sabry' ? 'Super Admin' : 'System User'}
                                </p>
                                <div className="mt-auto pt-4 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">
                                        {getEnabledSystemsCount(user.role)} / {SYSTEMS.length} Modules
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                )
            )}

            {/* Modules grid */}
            {view === 'modules' && selectedUser && (
                filteredSystems.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-12">
                        <NoData title="No modules found" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 mb-4 px-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest min-w-0">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate">{filteredSystems.length} modules · toggle access · click card to configure tabs</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleEnableAllSystems}
                                    title="Enable all modules"
                                    className="p-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDisableAllSystems}
                                    title="Disable all modules"
                                    className="p-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all"
                                >
                                    <Ban className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className={CARD_GRID}>
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
                                        onClick={() => {
                                            if (isEnabled && hasSubTabs) setModalSystem(system.id);
                                        }}
                                        className={`rounded-3xl border-2 p-4 transition-all duration-200 flex flex-col min-h-[170px] ${
                                            isEnabled
                                                ? 'border-slate-200 bg-white hover:border-slate-900 hover:shadow-md'
                                                : 'border-slate-100 bg-slate-50/70 opacity-75'
                                        } ${isEnabled && hasSubTabs ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                                {getSystemIcon(system.id)}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSystem(system.id);
                                                }}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                                    isEnabled
                                                        ? 'bg-slate-900 text-white shadow-md'
                                                        : 'bg-white border-2 border-slate-200 text-transparent hover:border-slate-400'
                                                }`}
                                                title={isEnabled ? 'Disable module' : 'Enable module'}
                                            >
                                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                            </button>
                                        </div>

                                        <h4 className={`font-black text-sm leading-snug line-clamp-2 ${isEnabled ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {system.label}
                                        </h4>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {isEnabled ? 'Available' : 'Blocked'}
                                        </p>

                                        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                            {hasSubTabs ? (
                                                <>
                                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                        {enabledTabsCount}/{subTabs.length} tabs
                                                    </span>
                                                    {isEnabled && (
                                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-0.5">
                                                            Configure <ChevronRight className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                    No sub-tabs
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )
            )}
        </div>
    );
}
