'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Shield, Check, X, Search, Settings, Save, AlertCircle, ChevronRight, Layers,
    CreditCard, Wallet, BarChart3, TrendingUp, Package, Truck, FileCheck,
    ClipboardList, ShoppingCart, Database, Users, Sparkles, Trash2, ListChecks, FileSpreadsheet, ArrowLeft, CheckCheck, Ban, Hash, UserPlus, LayoutGrid
} from 'lucide-react';
import Loading from '@/app/Components/Loading';
import NoData from '@/app/Components/NoDataTab';
import { fetchUsersList, updateUserRole } from '@/app/DataBase/Service/database_service';

interface UserPermissions {
    name: string;
    role: string;
}

const INVENTORY_COUNTING_VIEW_TAB_IDS = [
    'total_count',
    'count',
    'reconciliation',
    'user_comparison',
    'record',
] as const;

const INVENTORY_COUNTING_TAB_IDS = [
    ...INVENTORY_COUNTING_VIEW_TAB_IDS,
    'close_session',
] as const;

const LEGACY_INVENTORY_COUNTING_IDS = [
    'counting',
    'inventory_count',
    'normal_record',
    'damage_record',
    'normal_total',
    'damage_total',
] as const;

function migrateInventoryCountingTabs(tabs: string[]): string[] {
    let result = [...tabs];

    if (result.some((id) => id === 'normal_record' || id === 'damage_record')) {
        result = result.filter((id) => id !== 'normal_record' && id !== 'damage_record');
        if (!result.includes('record')) result.push('record');
    }

    if (result.some((id) => id === 'normal_total' || id === 'damage_total')) {
        result = result.filter((id) => id !== 'normal_total' && id !== 'damage_total');
        if (!result.includes('count')) result.push('count');
    }

    if (result.includes('inventory_count')) {
        result = result.filter((id) => id !== 'inventory_count');
        if (!result.includes('reconciliation')) result.push('reconciliation');
    }

    if (result.includes('counting')) {
        result = result.filter((id) => id !== 'counting');
        result = [...new Set([...result, ...INVENTORY_COUNTING_VIEW_TAB_IDS])];
    }

    result = result.filter((id) => !LEGACY_INVENTORY_COUNTING_IDS.includes(id as typeof LEGACY_INVENTORY_COUNTING_IDS[number]));
    result = result.filter((id) => INVENTORY_COUNTING_TAB_IDS.includes(id as typeof INVENTORY_COUNTING_TAB_IDS[number]));

    return [...new Set(result)];
}

function migrateInventoryPermissionsFromLegacyInventory(inventoryTabs: string[], countingTabs: string[]) {
    let migratedCounting = [...countingTabs];
    const legacyInInventory = inventoryTabs.filter((id) =>
        LEGACY_INVENTORY_COUNTING_IDS.includes(id as typeof LEGACY_INVENTORY_COUNTING_IDS[number])
        || INVENTORY_COUNTING_TAB_IDS.includes(id as typeof INVENTORY_COUNTING_TAB_IDS[number])
    );

    if (legacyInInventory.length === 0) {
        return { countingTabs: migratedCounting, inventoryTabs };
    }

    migratedCounting = [
        ...migratedCounting,
        ...legacyInInventory.filter((id) => INVENTORY_COUNTING_TAB_IDS.includes(id as typeof INVENTORY_COUNTING_TAB_IDS[number])),
    ];

    if (legacyInInventory.includes('counting')) {
        migratedCounting = [...new Set([...migratedCounting, ...INVENTORY_COUNTING_VIEW_TAB_IDS])];
    }

    return {
        countingTabs: migrateInventoryCountingTabs(migratedCounting),
        inventoryTabs: inventoryTabs.filter(
            (id) =>
                !LEGACY_INVENTORY_COUNTING_IDS.includes(id as typeof LEGACY_INVENTORY_COUNTING_IDS[number])
                && !INVENTORY_COUNTING_TAB_IDS.includes(id as typeof INVENTORY_COUNTING_TAB_IDS[number])
        ),
    };
}

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
        { id: 'location_movements', label: 'Location Movements In/Out' },
        { id: 'category_balance', label: 'Categories Balance' },
        { id: 'categories', label: 'Categories Analysis' },
        { id: 'reports', label: 'Reports' },
    ],
    'inventory-counting': [
        { id: 'total_count', label: 'Total Count' },
        { id: 'count', label: 'Count' },
        { id: 'reconciliation', label: 'Count Reconciliation' },
        { id: 'user_comparison', label: 'User Comparison' },
        { id: 'record', label: 'Record' },
        { id: 'close_session', label: 'Close Count Session' },
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
    ],
    'purchase-price-tracking': [
        { id: 'edit-price', label: 'Edit Purchase Line Price', icon: '✏️' },
    ],
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

