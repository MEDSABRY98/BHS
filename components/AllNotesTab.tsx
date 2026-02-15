'use client';

import React, { useState, useEffect } from 'react';
import { Note } from '@/types';
import Loading from './Loading';
import {
  Search,
  User,
  Calendar,
  Clock,
  ArrowLeft,
  ChevronRight,
  StickyNote,
  CheckCircle2,
  AlertCircle,
  Hash,
  MessageSquare,
  ArrowRight,
  Filter,
  Users
} from 'lucide-react';

// Helper function to convert URLs in text to clickable links
const renderNoteWithLinks = (text: string) => {
  // Regular expression to match URLs (http, https, www, or plain domain)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;

  const parts: (string | React.JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add the URL as a clickable link
    let url = match[0];
    // Add https:// if it starts with www.
    if (url.startsWith('www.')) {
      url = 'https://' + url;
    }
    // Add https:// if it doesn't start with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

interface ClientNotesSummary {
  customerName: string;
  lastNote: Note;
  allNotes: Note[];
}

export default function AllNotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      setDetailSearchQuery('');
    }
  }, [selectedClient]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notes');
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      setNotes(data.notes || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getClientSummaries = (): ClientNotesSummary[] => {
    // 1. Group notes by client
    const notesByClient = notes.reduce((acc, note) => {
      if (!acc[note.customerName]) {
        acc[note.customerName] = [];
      }
      acc[note.customerName].push(note);
      return acc;
    }, {} as Record<string, Note[]>);

    return Object.entries(notesByClient)
      .map(([customerName, clientNotes]) => {
        // 2. Filter notes based on the selected tab (Pending or All)
        // If filterType is 'pending', we only care about pending notes for this client
        let relevantNotes = clientNotes;

        if (filterType === 'pending') {
          relevantNotes = clientNotes.filter(n => !n.isSolved);
        }

        // If no relevant notes after filtering, return null (to be filtered out later)
        if (relevantNotes.length === 0) return null;

        // 3. Sort relevant notes by timestamp descending
        const sortedNotes = [...relevantNotes].sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });

        // 4. Construct summary using the latest RELEVANT note
        return {
          customerName,
          lastNote: sortedNotes[0],
          allNotes: sortedNotes, // In detail view, we show these filtered notes
        };
      })
      .filter((summary): summary is ClientNotesSummary => summary !== null) // Remove clients with no relevant notes
      .sort((a, b) => {
        // Sort clients by customer name alphabetically
        return a.customerName.localeCompare(b.customerName);
      });
  };

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp; // Return as is if not parseable
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return timestamp;
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  if (loading) {
    return <Loading message="Loading all notes..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg border border-red-200">
        {error}
      </div>
    );
  }

  if (selectedClient) {
    const clientSummary = getClientSummaries().find(c => c.customerName === selectedClient);

    if (!clientSummary) {
      setSelectedClient(null);
      return null;
    }

    const filteredDetailNotes = clientSummary.allNotes.filter(note =>
      note.content.toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
      note.user.toLowerCase().includes(detailSearchQuery.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Header Action */}
          <button
            onClick={() => setSelectedClient(null)}
            className="group flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-all font-bold uppercase text-[10px] tracking-widest"
          >
            <div className="p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm group-hover:bg-blue-50 group-hover:border-blue-200 transition-all">
              <ArrowLeft className="h-3.5 w-3.5" />
            </div>
            <span>Back to Dashboard</span>
          </button>

          {/* Client Profile Header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/30 p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] scale-[2] pointer-events-none">
              <User className="w-16 h-16" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-blue-100">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{clientSummary.customerName}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <MessageSquare className="w-3 h-3" />
                      {clientSummary.allNotes.length} Threads
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Active Records</span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-80 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:bg-white text-sm text-gray-900 placeholder-gray-400 font-bold transition-all shadow-inner"
                  placeholder="Filter logs..."
                  value={detailSearchQuery}
                  onChange={(e) => setDetailSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes Conversation Stream */}
          <div className="space-y-4">
            {filteredDetailNotes.map((note, idx) => (
              <div
                key={idx}
                className={`relative bg-white rounded-2xl border transition-all duration-300 p-5 group ${note.isSolved
                  ? 'border-green-100 bg-green-50/5 shadow-sm'
                  : 'border-white shadow-md shadow-gray-200/20'
                  }`}
              >
                {/* Visual Accent */}
                <div className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full group-hover:w-1.5 transition-all ${note.isSolved ? 'bg-green-500' : 'bg-blue-500'
                  }`}></div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${note.isSolved ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        <Hash className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-black text-sm">{note.user}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span className="text-gray-500 font-bold text-xs">{formatDate(note.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm font-medium pl-1">
                      {renderNoteWithLinks(note.content)}
                    </div>

                    <div className="flex items-center gap-3 pt-3 border-t border-gray-50 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                      <Clock className="w-3 h-3" />
                      {formatTime(note.timestamp)}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center sm:flex-col sm:items-end gap-2">
                    {note.isSolved ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-green-200 transition-all hover:scale-105 cursor-default">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Resolved</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 transition-all hover:scale-105 cursor-default">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Pending</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredDetailNotes.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-inner">
                <Search className="h-8 w-8 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">No matching records</h3>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const summaries = getClientSummaries();

  const filteredSummaries = summaries.filter(summary =>
    summary.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    summary.lastNote.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 sm:p-6 animate-in fade-in duration-700">
      <div className="max-w-[1600px] mx-auto space-y-8">

        {/* Compact Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-gray-200 pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-900 rounded-xl shadow-lg shadow-gray-200 transition-transform hover:scale-105">
                <StickyNote className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Notes Hub</h1>
            </div>
          </div>

          <div className="relative group w-full lg:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-6 py-3 bg-white border border-gray-100 rounded-xl shadow-md shadow-gray-100 focus:ring-4 focus:ring-blue-100 focus:border-blue-500/20 text-sm font-bold text-gray-900 placeholder-gray-400 transition-all"
              placeholder="Search by Client or Content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scaled Global Stats Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clients</p>
              <h4 className="text-lg font-black text-gray-900 leading-tight">{summaries.length}</h4>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entries</p>
              <h4 className="text-lg font-black text-gray-900 leading-tight">{notes.length}</h4>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending</p>
              <h4 className="text-lg font-black text-gray-900 leading-tight">{summaries.filter(s => !s.lastNote.isSolved).length}</h4>
            </div>
          </div>
        </div>

        {/* Intelligence Grid - Scaled Down Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSummaries.map((summary, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedClient(summary.customerName)}
              className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-200/20 hover:border-blue-200/50 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col min-h-[280px]"
            >
              {/* Card Decoration */}
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-all scale-125 rotate-12">
                <StickyNote className="w-12 h-12" />
              </div>

              <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                    {summary.customerName.charAt(0)}
                  </div>
                  {!summary.lastNote.isSolved && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[8px] font-black uppercase tracking-tighter">
                      <Clock className="w-3 h-3" />
                      Pending Action
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-2">
                  <h3 className="text-base font-black text-gray-900 line-clamp-2 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                    {summary.customerName}
                  </h3>
                  <div className="relative">
                    <div className="text-gray-400 text-xs font-medium line-clamp-3 leading-relaxed italic pr-2">
                      "{summary.lastNote.content}"
                    </div>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-6 pt-4 border-t border-gray-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-500 font-black text-[10px] uppercase tracking-tighter truncate leading-none">{summary.lastNote.user}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(summary.lastNote.timestamp)}
                    </div>

                    <button className="flex items-center gap-1 text-blue-600 text-[9px] font-black uppercase tracking-widest pl-3 pr-1 py-1 rounded-full bg-blue-50 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                      Log
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredSummaries.length === 0 && (
            <div className="col-span-full bg-white rounded-3xl border border-dashed border-gray-200 py-20 text-center opacity-60">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-gray-200" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-1 tracking-tighter">No Activity Found</h3>
              <p className="text-gray-400 font-bold max-w-md mx-auto text-xs leading-relaxed uppercase tracking-widest">
                {searchQuery ? `No matching logs for "${searchQuery}"` : "Database is currently empty."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
