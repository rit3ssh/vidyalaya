import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../components/layout/Modal";
import NoteForm from "../components/notes/NoteForm";
import NoteDetailModal from "../components/notes/NoteDetailModal";
import { useAuth } from "../services/auth.context.jsx";
import {
  getNotes,
  getNoteAssignments,
  createNote,
  updateNote,
  deleteNote,
} from "../services/api.js";
import { formatNoticeDate } from "../utils/format.js";

// Subject badge colors, picked deterministically from the subject name so each
// subject keeps the same color across cards.
const SUBJECT_COLORS = [
  "bg-blue-50 text-blue-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-purple-50 text-purple-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
];
const subjectColor = (name) =>
  SUBJECT_COLORS[[...String(name || "")].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % SUBJECT_COLORS.length];

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const Notes = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const isStudent = user?.role === "STUDENT";

  const [notes, setNotes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [latestNote, setLatestNote] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  // Timer used to auto-dismiss the success banner (cleared on unmount)
  const successTimer = useRef(null);
  useEffect(() => () => clearTimeout(successTimer.current), []);

  const flashSuccess = (message) => {
    setSuccess(message);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(""), 4000);
  };

  // Note: no synchronous setState here so the initial fetch stays effect-clean.
  // `loading` already starts as true, and post-mutation refreshes update in
  // place instead of flashing the full-page spinner.
  const fetchData = useCallback(async (subjectId) => {
    try {
      if (isTeacher) {
        const [notesRes, assignRes] = await Promise.all([
          getNotes(subjectId),
          getNoteAssignments().catch(() => ({ assignments: [] })),
        ]);
        setNotes(Array.isArray(notesRes.notes) ? notesRes.notes : []);
        setSubjects(Array.isArray(notesRes.subjects) ? notesRes.subjects : []);
        setLatestNote(notesRes.latestNote || null);
        setAssignments(Array.isArray(assignRes.assignments) ? assignRes.assignments : []);
      } else {
        const res = await getNotes(subjectId);
        setNotes(Array.isArray(res.notes) ? res.notes : []);
        setSubjects(Array.isArray(res.subjects) ? res.subjects : []);
        setLatestNote(res.latestNote || null);
      }
    } catch {
      setError("Failed to load notes. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    // Matches the data-fetching pattern used across the app's pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData("");
  }, [fetchData]);

  const handleSubjectChange = (value) => {
    setSelectedSubject(value);
    fetchData(value);
  };

  const openAddModal = () => {
    setEditingNote(null);
    setError(""); // don't let stale page errors linger behind the modal
    setFormOpen(true);
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setError("");
    setFormOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    setSaving(true);
    setError("");
    try {
      if (editingNote) {
        await updateNote(editingNote.noteId, formData);
        flashSuccess("Note updated successfully.");
      } else {
        await createNote(formData);
        flashSuccess("Note shared successfully.");
      }
      setFormOpen(false);
      await fetchData(selectedSubject);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Operation failed. Make sure the class and subject are assigned to you."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    try {
      await deleteNote(confirmDelete.noteId);
      setConfirmDelete(null);
      flashSuccess("Note deleted successfully.");
      await fetchData(selectedSubject);
    } catch {
      setError("Failed to delete note");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading notes…</p>
        </div>
      </div>
    );
  }

  const hasNoAssignments = isTeacher && assignments.length === 0;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notes Room</h1>
          <p className="text-slate-500 mt-1">
            {isTeacher
              ? "Share lesson notes with your classes and browse everything your fellow teachers have shared."
              : "Lesson notes shared by your teachers — pick a subject to explore."}
          </p>
        </div>
        {isTeacher && (
          <button
            onClick={openAddModal}
            disabled={hasNoAssignments}
            title={hasNoAssignments ? "Ask the school admin to assign you a class + subject first" : ""}
            className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
          >
            <PlusIcon />
            Share Note
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 ml-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-400 hover:text-green-600 ml-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* No-assignments hint for teachers */}
      {hasNoAssignments && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            You haven't been assigned any class + subject yet, so you can't share notes.
            Ask the school admin to add your subjects on the <strong>Subjects</strong> page.
          </span>
        </div>
      )}

      {/* Latest note card — always the most recent note in scope */}
      {latestNote && (
        <button
          onClick={() => setViewingNote(latestNote)}
          className="w-full text-left mb-6 group"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 p-6 hover:shadow-xl hover:shadow-blue-600/30 transition-shadow duration-300">
            <div className="absolute -right-6 -top-6 w-40 h-40 bg-white/10 rounded-full" />
            <div className="absolute -right-2 top-10 w-24 h-24 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white px-2.5 py-1 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Latest note
                </span>
                <span className="inline-flex items-center text-xs font-medium bg-white/15 text-white px-2.5 py-1 rounded-full">
                  {latestNote.subjectName || "Subject"}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2 line-clamp-2">{latestNote.title}</h3>
              <p className="text-sm text-blue-100 line-clamp-2 mb-4">{latestNote.description}</p>
              <div className="flex items-center gap-3 text-xs text-blue-200">
                {latestNote.className && (
                  <span>
                    {latestNote.className}
                    {latestNote.section ? ` (${latestNote.section})` : ""}
                  </span>
                )}
                <span>·</span>
                <span>{latestNote.teacherName || "Teacher"}</span>
                <span>·</span>
                <span>{formatNoticeDate(latestNote.createdAt)}</span>
                <span className="ml-auto inline-flex items-center gap-1 font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  Open note
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Subject filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
          Subject
        </label>
        <select
          value={selectedSubject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className="w-full max-w-xs px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-shadow bg-white"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.name}
              {s.count > 0 ? ` (${s.count})` : ""}
            </option>
          ))}
        </select>
        {selectedSubject && (
          <button
            onClick={() => handleSubjectChange("")}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm">
            {selectedSubject
              ? "No notes for this subject yet."
              : isStudent
                ? "No notes shared for your class yet."
                : "No notes shared in your classes yet."}
          </p>
          {isTeacher && !selectedSubject && (
            <button
              onClick={openAddModal}
              disabled={hasNoAssignments}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-slate-300 disabled:cursor-not-allowed"
            >
              Share your first note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <article
              key={note.noteId}
              onClick={() => setViewingNote(note)}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-5 flex flex-col cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${subjectColor(note.subjectName)}`}>
                  {note.subjectName || "Subject"}
                </span>
                {isTeacher && note.canManage && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditModal(note)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit note"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ noteId: note.noteId, title: note.title })}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete note"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="text-base font-semibold text-slate-800 mb-2 line-clamp-2">
                {note.title}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-3 flex-1">{note.description}</p>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                {note.className && isTeacher && (
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {note.className}
                    {note.section ? ` (${note.section})` : ""}
                  </span>
                )}
                {note.fileUrl && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400" title="Has attachment">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    File
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {note.teacherName ? `${note.teacherName} · ` : ""}
                  {formatNoticeDate(note.createdAt)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Share / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingNote ? "Edit Note" : "Share Note"}
      >
        <NoteForm
          key={editingNote?.noteId || "new"}
          mode={editingNote ? "edit" : "add"}
          note={editingNote}
          assignments={assignments}
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
          saving={saving}
          error={error}
        />
      </Modal>

      {/* View detail modal */}
      <NoteDetailModal note={viewingNote} onClose={() => setViewingNote(null)} />

      {/* Delete confirm modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <strong>{confirmDelete?.title}</strong>? Students in
          this class will no longer see it.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-5 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Notes;
