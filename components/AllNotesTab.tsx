'use client';

import React, { useState, useEffect } from 'react';
import { Note } from '@/types';
import Loading from './Loading';

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
    
    // If client not found in current view (e.g. switched tab and they have no pending notes), go back
    if (!clientSummary) {
        setSelectedClient(null);
        return null; // Will re-render with the effect or next render cycle
    }

    const filteredDetailNotes = clientSummary.allNotes.filter(note => 
      note.content.toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
      note.user.toLowerCase().includes(detailSearchQuery.toLowerCase())
    );

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button 
          onClick={() => setSelectedClient(null)}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {filterType === 'pending' ? 'Pending' : 'All'} Notes
        </button>

        <div className="bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{clientSummary.customerName}</h2>
                <p className="text-sm text-gray-600 mt-0.5">{filterType === 'pending' ? 'Pending notes' : 'All notes history'}</p>
              </div>
            </div>
            
            {/* Detail Search Box */}
            <div className="flex justify-center">
              <div className="max-w-md w-full relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base transition-all shadow-sm hover:shadow-md"
                  placeholder="Search notes..."
                  value={detailSearchQuery}
                  onChange={(e) => setDetailSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {filteredDetailNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                        {note.user.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{note.user}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{formatDate(note.timestamp)}</span>
                          <span className="text-gray-300">•</span>
                          <span>{formatTime(note.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    {note.isSolved ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Solved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {renderNoteWithLinks(note.content)}
                  </div>
                </div>
              ))}
              {filteredDetailNotes.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">No notes found matching your search.</p>
                </div>
              )}
            </div>
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notes Center</h1>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b-2 border-gray-200 mb-6 bg-gray-50/50 p-1 rounded-t-xl">
        <button
          onClick={() => setFilterType('all')}
          className={`px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200 ${
            filterType === 'all'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200/50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-white'
          }`}
        >
          All Notes ({notes.length})
        </button>
        <button
          onClick={() => setFilterType('pending')}
          className={`px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200 ${
            filterType === 'pending'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-200/50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-white'
          }`}
        >
          Pending Only ({notes.filter(n => !n.isSolved).length})
        </button>
      </div>

      {/* Main Search Box */}
      <div className="mb-6 max-w-2xl mx-auto relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-base transition-all shadow-sm hover:shadow-md"
          placeholder="Search by client name or note content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Cards Grid */}
      <div className="space-y-3">
        {filteredSummaries.map((summary, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedClient(summary.customerName)}
            className="bg-white rounded-xl border-2 border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 hover:border-blue-300 overflow-hidden group cursor-pointer"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {summary.customerName}
                  </h3>
                  <div className="text-gray-600 text-sm line-clamp-2 mb-3">
                    {renderNoteWithLinks(summary.lastNote.content)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatDate(summary.lastNote.timestamp)}</span>
                    </div>
                    <span className="text-gray-300">•</span>
                    <span>{formatTime(summary.lastNote.timestamp)}</span>
                    {!summary.lastNote.isSolved && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          ⏳ Pending
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {summary.lastNote.user.charAt(0).toUpperCase()}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredSummaries.length === 0 && (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">
              {searchQuery ? 'No notes found matching your search.' : 'No notes found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
