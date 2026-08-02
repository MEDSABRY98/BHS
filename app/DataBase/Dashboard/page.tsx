'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Calendar,
  Database,
  RefreshCw,
  Rows3,
} from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import {
  DATABASE_CATEGORIES,
  getDatabaseNavItemsByCategory,
} from '../Utils/DatabaseHubConfig';
import {
  fetchDatabaseSourcesStatus,
  type DatabaseSourceStatus,
} from '../Service/database_dashboard_service';

function formatDisplayDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DatabaseDashboardPage() {
  const [sources, setSources] = useState<DatabaseSourceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const loadStatus = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await fetchDatabaseSourcesStatus();
      setSources(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to load database dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const statusById = useMemo(() => {
    const map = new Map<string, DatabaseSourceStatus>();
    sources.forEach((s) => map.set(s.id, s));
    return map;
  }, [sources]);

  if (isLoading) {
    return <TabLoader />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center">
            <Activity className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-4xl font-normal text-black tracking-tighter">
              Data Status <span className="font-black text-[#D4AF37]">Dashboard</span>
            </h1>
            <p className="text-gray-500 mt-2">
              Latest business date and row count for each database tab.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs font-medium text-gray-400">
              Refreshed{' '}
              {lastRefreshedAt.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadStatus(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-[#D4AF37] rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {DATABASE_CATEGORIES.map((category) => {
          const items = getDatabaseNavItemsByCategory(category.id);
          const Icon = category.icon;

          return (
            <section key={category.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${category.color} text-white flex items-center justify-center shadow-sm`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-black tracking-tight">{category.title}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((item) => {
                  const status = statusById.get(item.id);
                  const ItemIcon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-black/5 transition-all p-5 flex flex-col gap-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 group-hover:bg-[#D4AF37]/10 transition-colors">
                            <ItemIcon className="w-5 h-5 text-gray-600 group-hover:text-[#b8962e]" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-black truncate group-hover:text-[#D4AF37] transition-colors">
                              {item.label}
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                              {item.source.kind === 'reference' ? 'Reference data' : 'Transactional data'}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] shrink-0 transition-colors" />
                      </div>

                      {status?.error ? (
                        <TabFetchError
                          message={status.error}
                          onRetry={() => void loadStatus(true)}
                          isRetrying={isRefreshing}
                          className="py-4"
                        />
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                              <Rows3 className="w-3 h-3" />
                              Rows
                            </div>
                            <p className="text-lg font-black text-black tabular-nums">
                              {(status?.rowCount ?? 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                              <Calendar className="w-3 h-3" />
                              Latest data
                            </div>
                            <p className="text-sm font-bold text-black">
                              {formatDisplayDate(status?.lastDataDate ?? null)}
                            </p>
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 pt-4 border-t border-gray-100">
        <Database className="w-3.5 h-3.5" />
        <span>
          Latest data shows the most recent business date in each table. Reference tabs have no date column.
        </span>
      </div>
    </div>
  );
}
