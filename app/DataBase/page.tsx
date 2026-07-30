import Link from 'next/link';
import { ArrowRight, Database, LayoutDashboard } from 'lucide-react';
import { DATABASE_CATEGORIES, DATABASE_DASHBOARD_HREF } from './Utils/DatabaseHubConfig';

export default function DatabaseHub() {
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

      <Link
        href={DATABASE_DASHBOARD_HREF}
        className="group flex items-center justify-between gap-4 bg-black text-white rounded-2xl p-6 border border-black shadow-lg hover:shadow-xl transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Data Status Dashboard</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              See row counts and latest data date for every database tab.
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DATABASE_CATEGORIES.map((category) => (
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
