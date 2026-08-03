'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  FileStack,
  Layers,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { GetActivitySummary } from '@/app/Audit/Service/AuditService';
import { exportAdminControlExcelTable } from '@/app/AdminControl/Export/ExcelExport';
import {
  CountSessionDownloads,
  ParseSessionDownloads,
  ParseSessionTabs,
  type ActivityRecord,
  type SessionDownload,
  type SessionTab,
} from '@/app/Audit/Utils/ActivityTypes';

type UserActivityTabProps = {
  adminName: string;
};

type Filters = {
  date: string;
  userId: string;
  moduleName: string;
};

type FilesModalState = {
  userName: string;
  moduleName: string;
  files: SessionDownload[];
} | null;

type TabsModalState = {
  userName: string;
  moduleName: string;
  tabs: SessionTab[];
} | null;

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-slate-900 focus:bg-white';

const labelClass = 'text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5 block';

const PAGE_SIZE = 50;

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SessionFilesModal({
  modal,
  onClose,
}: {
  modal: FilesModalState;
  onClose: () => void;
}) {
  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="min-w-0">
            <h4 className="text-base font-black text-slate-900">Downloaded Files</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
              {modal.userName} · {modal.moduleName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          <ul className="divide-y divide-slate-100">
            {modal.files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3 px-2 py-3">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-800 truncate" title={file.name}>
                    {file.name}
                  </p>
                  {file.tab ? (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mt-0.5 truncate">
                      {file.tab}
                    </p>
                  ) : null}
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                    {file.type}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border-t border-slate-100 text-center">
          <p className="text-xs font-semibold text-slate-500">
            {modal.files.length} file{modal.files.length === 1 ? '' : 's'} in this session
          </p>
        </div>
      </div>
    </div>
  );
}

function SessionTabsModal({
  modal,
  onClose,
}: {
  modal: TabsModalState;
  onClose: () => void;
}) {
  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="min-w-0">
            <h4 className="text-base font-black text-slate-900">Visited Tabs</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
              {modal.userName} · {modal.moduleName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          <ul className="divide-y divide-slate-100">
            {modal.tabs.map((tab, index) => (
              <li key={`${tab.name}-${index}`} className="flex items-center gap-3 px-2 py-3">
                <div className="p-2 rounded-lg bg-violet-50 text-violet-700 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-800 truncate" title={tab.name}>
                    {tab.name}
                  </p>
                  {tab.at ? (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                      {formatDateTime(tab.at)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border-t border-slate-100 text-center">
          <p className="text-xs font-semibold text-slate-500">
            {modal.tabs.length} tab{modal.tabs.length === 1 ? '' : 's'} visited in this session
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UserActivityTab({ adminName }: UserActivityTabProps) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [filters, setFilters] = useState<Filters>({
    date: today,
    userId: '',
    moduleName: '',
  });
  const [query, setQuery] = useState<Filters>(filters);
  const [events, setEvents] = useState<ActivityRecord[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filesModal, setFilesModal] = useState<FilesModalState>(null);
  const [tabsModal, setTabsModal] = useState<TabsModalState>(null);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(filters), 400);
    return () => clearTimeout(timer);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await GetActivitySummary({
        date: query.date,
        adminName,
        userId: query.userId.trim() || undefined,
        moduleName: query.moduleName.trim() || undefined,
      });
      setEvents(summary.events);
      setUserNames(summary.userNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
      setEvents([]);
      setUserNames({});
    } finally {
      setLoading(false);
    }
  }, [adminName, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, currentPage]);

  const stats = useMemo(() => {
    const sessionMinutes = events.reduce((sum, e) => sum + (e.SESSION_MINUTES ?? 0), 0);
    return {
      sessions: events.length,
      downloads: CountSessionDownloads(events),
      sessionMinutes,
    };
  }, [events]);

  const resolveUserName = useCallback(
    (userId: string) => userNames[userId] || userId,
    [userNames],
  );

  const hasActiveFilters =
    filters.userId.trim() !== '' || filters.moduleName.trim() !== '';

  const clearFilters = () => {
    setFilters((prev) => ({ ...prev, userId: '', moduleName: '' }));
  };

  const handleExportExcel = async () => {
    if (!events.length || exporting) return;

    setExporting(true);
    try {
      const headers = [
        'Recorded',
        'User',
        'User ID',
        'Module',
        'Tabs',
        'Visited Tabs',
        'Files',
        'Downloaded Files',
        'Entered',
        'Exited',
        'Min',
      ];

      const rows = events.map((event) => {
        const files = ParseSessionDownloads(event.FILE_NAME);
        const tabs = ParseSessionTabs(event.TABS);
        return [
          formatDateTime(event.CREATED_AT),
          resolveUserName(event.USER_ID),
          event.USER_ID,
          event.MODULE_NAME,
          tabs.length,
          tabs.map((tab) => tab.name).join('; '),
          files.length,
          files.map((file) => file.name).join('; '),
          formatDateTime(event.SESSION_ENTERED_AT),
          formatDateTime(event.SESSION_EXITED_AT),
          event.SESSION_MINUTES ?? '',
        ];
      });

      await exportAdminControlExcelTable(
        headers,
        rows,
        `User_Activity_${query.date}`,
        {
          sheetName: 'Activity Log',
          numericColumns: ['Min', 'Tabs', 'Files'],
        },
      );
    } catch (err) {
      console.error('Failed to export activity log:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SessionFilesModal modal={filesModal} onClose={() => setFilesModal(null)} />
      <SessionTabsModal modal={tabsModal} onClose={() => setTabsModal(null)} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: 'Module Sessions', value: loading ? '—' : stats.sessions, icon: Layers, tone: 'violet' },
          { label: 'Downloads', value: loading ? '—' : stats.downloads, icon: Download, tone: 'indigo' },
          { label: 'Session Minutes', value: loading ? '—' : stats.sessionMinutes, icon: Clock3, tone: 'emerald' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-start gap-3"
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${
                item.tone === 'violet' ? 'bg-violet-50 text-violet-700'
                  : item.tone === 'indigo' ? 'bg-indigo-50 text-indigo-700'
                  : item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-lg font-black text-slate-900">Activity Log</h3>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-50 disabled:pointer-events-none"
              title="Refresh"
              aria-label="Refresh activity log"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={loading || exporting || !events.length}
              className="inline-flex items-center justify-center p-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:pointer-events-none"
              title="Export Excel"
              aria-label="Export activity log to Excel"
            >
              <FileSpreadsheet className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
            </button>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>User</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value }))}
                placeholder="Filter by name or ID"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Module</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filters.moduleName}
                onChange={(e) => setFilters((p) => ({ ...p, moduleName: e.target.value }))}
                placeholder="e.g. Debit Analysis"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TabLoader className="min-h-[280px]" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-600 font-semibold mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
            >
              Retry
            </button>
          </div>
        ) : !events.length ? (
          <div className="p-12">
            <NoData message="No activity sessions match your filters." />
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black tracking-wider">
                  <th className="py-3.5 px-5">Recorded</th>
                  <th className="py-3.5 px-5">User</th>
                  <th className="py-3.5 px-5">Module</th>
                  <th className="py-3.5 px-5">Tabs</th>
                  <th className="py-3.5 px-5">Files</th>
                  <th className="py-3.5 px-5">Entered</th>
                  <th className="py-3.5 px-5">Exited</th>
                  <th className="py-3.5 px-5">Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedEvents.map((event) => {
                  const files = ParseSessionDownloads(event.FILE_NAME);
                  const tabs = ParseSessionTabs(event.TABS);
                  const fileCount = files.length;
                  const tabCount = tabs.length;

                  return (
                    <tr key={event.ID} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap font-medium">
                        {formatDateTime(event.CREATED_AT)}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className="font-bold text-slate-900"
                          title={event.USER_ID !== resolveUserName(event.USER_ID) ? event.USER_ID : undefined}
                        >
                          {resolveUserName(event.USER_ID)}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-slate-800">{event.MODULE_NAME}</td>
                      <td className="py-3.5 px-5">
                        {tabCount > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setTabsModal({
                                userName: resolveUserName(event.USER_ID),
                                moduleName: event.MODULE_NAME,
                                tabs,
                              })
                            }
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                            title={`${tabCount} visited tab${tabCount === 1 ? '' : 's'}`}
                          >
                            <Layers className="w-4 h-4" />
                            <span className="text-xs font-bold tabular-nums">{tabCount}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        {fileCount > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setFilesModal({
                                userName: resolveUserName(event.USER_ID),
                                moduleName: event.MODULE_NAME,
                                files,
                              })
                            }
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                            title={`${fileCount} downloaded file${fileCount === 1 ? '' : 's'}`}
                          >
                            <FileStack className="w-4 h-4" />
                            <span className="text-xs font-bold tabular-nums">{fileCount}</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap text-xs">
                        {formatDateTime(event.SESSION_ENTERED_AT)}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap text-xs">
                        {formatDateTime(event.SESSION_EXITED_AT)}
                      </td>
                      <td className="py-3.5 px-5">
                        {event.SESSION_MINUTES != null ? (
                          <span className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <Clock3 className="w-3 h-3" />
                            {event.SESSION_MINUTES}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {events.length > PAGE_SIZE && (
              <div className="px-5 py-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm font-semibold text-slate-500">
                  Showing{' '}
                  <span className="text-slate-900 font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</span>
                  {' '}to{' '}
                  <span className="text-slate-900 font-bold">
                    {Math.min(currentPage * PAGE_SIZE, events.length)}
                  </span>
                  {' '}of <span className="text-slate-900 font-bold">{events.length}</span> sessions
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent text-sm font-bold text-slate-600 transition-colors shadow-sm disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="hidden md:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                              currentPage === page
                                ? 'bg-slate-900 text-white'
                                : 'border border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      }
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span key={page} className="px-1.5 text-slate-400 font-bold text-sm">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3.5 py-2 border border-slate-200 rounded-xl hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent text-sm font-bold text-slate-600 transition-colors shadow-sm disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
