import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../components/layout/Modal";
import ExamForm from "../components/exams/ExamForm";
import ExamBulkForm from "../components/exams/ExamBulkForm";
import { useAuth } from "../services/auth.context.jsx";
import {
  getExamRoutine,
  addExam,
  addExamsBulk,
  updateExam,
  deleteExam,
  getClassSubjects,
} from "../services/api.js";
import { formatTime, formatDateHeader } from "../utils/format.js";

// Subject chip colors, picked deterministically from the subject name.
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

// Dates come from the backend as ISO strings; the grid keys on the date part only.
const dateKey = (iso) => String(iso || "").slice(0, 10);
const todayKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const Exams = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const isStudent = user?.role === "STUDENT";

  const [exams, setExams] = useState([]);
  // The student viewer's class name (from the API) — highlights their row.
  const [myClassName, setMyClassName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Set only when the classes+subjects fetch fails (the exams grid still loads).
  const [classSubjectsWarning, setClassSubjectsWarning] = useState("");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  // Bulk add-exams grid (header "Add Exams" button). bulkKey is bumped on
  // every open so the grid remounts with fresh, empty rows. classesWithSubjects
  // (every class + its assigned subjects) is loaded once with the page data and
  // shared by the bulk grid and the single add/edit form.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkKey, setBulkKey] = useState(0);
  const [classesWithSubjects, setClassesWithSubjects] = useState([]);

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
  const fetchData = useCallback(async () => {
    try {
      if (isAdmin) {
        const [examRes, classSubjectRes] = await Promise.all([
          getExamRoutine().catch(() => ({ exams: [] })),
          getClassSubjects().catch(() => null),
        ]);
        setExams(Array.isArray(examRes.exams) ? examRes.exams : []);
        setClassesWithSubjects(
          classSubjectRes && Array.isArray(classSubjectRes.classes)
            ? classSubjectRes.classes
            : []
        );
        setClassSubjectsWarning(
          classSubjectRes
            ? ""
            : "Couldn't load classes and their subjects — adding exams may be limited."
        );
        setMyClassName(examRes.myClassName || null);
      } else {
        const res = await getExamRoutine();
        setExams(Array.isArray(res.exams) ? res.exams : []);
        setMyClassName(res.myClassName || null);
      }
    } catch {
      setError("Failed to load the exam routine. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    // Matches the data-fetching pattern used across the app's pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const openAddModal = (prefill = null) => {
    setEditingExam(prefill); // may carry { className, date } to prefill
    setError(""); // don't let stale page errors linger behind the modal
    setFormOpen(true);
  };

  // The header "Add Exam" button opens the bulk grid. classesWithSubjects is
  // already loaded with the page data, so each row only offers that class's
  // subjects.
  const openBulkModal = () => {
    setError("");
    setBulkKey((k) => k + 1);
    setBulkOpen(true);
  };

  const handleBulkSubmit = async (entries) => {
    setSaving(true);
    setError("");
    try {
      const res = await addExamsBulk(entries);
      flashSuccess(res.message || "Exams added to the routine.");
      setBulkOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (exam) => {
    setEditingExam(exam);
    setError("");
    setFormOpen(true);
  };

  const handleFormSubmit = async (data) => {
    setSaving(true);
    setError("");
    try {
      if (editingExam?.examId) {
        await updateExam(editingExam.examId, data);
        flashSuccess("Exam updated successfully.");
      } else {
        await addExam(data);
        flashSuccess("Exam added to the routine.");
      }
      setFormOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    try {
      await deleteExam(confirmDelete.examId);
      setConfirmDelete(null);
      flashSuccess("Exam removed from the routine.");
      await fetchData();
    } catch {
      setError("Failed to delete exam");
    }
  };

  // Build the grid: rows = class names, columns = exam dates. Columns run
  // oldest → newest (soonest exam leftmost).
  const classNames = [...new Set(exams.map((e) => e.className))].sort((a, b) => a.localeCompare(b));
  const dates = [...new Set(exams.map((e) => dateKey(e.date)))].sort((a, b) => a.localeCompare(b));
  const today = todayKey();
  // Chips within a cell are grouped chronologically by start time, so a
  // 9:00 exam always reads before an 11:30 one.
  const cellExams = (className, date) =>
    exams
      .filter((e) => e.className === className && dateKey(e.date) === date)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading exam routine…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exam Routine</h1>
          <p className="text-slate-500 mt-1">
            Upcoming exams for all classes — every section of a class sits the same exam on the same day.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openBulkModal}
            className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            <PlusIcon />
            Add Exams
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

      {/* Class-subjects warning (admin only) */}
      {classSubjectsWarning && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl">
          {classSubjectsWarning}
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

      {/* Exam grid */}
      {exams.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No exams scheduled yet.</p>
          {isAdmin && (
            <button
              onClick={openBulkModal}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add exams for all classes
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
                    Class
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d}
                      className={`px-3 py-4 text-center text-xs font-semibold uppercase tracking-wider min-w-[130px] ${
                        d === today ? "bg-blue-50 text-blue-700" : d < today ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {formatDateHeader(d)}
                      {d === today && (
                        <span className="block text-[10px] font-bold text-blue-600 mt-0.5">TODAY</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classNames.map((cn) => {
                  const isMyRow = isStudent && cn === myClassName;
                  return (
                  <tr
                    key={cn}
                    className={`border-b border-slate-50 last:border-0 ${
                      isMyRow ? "bg-blue-50/70" : ""
                    }`}
                  >
                    <td
                      className={`px-5 py-4 font-semibold whitespace-nowrap ${
                        isMyRow ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {cn}
                        {isMyRow && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            Your class
                          </span>
                        )}
                      </span>
                    </td>
                    {dates.map((d) => {
                      const cell = cellExams(cn, d);
                      return (
                        <td key={d} className="px-3 py-3 align-middle">
                          <div className="flex flex-col items-center gap-1.5 justify-center min-h-[52px]">
                            {cell.length === 0 ? (
                              isAdmin ? (
                                <button
                                  onClick={() => openAddModal({ className: cn, date: d })}
                                  className="text-xs text-slate-300 hover:text-blue-600 transition-colors"
                                >
                                  + Add
                                </button>
                              ) : (
                                <span className="text-slate-200">—</span>
                              )
                            ) : (
                              <>
                                {cell.map((ex) => (
                                  <span
                                    key={ex.examId}
                                    title={
                                      ex.startTime
                                        ? `${ex.subjectName} · ${formatTime(ex.startTime)} – ${formatTime(ex.endTime)}`
                                        : ex.subjectName
                                    }
                                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${subjectColor(ex.subjectName)}`}
                                  >
                                    {ex.subjectName}
                                    {ex.startTime && (
                                      <span className="font-normal opacity-80">
                                        · {formatTime(ex.startTime)}
                                      </span>
                                    )}
                                    {isAdmin && (
                                      <span className="flex items-center gap-0.5">
                                        <button
                                          onClick={() => openEditModal(ex)}
                                          className="hover:opacity-70 transition-opacity"
                                          title="Edit exam"
                                        >
                                          <PencilIcon />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setConfirmDelete({
                                              examId: ex.examId,
                                              label: `${ex.subjectName} — ${cn} · ${formatDateHeader(d)}`,
                                            })
                                          }
                                          className="hover:opacity-70 transition-opacity"
                                          title="Remove exam"
                                        >
                                          <TrashIcon />
                                        </button>
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk add-exams grid modal (header "Add Exams" button) */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Add Exams"
      >
        <ExamBulkForm
          key={bulkKey}
          classesWithSubjects={classesWithSubjects}
          onSubmit={handleBulkSubmit}
          onClose={() => setBulkOpen(false)}
          saving={saving}
          error={error}
        />
      </Modal>

      {/* Single add / edit modal (empty-cell "+ Add" and chip edit) */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingExam?.examId ? "Edit Exam" : "Add Exam"}
      >
        <ExamForm
          key={editingExam ? `${editingExam.className}-${editingExam.date}` : "new"}
          mode={editingExam?.examId ? "edit" : "add"}
          exam={editingExam}
          classesWithSubjects={classesWithSubjects}
          onSubmit={handleFormSubmit}
          onClose={() => setFormOpen(false)}
          saving={saving}
          error={error}
        />
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to remove <strong>{confirmDelete?.label}</strong> from the exam routine?
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

export default Exams;
