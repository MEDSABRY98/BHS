import React from 'react';
import NoData from '../../../01-Unified/NoDataTab';
import { SharedTabProps } from '../Types';
import { renderNoteWithLinks, autoResizeTextarea } from '../Utils';

export default function NotesTab(props: SharedTabProps) {
  const {
    newNoteRef,
    newNote,
    setNewNote,
    handleAddNote,
    loadingNotes,
    notes,
    editingNoteId,
    setEditingNoteId,
    editingNoteContent,
    setEditingNoteContent,
    editNoteRef,
    handleUpdateNote,
    handleDeleteNote
  } = props;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold mb-4">Add New Note</h3>
        <div className="flex gap-4">
          <textarea
            ref={newNoteRef}
            value={newNote}
            onChange={(e) => {
              setNewNote(e.target.value);
              autoResizeTextarea(e.currentTarget);
            }}
            placeholder="Type your note here..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-24 max-h-[360px]"
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            Add Note
          </button>
        </div>
      </div>

      {loadingNotes ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.length === 0 ? (
            <NoData />
          ) : (
            notes.map((note, index) => {
              const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
              // Robust comparison: check if names exist and match (ignoring case/whitespace)
              // Permission Check: ONLY "MED Sabry" can edit/delete/mark solved
              const canManageNotes = currentUser?.name?.trim().toLowerCase() === 'med sabry';

              return (
                <div key={index} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{note.user}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">User</span>
                      </div>
                      {note.timestamp && (
                        <span className="text-sm text-gray-500">
                          {new Date(note.timestamp).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Solved Status */}
                      {note.isSolved ? (
                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded text-sm font-medium border border-green-200">
                          ✓ Solved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-sm font-medium border border-yellow-200">
                          ⏳ Pending
                        </span>
                      )}

                      {canManageNotes && editingNoteId !== note.rowIndex && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.rowIndex);
                              setEditingNoteContent(note.content);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.rowIndex)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {editingNoteId === note.rowIndex ? (
                    <div className="mt-2">
                      <textarea
                        ref={editNoteRef}
                        value={editingNoteContent}
                        onChange={(e) => {
                          setEditingNoteContent(e.target.value);
                          autoResizeTextarea(e.currentTarget);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-24 max-h-[360px] mb-2"
                      />
                      <div className="flex justify-between items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors border border-gray-200">
                          <input
                            type="checkbox"
                            checked={note.isSolved || false}
                            onChange={(e) => handleUpdateNote(note.rowIndex, editingNoteContent, e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                          />
                          <span className="font-medium">Mark as Solved</span>
                        </label>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteContent('');
                              requestAnimationFrame(() => autoResizeTextarea(editNoteRef.current));
                            }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateNote(note.rowIndex, editingNoteContent, note.isSolved)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-4">
                      <div className="text-gray-700 whitespace-pre-wrap text-lg flex-1">
                        {renderNoteWithLinks(note.content)}
                      </div>
                      {/* Quick Toggle for Solved Status (even if not editing content) */}
                      {canManageNotes && (
                        <label className="flex items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity" title="Toggle Status">
                          <input
                            type="checkbox"
                            checked={note.isSolved || false}
                            onChange={(e) => handleUpdateNote(note.rowIndex, note.content, e.target.checked)}
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
