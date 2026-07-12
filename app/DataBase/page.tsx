import Link from 'next/link';
import { UserCircle, Package, FileSpreadsheet, Building2, Users, ArrowRight, Database } from 'lucide-react';

export default function DatabaseHub() {
  const categories = [
    {
      id: 'CUSTOMERS_DEBT',
      title: 'Customers & Debt',
      description: 'Manage customers profiles, statements, and email configurations.',
      icon: UserCircle,
      href: '/DataBase/Customers',
      color: 'from-blue-500 to-blue-600',
      tables: ['Customers DB', 'Debit DB', 'Emails DB', 'Lulu Emails DB'],
    },
    {
      id: 'PRODUCTS_INVENTORY',
      title: 'Products & Inventory',
      description: 'Centralized catalog for all products and stock movements.',
      icon: Package,
      href: '/DataBase/Products',
      color: 'from-amber-500 to-amber-600',
      tables: ['Products DB', 'Inventory Item Code', 'Inventory Moves'],
    },
    {
      id: 'SALES',
      title: 'Sales & Operations',
      description: 'Track daily sales and operational transactions.',
      icon: FileSpreadsheet,
      href: '/DataBase/Sales',
      color: 'from-emerald-500 to-emerald-600',
      tables: ['Sales DB'],
    },
    {
      id: 'SUPPLIERS_PURCHASES',
      title: 'Suppliers & Purchases',
      description: 'Manage suppliers, purchases, and refunds operations.',
      icon: Building2,
      href: '/DataBase/Suppliers',
      color: 'from-purple-500 to-purple-600',
      tables: ['Suppliers DB', 'Suppliers Purchase', 'Suppliers Refund'],
    },
    {
      id: 'SYSTEM_ADMIN',
      title: 'System & Administration',
      description: 'Manage system users and personnel access.',
      icon: Users,
      href: '/DataBase/Personnel',
      color: 'from-gray-700 to-gray-900',
      tables: ['Personnel DB', 'Users DB'],
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 border-b border-gray-200 pb-8">
        <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center">
          <Database className="w-8 h-8 text-[#D4AF37]" />
        </div>
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">
            Database <span className="font-black text-[#D4AF37]">Hub</span>
          </h1>
          <p className="text-gray-500 mt-2">Select a category to manage related data tables and records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={category.href}
            className="group relative bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:border-black/5 transition-all duration-300 overflow-hidden flex flex-col h-full"
          >
            {/* Background Gradient Decoration */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${category.color} opacity-[0.03] group-hover:opacity-[0.08] rounded-bl-[100px] transition-all duration-500`} />

            <div className="flex items-start justify-between mb-6 relative z-10">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.color} text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                <category.icon className="w-7 h-7" />
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:text-[#D4AF37] transition-colors duration-300">
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#D4AF37] transition-colors" />
              </div>
            </div>

            <div className="relative z-10 flex-grow">
              <h2 className="text-2xl font-black text-black tracking-tight mb-2 group-hover:text-[#D4AF37] transition-colors">
                {category.title}
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                {category.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