function isSuperAdminUser(name: string) {
    return name.trim().toLowerCase() === 'med sabry';
}

function getUserEnabledSystems(perms: Record<string, unknown>) {
    return Array.isArray(perms.systems) ? (perms.systems as string[]) : SYSTEMS.map((s) => s.id);
}

function userHasSystemAccess(roleStr: string, systemId: string, parsePermissions: (role: string) => Record<string, unknown>) {
    if (roleStr === 'Admin') return true;
    const perms = parsePermissions(roleStr);
    return getUserEnabledSystems(perms).includes(systemId);
}

function setUserSystemAccess(
    user: UserPermissions,
    systemId: string,
    enabled: boolean,
    parsePermissions: (role: string) => Record<string, unknown>,
) {
    const perms = parsePermissions(user.role);
    const currentSystems = getUserEnabledSystems(perms);
    const nextSystems = enabled
        ? [...new Set([...currentSystems, systemId])]
        : currentSystems.filter((id) => id !== systemId);

    return {
        ...user,
        role: JSON.stringify({ ...perms, systems: nextSystems }),
    };
}

function getUserEnabledActions(
    roleStr: string,
    systemId: string,
    parsePermissions: (role: string) => Record<string, unknown>,
) {
    const allActionIds = (SYSTEM_ACTIONS[systemId] || []).map((a) => a.id);
    if (roleStr === 'Admin') return allActionIds;

    const perms = parsePermissions(roleStr);
    const key = `${systemId}-actions`;
    if (Array.isArray(perms[key])) {
        return (perms[key] as string[]).filter((id) => allActionIds.includes(id));
    }
    return allActionIds;
}

function userHasActionAccess(
    roleStr: string,
    systemId: string,
    actionId: string,
    parsePermissions: (role: string) => Record<string, unknown>,
) {
    return getUserEnabledActions(roleStr, systemId, parsePermissions).includes(actionId);
}

function setUserActionAccess(
    user: UserPermissions,
    systemId: string,
    actionId: string,
    enabled: boolean,
    parsePermissions: (role: string) => Record<string, unknown>,
) {
    const perms = parsePermissions(user.role);
    const key = `${systemId}-actions`;
    const allActionIds = (SYSTEM_ACTIONS[systemId] || []).map((a) => a.id);
    const currentActions = Array.isArray(perms[key])
        ? (perms[key] as string[]).filter((id) => allActionIds.includes(id))
        : [...allActionIds];
    const nextActions = enabled
        ? [...new Set([...currentActions, actionId])]
        : currentActions.filter((id) => id !== actionId);

    return {
        ...user,
        role: JSON.stringify({ ...perms, [key]: nextActions }),
    };
}

