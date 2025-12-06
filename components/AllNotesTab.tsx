'use client';

import { useState, useEffect } from 'react';
import { Note } from '@/types';

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
    const notesByClient = notes.reduce((acc, note) => {
      if (!acc[note.customerName]) {
        acc[note.customerName] = [];
      }
      acc[note.customerName].push(note);
      return acc;
    }, {} as Record<string, Note[]>);

    return Object.entries(notesByClient).map(([customerName, clientNotes]) => {
      // Sort notes by timestamp descending to find the last one
      const sortedNotes = [...clientNotes].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });

      return {
        customerName,
        lastNote: sortedNotes[0],
        allNotes: sortedNotes,
      };
    }).sort((a, b) => {
      // Sort clients by their last note time (most recent first)
      const timeA = a.lastNote.timestamp ? new Date(a.lastNote.timestamp).getTime() : 0;
      const timeB = b.lastNote.timestamp ? new Date(b.lastNote.timestamp).getTime() : 0;
      return timeB - timeA;
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
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
    if (!clientSummary) return <div>Client not found</div>;

    const filteredDetailNotes = clientSummary.allNotes.filter(note => 
      note.content.toLowerCase().includes(detailSearchQuery.toLowerCase()) ||
      note.user.toLowerCase().includes(detailSearchQuery.toLowerCase())
    );

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <button 
          onClick={() => setSelectedClient(null)}
          className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors mx-auto"
        >
          <span className="mr-2">←</span> Back to All Notes
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 text-center">
            <h2 className="text-2xl font-bold text-gray-800">{clientSummary.customerName}</h2>
            <p className="text-gray-500 mt-1">All notes history</p>
            
            {/* Detail Search Box */}
            <div className="mt-4 max-w-md mx-auto relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500">🔍</span>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-300 focus:ring focus:ring-blue-200 sm:text-sm transition duration-150 ease-in-out text-center"
                placeholder="Search notes..."
                value={detailSearchQuery}
                onChange={(e) => setDetailSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-semibold text-gray-600 w-32 text-center">Date</th>
                  <th className="p-4 font-semibold text-gray-600 w-24 text-center">Time</th>
                  <th className="p-4 font-semibold text-gray-600 w-48 text-center">User</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDetailNotes.map((note, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-600 whitespace-nowrap">
                      {formatDate(note.timestamp)}
                    </td>
                    <td className="p-4 text-gray-500 text-sm">
                      {formatTime(note.timestamp)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                          {note.user.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-700 font-medium text-sm">{note.user}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-800">
                      {note.content}
                    </td>
                  </tr>
                ))}
                {filteredDetailNotes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No notes found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">All Notes</h1>
        <p className="text-gray-600 mt-1">Overview of notes across all clients</p>
      </div>

      {/* Main Search Box */}
      <div className="mb-6 max-w-md mx-auto relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500">🔍</span>
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-300 focus:ring focus:ring-blue-200 sm:text-sm transition duration-150 ease-in-out text-center"
          placeholder="Search by client name or note content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600 text-center">Client Name</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Last Note</th>
                <th className="p-4 font-semibold text-gray-600 w-48 text-center">Last Updated</th>
                <th className="p-4 font-semibold text-gray-600 w-20 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSummaries.map((summary, idx) => (
                <tr 
                  key={idx} 
                  className="hover:bg-blue-50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedClient(summary.customerName)}
                >
                  <td className="p-4 font-medium text-blue-600 group-hover:text-blue-800">
                    {summary.customerName}
                  </td>
                  <td className="p-4 text-gray-600 max-w-md text-center">
                    <div className="truncate">
                      {summary.lastNote.content}
                    </div>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {formatDate(summary.lastNote.timestamp)}
                    <span className="mx-1 text-gray-300">•</span>
                    {formatTime(summary.lastNote.timestamp)}
                  </td>
                  <td className="p-4 text-center text-gray-400 group-hover:text-blue-500">
                    →
                  </td>
                </tr>
              ))}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    {searchQuery ? 'No notes found matching your search.' : 'No notes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
