'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database, UserCircle, Package, Users, ArrowRight, FileSpreadsheet } from 'lucide-react';

interface MenuCardProps {
  title: string;
  description: string;
  icon: any;
  count: number | null;
  isLoading: boolean;
  onClick: () => void;
  color: string;
}

const MenuCard = ({ title, description, icon: Icon, count, isLoading, onClick, color }: MenuCardProps) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-white rounded-[2.5rem] p-8 sm:p-10 border border-gray-100 transition-all duration-300 hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 hover:border-black/5 flex flex-col justify-between h-[220px]"
    >
      <div className="flex justify-between items-start w-full">
        <div className={`w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[#D4AF37] shadow-lg shadow-black/10 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-6 w-12 bg-gray-100 rounded-full animate-pulse" />
          ) : count !== null ? (
            <span className="text-2xl font-black text-black bg-gray-50 px-4 py-1.5 rounded-2xl border border-gray-100/50">
              {count}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 mt-6">
        <h3 className="text-xl font-black text-black group-hover:text-[#D4AF37] transition-colors">
          {title}
        </h3>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-black group-hover:gap-3 transition-all self-end">
        <span>Manage Database</span>
        <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
      </div>
    </button>
  );
};

export default function DatabaseDashboard() {
  const router = useRouter();
  const [counts, setCounts] = useState<{ customers: number | null; products: number | null; users: number | null; sales: number | null }>({
    customers: null,
    products: null,
    users: null,
    sales: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      setIsLoading(true);
      try {
        const { bhs_supabas } = await import('@/lib/supabase');
        
        const [custRes, prodRes, userRes] = await Promise.all([
          bhs_supabas.from('bhs_CUSTOMERS').select('ID', { count: 'exact', head: true }),
          bhs_supabas.from('bhs_PRODUCTS').select('ID', { count: 'exact', head: true }),
          bhs_supabas.from('bhs_USERS').select('ID', { count: 'exact', head: true })
        ]);

        let salesCount = 0;
        try {
          const salesMonthsRes = await fetch('/api/Sales/months');
          const salesMonthsData = await salesMonthsRes.json();
          if (salesMonthsData.data) {
            salesCount = salesMonthsData.data.reduce((acc: number, cur: any) => acc + (cur.count || 0), 0);
          }
        } catch (salesErr) {
          console.error('Error fetching sales count from API:', salesErr);
        }

        setCounts({
          customers: custRes.count,
          products: prodRes.count,
          users: userRes.count,
          sales: salesCount
        });
      } catch (err) {
        console.error('Error fetching database counts:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCounts();
  }, []);

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-black text-[#D4AF37] rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
            <Database className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em]">BHS SYSTEM</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-normal text-black tracking-tighter">
          Database Management
        </h1>

      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        <MenuCard
          title="Customers DB"
          description="Manage client profile details, locations, and unique customer identification."
          icon={UserCircle}
          count={counts.customers}
          isLoading={isLoading}
          onClick={() => router.push('/DataBase/Customers')}
          color="teal"
        />
        <MenuCard
          title="Products DB"
          description="Add new items, configure barcodes, and manage overall catalog inventory settings."
          icon={Package}
          count={counts.products}
          isLoading={isLoading}
          onClick={() => router.push('/DataBase/Products')}
          color="emerald"
        />
        <MenuCard
          title="Users DB"
          description="Manage user credentials, administrative permissions, role types, and signatures."
          icon={Users}
          count={counts.users}
          isLoading={isLoading}
          onClick={() => router.push('/DataBase/Users')}
          color="indigo"
        />
        <MenuCard
          title="Sales DB"
          description="Manage and delete historical transaction entries grouped by year and month."
          icon={FileSpreadsheet}
          count={counts.sales}
          isLoading={isLoading}
          onClick={() => router.push('/DataBase/Sales')}
          color="amber"
        />
      </div>
    </div>
  );
}