export default function AdminControlTab() {
    const [users, setUsers] = useState<UserPermissions[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
    const [view, setView] = useState<'users' | 'modules'>('users');
    const [adminMode, setAdminMode] = useState<'by-user' | 'by-module'>('by-user');
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [moduleUserSearch, setModuleUserSearch] = useState('');
    const [moduleUserSaving, setModuleUserSaving] = useState<string | null>(null);
    const [moduleDetailTab, setModuleDetailTab] = useState<'access' | 'actions'>('access');
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
            next['inventory-counting'] = migrateInventoryCountingTabs(next['inventory-counting'] as string[]);
        }

        if (Array.isArray(next.inventory)) {
            const inventoryTabs = next.inventory as string[];
            const currentCounting = Array.isArray(next['inventory-counting'])
                ? (next['inventory-counting'] as string[])
                : [];

            const migrated = migrateInventoryPermissionsFromLegacyInventory(inventoryTabs, currentCounting);
            next['inventory-counting'] = migrated.countingTabs;
            next.inventory = migrated.inventoryTabs;

            const hadLegacyCounting =
                inventoryTabs.length !== migrated.inventoryTabs.length
                || currentCounting.length !== migrated.countingTabs.length;

            if (hadLegacyCounting && migrated.countingTabs.length > 0) {
                const systems = Array.isArray(next.systems) ? next.systems : SYSTEMS.map((s) => s.id);
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

    const backToModuleList = () => {
        setSelectedModuleId(null);
        setModuleUserSearch('');
        setModuleDetailTab('access');
        setMessage({ type: '', text: '' });
    };

    const switchAdminMode = (mode: 'by-user' | 'by-module') => {
        setAdminMode(mode);
        setView('users');
        setSelectedUser(null);
        setSelectedModuleId(null);
        setModalSystem(null);
        setModalInnerTab('tabs');
        setModuleDetailTab('access');
        setSearch('');
        setSystemSearch('');
        setModuleUserSearch('');
        setMessage({ type: '', text: '' });
    };

    const openModuleUsers = (systemId: string) => {
        setSelectedModuleId(systemId);
        setModuleUserSearch('');
        setModuleDetailTab('access');
        setMessage({ type: '', text: '' });
    };

    const getModuleUsersCount = (systemId: string) =>
        users.filter((u) => userHasSystemAccess(u.role, systemId, parsePermissions)).length;

    const persistUserRole = async (user: UserPermissions) => {
        const normalizedRole = JSON.stringify(normalizePermissions(parsePermissions(user.role)));
        const result = await updateUserRole(user.name, normalizedRole);
        if (!result.success) throw new Error('Failed to update');

        const savedUser = { ...user, role: normalizedRole };
        setUsers((prev) => prev.map((u) => (u.name === savedUser.name ? savedUser : u)));
        if (selectedUser?.name === savedUser.name) setSelectedUser(savedUser);
        return savedUser;
    };

    const handleModuleUserAccess = async (userName: string, enabled: boolean) => {
        if (!selectedModuleId) return;

        const user = users.find((u) => u.name === userName);
        if (!user) return;
        if (!enabled && isSuperAdminUser(user.name)) return;

        setModuleUserSaving(userName);
        setMessage({ type: '', text: '' });

        try {
            const updatedUser = setUserSystemAccess(user, selectedModuleId, enabled, parsePermissions);
            await persistUserRole(updatedUser);
            setMessage({
                type: 'success',
                text: enabled
                    ? `${userName} added to module successfully.`
                    : `${userName} removed from module successfully.`,
            });
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch {
            setMessage({ type: 'error', text: 'Update failed. Please try again.' });
        } finally {
            setModuleUserSaving(null);
        }
    };

    const handleModuleUserAction = async (userName: string, actionId: string, enabled: boolean) => {
        if (!selectedModuleId) return;

        const user = users.find((u) => u.name === userName);
        if (!user) return;
        if (isSuperAdminUser(user.name)) return;

        setModuleUserSaving(`${userName}:${actionId}`);
        setMessage({ type: '', text: '' });

        try {
            const updatedUser = setUserActionAccess(user, selectedModuleId, actionId, enabled, parsePermissions);
            await persistUserRole(updatedUser);
            const actionLabel = SYSTEM_ACTIONS[selectedModuleId]?.find((a) => a.id === actionId)?.label || actionId;
            setMessage({
                type: 'success',
                text: enabled
                    ? `${userName} can now use "${actionLabel}".`
                    : `${userName} can no longer use "${actionLabel}".`,
            });
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch {
            setMessage({ type: 'error', text: 'Update failed. Please try again.' });
        } finally {
            setModuleUserSaving(null);
        }
    };

    const selectedModuleActions = selectedModuleId ? (SYSTEM_ACTIONS[selectedModuleId] || []) : [];
    const selectedModuleHasActions = selectedModuleActions.length > 0;

    const moduleAssignedUsers = useMemo(() => {
        if (!selectedModuleId) return [];
        const lower = moduleUserSearch.toLowerCase();
        return users
            .filter((u) => userHasSystemAccess(u.role, selectedModuleId, parsePermissions))
            .filter((u) => u.name.toLowerCase().includes(lower))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, selectedModuleId, moduleUserSearch]);

    const moduleAvailableUsers = useMemo(() => {
        if (!selectedModuleId) return [];
        const lower = moduleUserSearch.toLowerCase();
        return users
            .filter((u) => !userHasSystemAccess(u.role, selectedModuleId, parsePermissions))
            .filter((u) => !isSuperAdminUser(u.name))
            .filter((u) => u.name.toLowerCase().includes(lower))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, selectedModuleId, moduleUserSearch]);

    if (loading) return <Loading message="Loading Admin Control..." />;

    const renderSubTabModal = () => {
        if (!modalSystem || !selectedUser) return null;
        const system = SYSTEMS.find(s => s.id === modalSystem);
        const subTabsRaw = SYSTEM_SUBTABS[modalSystem] || [];
        const subTabs = modalSystem === 'inventory-counting'
            ? subTabsRaw
            : [...subTabsRaw].sort((a, b) => a.label.localeCompare(b.label));
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
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        {((adminMode === 'by-user' && view === 'modules' && selectedUser)
                            || (adminMode === 'by-module' && selectedModuleId)) && (
                            <button
                                onClick={adminMode === 'by-user' ? backToUsers : backToModuleList}
                                className="p-3 bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-2xl transition-all shrink-0"
                                title={adminMode === 'by-user' ? 'Back to users' : 'Back to modules'}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex items-center gap-3 min-w-0 shrink-0">
                            <div className="bg-slate-900 text-white p-3 rounded-2xl shrink-0">
                                {adminMode === 'by-module'
                                    ? <LayoutGrid className="w-6 h-6" />
                                    : view === 'users'
                                        ? <Users className="w-6 h-6" />
                                        : <Shield className="w-6 h-6" />}
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 truncate">
                                    {adminMode === 'by-module'
                                        ? (selectedModuleId
                                            ? SYSTEMS.find((s) => s.id === selectedModuleId)?.label
                                            : 'Modules Management')
                                        : view === 'users'
                                            ? 'Users Management'
                                            : selectedUser?.name}
                                </h2>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => switchAdminMode('by-user')}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            adminMode === 'by-user'
                                                ? 'bg-slate-900 text-white shadow-md'
                                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-400'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        By User
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => switchAdminMode('by-module')}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            adminMode === 'by-module'
                                                ? 'bg-slate-900 text-white shadow-md'
                                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-400'
                                        }`}
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        By Module
                                    </button>
                                </div>
                            </div>
                            {adminMode === 'by-user' && view === 'modules' && (
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
                                    Enable modules and configure tabs
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 sm:min-w-[260px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder={
                                    adminMode === 'by-module'
                                        ? (selectedModuleId ? 'Search users...' : 'Search modules...')
                                        : (view === 'users' ? 'Search users...' : 'Search modules...')
                                }
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 focus:border-slate-900 rounded-2xl text-sm font-semibold outline-none transition-all placeholder-slate-400"
                                value={
                                    adminMode === 'by-module'
                                        ? (selectedModuleId ? moduleUserSearch : systemSearch)
                                        : (view === 'users' ? search : systemSearch)
                                }
                                onChange={(e) => {
                                    if (adminMode === 'by-module') {
                                        if (selectedModuleId) setModuleUserSearch(e.target.value);
                                        else setSystemSearch(e.target.value);
                                    } else if (view === 'users') {
                                        setSearch(e.target.value);
                                    } else {
                                        setSystemSearch(e.target.value);
                                    }
                                }}
                            />
                        </div>

                        {adminMode === 'by-user' && view === 'modules' && selectedUser && (
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

                {message.text && ((adminMode === 'by-user' && view === 'modules') || (adminMode === 'by-module' && selectedModuleId)) && (
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

            {/* By User — users grid */}
            {adminMode === 'by-user' && view === 'users' && (
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

            {/* By User — modules grid */}
            {adminMode === 'by-user' && view === 'modules' && selectedUser && (
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

            {/* By Module — modules grid */}
            {adminMode === 'by-module' && !selectedModuleId && (
                filteredSystems.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-12">
                        <NoData title="No modules found" />
                    </div>
                ) : (
                    <div className={CARD_GRID}>
                        {filteredSystems.map((system) => {
                            const usersCount = getModuleUsersCount(system.id);
                            return (
                                <button
                                    key={system.id}
                                    type="button"
                                    onClick={() => openModuleUsers(system.id)}
                                    className="group bg-white rounded-3xl border-2 border-slate-100 hover:border-slate-900 hover:shadow-lg p-5 text-left transition-all duration-200 flex flex-col min-h-[170px]"
                                >
                                    <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-3">
                                        {getSystemIcon(system.id)}
                                    </div>
                                    <h4 className="font-black text-sm leading-snug line-clamp-2 text-slate-900 group-hover:text-slate-950">
                                        {system.label}
                                    </h4>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-slate-400">
                                        Module access
                                    </p>
                                    <div className="mt-auto pt-4 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">
                                            {usersCount} / {users.length} Users
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )
            )}

            {/* By Module — users for selected module */}
            {adminMode === 'by-module' && selectedModuleId && (
                <>
                    {selectedModuleHasActions && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            <button
                                type="button"
                                onClick={() => setModuleDetailTab('access')}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    moduleDetailTab === 'access'
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                Module Access
                            </button>
                            <button
                                type="button"
                                onClick={() => setModuleDetailTab('actions')}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    moduleDetailTab === 'actions'
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'
                                }`}
                            >
                                <ListChecks className="w-4 h-4" />
                                Actions
                            </button>
                        </div>
                    )}

                    {(!selectedModuleHasActions || moduleDetailTab === 'access') && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-5 md:p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Assigned Users</h3>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
                                    {moduleAssignedUsers.length} users with access
                                </p>
                            </div>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                Active
                            </span>
                        </div>

                        {moduleAssignedUsers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-10 text-center text-slate-400 font-bold text-sm">
                                No users assigned to this module yet.
                            </div>
                        ) : (
                            <div className="space-y-2 flex-1">
                                {moduleAssignedUsers.map((user) => {
                                    const isSaving = moduleUserSaving === user.name;
                                    const locked = isSuperAdminUser(user.name);

                                    return (
                                        <div
                                            key={user.name}
                                            className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.name)} text-white flex items-center justify-center font-black text-xs shrink-0`}>
                                                    {getUserInitials(user.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-900 truncate">{user.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        {locked ? 'Super Admin' : 'Has access'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!locked && (
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() => handleModuleUserAccess(user.name, false)}
                                                    className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all disabled:opacity-50 shrink-0"
                                                    title="Remove from module"
                                                >
                                                    {isSaving ? (
                                                        <div className="w-4 h-4 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/60 p-5 md:p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Add Users</h3>
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
                                    {moduleAvailableUsers.length} users without access
                                </p>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                Available
                            </span>
                        </div>

                        {moduleAvailableUsers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-10 text-center text-slate-400 font-bold text-sm">
                                All users already have access to this module.
                            </div>
                        ) : (
                            <div className="space-y-2 flex-1">
                                {moduleAvailableUsers.map((user) => {
                                    const isSaving = moduleUserSaving === user.name;

                                    return (
                                        <div
                                            key={user.name}
                                            className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-300 transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.name)} text-white flex items-center justify-center font-black text-xs shrink-0`}>
                                                    {getUserInitials(user.name)}
                                                </div>
                                                <p className="font-bold text-slate-900 truncate">{user.name}</p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleModuleUserAccess(user.name, true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shrink-0"
                                                title="Add to module"
                                            >
                                                {isSaving ? (
                                                    <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <UserPlus className="w-4 h-4" />
                                                        Add
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                    )}

                    {selectedModuleHasActions && moduleDetailTab === 'actions' && (
                        <div className="bg-white rounded-3xl border border-slate-200/60 p-5 md:p-6 flex flex-col">
                            <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Action Permissions</h3>
                                </div>
                                <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                    {selectedModuleActions.length} Actions
                                </span>
                            </div>

                            {moduleAssignedUsers.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center py-16 text-center text-slate-400 font-bold text-sm">
                                    Assign users to this module first, then configure their actions.
                                </div>
                            ) : (
                                <div className="space-y-3 flex-1">
                                    {moduleAssignedUsers.map((user) => {
                                        const locked = isSuperAdminUser(user.name);

                                        return (
                                            <div
                                                key={user.name}
                                                className="p-4 md:p-5 rounded-2xl border border-slate-100 bg-slate-50/50"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 mb-4">
                                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.name)} text-white flex items-center justify-center font-black text-xs shrink-0`}>
                                                        {getUserInitials(user.name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-900 truncate">{user.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                            {locked ? 'Super Admin — all actions' : 'Module user'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {selectedModuleActions.map((action) => {
                                                        const isEnabled = userHasActionAccess(
                                                            user.role,
                                                            selectedModuleId,
                                                            action.id,
                                                            parsePermissions,
                                                        );
                                                        const isSaving = moduleUserSaving === `${user.name}:${action.id}`;

                                                        return (
                                                            <button
                                                                key={action.id}
                                                                type="button"
                                                                disabled={locked || isSaving}
                                                                onClick={() => handleModuleUserAction(user.name, action.id, !isEnabled)}
                                                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all disabled:opacity-60 ${
                                                                    isEnabled
                                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                                                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                                                                }`}
                                                                title={locked ? 'Super Admin always has all actions' : action.label}
                                                            >
                                                                <span className="text-base">{action.icon}</span>
                                                                <span>{action.label}</span>
                                                                {isSaving ? (
                                                                    <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                                                ) : isEnabled ? (
                                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                                ) : null}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
