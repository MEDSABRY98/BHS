'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Database, LayoutDashboard } from 'lucide-react';
import { DATABASE_CATEGORIES, DATABASE_NAV_ITEMS } from './Utils/DatabaseHubConfig';
import { getAllowedModuleTabIds } from '@/app/AdminControl/AdminControlTab';
import { useLiveCurrentUser } from '@/app/Components/Auth/AppSessionProvider';

export default function DatabaseHub() {
  const liveUser = useLiveCurrentUser();
  const categories = useMemo(() => {
    const allowedIds = new Set(
      getAllowedModuleTabIds(liveUser, 'database', DATABASE_NAV_ITEMS.map((item) => item.id))
    );
    return DATABASE_CATEGORIES.map((category) => {
      const items = DATABASE_NAV_ITEMS.filter((item) => item.category === category.id && allowedIds.has(item.id));
      if (items.length === 0) return null;
      return { ...category, href: items[0].href };
    }).filter((category): category is (typeof DATABASE_CATEGORIES)[number] => category !== null);
  }, [liveUser]);
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

        </div>
      </div>



      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={category.href}
            className="group relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:border-black/5 transition-all duration-300 overflow-hidden flex flex-col h-full"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${category.color} opacity-[0.03] group-hover:opacity-[0.08] rounded-bl-[80px] transition-all duration-500`} />

            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${category.color} text-white flex items-center justify-center shadow-md transform group-hover:scale-105 transition-transform duration-300`}>
                <category.icon className="w-5 h-5" />
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-black group-hover:text-[#D4AF37] transition-colors duration-300">
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#D4AF37] transition-colors" />
              </div>
            </div>

            <div className="relative z-10">
              <h2 className="text-lg font-black text-black tracking-tight group-hover:text-[#D4AF37] transition-colors leading-snug">
                {category.title}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
