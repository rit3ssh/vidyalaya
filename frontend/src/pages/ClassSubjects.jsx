import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../components/layout/Modal";
import {
  getClassSubjectAssignments,
  addClassSubjectAssignmentsBulk,
  deleteClassSubjectAssignment,
  viewSubjects,
  getUsers,
} from "../services/api.js";

const inputClass =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

const ClassSubjects = () => {
  // Grouped by class: { classId, name, section, academicYear, subjects: [] }
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Bulk assign modal — pick a class, check off several subjects (each with
  // its own teacher), and save them all in one request.
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkClassId, setBulkClassId] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState(new Set()); // subjectIds
  const [subjectTeachers, setSubjectTeachers] = useState({}); // subjectId -> teacherId
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Timer used to auto-dismiss the success banner (cleared on unmount)
  const successTimer = useRef(null);
  useEffect(() => () => clearTimeout(successTimer.current), []);

  const flashSuccess = (message) => {
    setSuccess(message);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(""), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assignRes, subjectRes, teacherRes] = await Promise.all([
        getClassSubjectAssignments(),
        viewSubjects(),
        getUsers("TEACHER"),
      ]);
      setClasses(Array.isArray(assignRes.classes) ? assignRes.classes : []);
      setSubjects(Array.isArray(subjectRes.subjects) ? subjectRes.subjects : []);
      setTeachers(Array.isArray(teacherRes) ? teacherRes : []);
    } catch {
      setError("Failed to load class-subject assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Matches the data-fetching pattern used across the app's pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const openAddModal = (prefillClassId = "") => {
    setBulkClassId(prefillClassId || "");
    setSelectedSubjects(new Set());
    setSubjectTeachers({});
    setModalOpen(true);
  };

  const toggleSubject = (subjectId) => {
    const wasChecked = selectedSubjects.has(subjectId);
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
    // Unchecking also drops the teacher pick for that subject.
    if (wasChecked) {
      setSubjectTeachers((prev) => {
        const rest = { ...prev };
        delete rest[subjectId];
        return rest;
      });
    }
  };

  const handleClassChange = (e) => {
    setBulkClassId(e.target.value);
    setSelectedSubjects(new Set());
    setSubjectTeachers({});
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const checked = [...selectedSubjects];
    if (checked.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await addClassSubjectAssignmentsBulk({
        classId: bulkClassId,
        assignments: checked.map((subjectId) => ({
          subjectId,
          teacherId: subjectTeachers[subjectId],
        })),
      });
      setModalOpen(false);
      flashSuccess(res.message || "Subjects assigned to class.");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignmentId) => {
    try {
      await deleteClassSubjectAssignment(assignmentId);
      setConfirmDelete(null);
      flashSuccess("Assignment removed.");
      await fetchData();
    } catch {
      setError("Failed to remove assignment");
    }
  };

  // The selected class's already-assigned subjects — those are hidden from the
  // bulk list so the admin can't re-add them.
  const selectedClass = classes.find((c) => String(c.classId) === String(bulkClassId));
  const assignedIds = new Set((selectedClass?.subjects || []).map((s) => String(s.subjectId)));
  const availableSubjects = subjects.filter((s) => !assignedIds.has(String(s.subjectId)));

  // Save is only allowed when at least one subject is checked AND every
  // checked subject has a teacher picked.
  const allCheckedHaveTeachers = [...selectedSubjects].every((sid) => subjectTeachers[sid]);
  const canSave = selectedSubjects.size > 0 && allCheckedHaveTeachers;

  // Teacher options use the teacher *profile* id (what assignments store).
  const teacherOptions = teachers
    .filter((t) => t.teacherProfile?._id)
    .map((t) => ({ teacherId: t.teacherProfile._id, name: `${t.firstName} ${t.lastName}`.trim() }));

  const totalAssignments = classes.reduce((sum, c) => sum + c.subjects.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading class subjects…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Class Subjects</h1>
          <p className="text-slate-500 mt-1">
            Assign subjects to each class — this powers the exam grid and the notes room.
          </p>
        </div>
        <button
          onClick={() => openAddModal()}
          disabled={classes.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Assign Subjects
        </button>
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

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            Classes ({classes.length})
            {totalAssignments > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                · {totalAssignments} assignment{totalAssignments === 1 ? "" : "s"}
              </span>
            )}
          </h3>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm">No classes added yet.</p>
            <p className="text-xs mt-1">Add classes under the Classes page first, then assign their subjects.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-400 px-6 py-4 w-48">Class</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Assigned Subjects</th>
                  <th className="text-right font-medium text-slate-400 px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={String(c.classId)} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors align-top">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{c.name}</p>
                          {c.section && (
                            <span className="inline-block px-2 py-0.5 mt-0.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg text-xs">
                              {c.section}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.subjects.length === 0 ? (
                        <p className="text-slate-400 text-xs">No subjects assigned yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {c.subjects.map((s) => (
                            <span
                              key={String(s.assignmentId)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700"
                            >
                              {s.subjectName}
                              {s.subjectCode && <span className="font-normal opacity-60">({s.subjectCode})</span>}
                              <span className="font-normal text-slate-500">· {s.teacherName}</span>
                              <button
                                onClick={() =>
                                  setConfirmDelete({
                                    assignmentId: s.assignmentId,
                                    label: `${s.subjectName} from ${c.name}${c.section ? ` ${c.section}` : ""}`,
                                  })
                                }
                                className="text-blue-300 hover:text-red-500 transition-colors ml-0.5"
                                title="Remove assignment"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openAddModal(c.classId)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Assign Subjects
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Subjects Modal (bulk) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Subjects to Class"
      >
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            <select
              value={bulkClassId}
              onChange={handleClassChange}
              required
              className={inputClass}
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={String(c.classId)} value={c.classId}>
                  {c.name}
                  {c.section ? ` - ${c.section}` : ""}
                </option>
              ))}
            </select>
          </div>

          {bulkClassId && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Subjects</label>
                {availableSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSubjects.size === availableSubjects.length) {
                        setSelectedSubjects(new Set());
                        setSubjectTeachers({});
                      } else {
                        setSelectedSubjects(new Set(availableSubjects.map((s) => String(s.subjectId))));
                      }
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {selectedSubjects.size === availableSubjects.length ? "Clear all" : "Select all"}
                  </button>
                )}
              </div>

              {availableSubjects.length === 0 ? (
                <p className="text-sm text-slate-400 py-3">
                  All subjects are already assigned to this class.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {availableSubjects.map((s) => {
                    const sid = String(s.subjectId);
                    const checked = selectedSubjects.has(sid);
                    return (
                      <div
                        key={sid}
                        className={`flex items-center gap-3 px-4 py-3 ${checked ? "bg-blue-50/50" : ""}`}
                      >
                        <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSubject(sid)}
                            className="w-4 h-4 accent-blue-600 shrink-0"
                          />
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {s.name}
                            {s.code && <span className="font-normal text-slate-400"> ({s.code})</span>}
                          </span>
                        </label>
                        <select
                          value={checked ? subjectTeachers[sid] || "" : ""}
                          onChange={(e) =>
                            setSubjectTeachers((prev) => ({ ...prev, [sid]: e.target.value }))
                          }
                          disabled={!checked || teacherOptions.length === 0}
                          className={`w-44 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 transition-opacity ${!checked ? "opacity-40" : ""}`}
                        >
                          <option value="">
                            {teacherOptions.length === 0 ? "Add teachers first" : "Teacher"}
                          </option>
                          {teacherOptions.map((t) => (
                            <option key={String(t.teacherId)} value={t.teacherId}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {teacherOptions.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  No teachers in the school yet — add them under the Teachers page first.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-400">
              {selectedSubjects.size === 0
                ? "Check at least one subject"
                : !allCheckedHaveTeachers
                  ? "Pick a teacher for each selected subject"
                  : `${selectedSubjects.size} subject${selectedSubjects.size === 1 ? "" : "s"} selected`}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !canSave}
                className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving
                  ? "Saving…"
                  : `Assign ${selectedSubjects.size} Subject${selectedSubjects.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Remove"
      >
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to remove <strong>{confirmDelete?.label}</strong>? The subject will
          stop appearing in that class's exam grid, and its teacher can no longer post notes for it.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDelete(confirmDelete.assignmentId)}
            className="px-5 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Remove
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ClassSubjects;
