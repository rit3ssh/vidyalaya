import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../components/layout/Modal";
import NoticeForm from "../components/notices/NoticeForm";
import NoticeDetailModal from "../components/notices/NoticeDetailModal";
import { useAuth } from "../services/auth.context.jsx";
import { getNotices, createNotice, updateNotice, deleteNotice } from "../services/api.js";
import { formatNoticeDate } from "../utils/format.js";

// Icon helpers (kept as inline SVGs to match the rest of the app)
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

const Notices = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "SCHOOL_ADMIN";

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [viewingNotice, setViewingNotice] = useState(null);
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
  const fetchNotices = useCallback(async () => {
    try {
      const res = await getNotices();
      setNotices(Array.isArray(res.notices) ? res.notices : []);
    } catch {
      setError("Failed to load notices. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Matches the data-fetching pattern used across the app's pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotices();
  }, [fetchNotices]);

  const openAddModal = () => {
    setEditingNotice(null);
    setError(""); // don't let stale page errors linger behind the modal
    setFormOpen(true);
  };

  const openEditModal = (notice) => {
    setEditingNotice(notice);
    setError("");
    setFormOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    setSaving(true);
    setError("");
    try {
      if (editingNotice) {
        await updateNotice(editingNotice.noticeId, formData);
        flashSuccess("Notice updated successfully.");
      } else {
        await createNotice(formData);
        flashSuccess("Notice published successfully.");
      }
      setFormOpen(false);
      await fetchNotices();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    try {
      await deleteNotice(confirmDelete.noticeId);
      setConfirmDelete(null);
      flashSuccess("Notice deleted successfully.");
      await fetchNotices();
    } catch {
      setError("Failed to delete notice");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading notices…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notices</h1>
          <p className="text-slate-500 mt-1">
            Official announcements from your school.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            <PlusIcon />
            Publish Notice
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

      {/* Notice grid */}
      {notices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-sm">No notices published yet.</p>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Publish your first notice
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {notices.map((notice) => (
            <article
              key={notice.noticeId}
              onClick={() => setViewingNotice(notice)}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col cursor-pointer group"
            >
              {/* Optional photo banner */}
              {notice.imageUrl && (
                <div className="h-40 bg-slate-100 overflow-hidden">
                  <img
                    src={notice.imageUrl}
                    alt={notice.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatNoticeDate(notice.noticeDate)}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(notice)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit notice"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ noticeId: notice.noticeId, title: notice.title })}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete notice"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-800 mb-2 line-clamp-2">
                  {notice.title}
                </h3>
                <p className="text-sm text-slate-500 line-clamp-3 flex-1">
                  {notice.description}
                </p>

                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                  {notice.attachmentUrl && (
                    <a
                      href={notice.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF
                    </a>
                  )}
                  <span className="ml-auto text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    View details →
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Publish / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingNotice ? "Edit Notice" : "Publish Notice"}
      >
        <NoticeForm
          key={editingNotice?.noticeId || "new"}
          mode={editingNotice ? "edit" : "add"}
          notice={editingNotice}
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
          saving={saving}
          error={error}
        />
      </Modal>

      {/* View detail modal */}
      <NoticeDetailModal notice={viewingNotice} onClose={() => setViewingNotice(null)} />

      {/* Delete confirm modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete{" "}
          <strong>{confirmDelete?.title}</strong>? This action cannot be undone.
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

export default Notices;
