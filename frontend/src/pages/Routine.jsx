import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../services/auth.context.jsx";
import Modal from "../components/layout/Modal";
import {
  getClasses,
  viewSubjects,
  getUsers,
  getClassRoutine,
  getMyRoutine,
  addRoutinePeriod,
  updateRoutinePeriod,
  deleteRoutinePeriod,
} from "../services/api.js";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const emptyForm = () => ({
  day: "Monday",
  subjectId: "",
  teacherId: "",
  academicYear: new Date().getFullYear().toString(),
  startTime: "09:00",
  endTime: "10:00",
});

const Routine = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const isTeacher = user?.role === "TEACHER";

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRoutine = useCallback(async (classId) => {
    if (!isTeacher && !classId) return;
    setLoading(true);
    setError("");
    try {
      const res = isTeacher
        ? await getMyRoutine()
        : await getClassRoutine(classId);
      setRoutine(res.routine || null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load the timetable.");
      setRoutine(null);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  // Teachers load only their own timetable; admins load classes/subjects/teachers.
  useEffect(() => {
    const init = async () => {
      try {
        if (isTeacher) {
          await fetchRoutine();
          return;
        }
        const [cRes, sRes, tRes] = await Promise.all([
          getClasses().catch(() => ({ classes: [] })),
          viewSubjects().catch(() => ({ subjects: [] })),
          getUsers("TEACHER").catch(() => []),
        ]);
        const classList = cRes.classes || [];
        setClasses(classList);
        setSubjects(sRes.subjects || []);
        setTeachers(Array.isArray(tRes) ? tRes : []);
        const first = classList.length > 0 ? classList[0].classId : "";
        setSelectedClass(first);
        if (first) await fetchRoutine(first);
      } catch {
        setError("Failed to load timetable configuration.");
      }
    };
    init();
  }, [isTeacher, fetchRoutine]);

  const openAddModal = () => {
    setModalMode("add");
    setEditingId(null);
    setFormData(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (period, day) => {
    setModalMode("edit");
    setEditingId(period.periodId);
    setFormData({
      day: period.day || day || "Monday",
      subjectId: period.subject?.subjectId || "",
      teacherId: period.teacher?.teacherId || "",
      academicYear: period.academicYear || new Date().getFullYear().toString(),
      startTime: period.startTime || "09:00",
      endTime: period.endTime || "10:00",
    });
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) {
      setError("Please select a class first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        classId: selectedClass,
        subjectId: formData.subjectId,
        teacherId: formData.teacherId,
        academicYear: formData.academicYear,
        day: formData.day,
        startTime: formData.startTime,
        endTime: formData.endTime,
      };
      if (modalMode === "add") {
        await addRoutinePeriod(payload);
      } else {
        await updateRoutinePeriod(editingId, payload);
      }
      setModalOpen(false);
      await fetchRoutine(selectedClass);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Operation failed. Check for time-slot conflicts."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRoutinePeriod(id);
      setConfirmDelete(null);
      await fetchRoutine(selectedClass);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete the period.");
      setConfirmDelete(null);
    }
  };

  // Build the weekly grid. Rows = period order (index), columns = days, so each
  // day's periods align in chronological order — the classic period-row timetable.
  const dayPeriods = {};
  DAYS.forEach((d) => (dayPeriods[d] = []));
  (routine?.days || []).forEach(({ day, periods }) => {
    dayPeriods[day] = periods || [];
  });
  const maxPeriods = Math.max(0, ...DAYS.map((d) => dayPeriods[d].length));

  const selectedClassInfo = classes.find((c) => c.classId === selectedClass);

  const inputClass =
    "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Timetable</h1>
        <p className="text-slate-500 mt-1">
          {isTeacher
            ? "Here's your weekly schedule — the periods you teach, class by class."
            : "Build your class's weekly routine — the register, summaries and exports all follow this timetable."}
        </p>
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

      {/* Filter bar (admin) or "my timetable" banner (teacher) */}
      {isTeacher ? (
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">My Timetable</p>
            <p className="text-xs text-slate-500 mt-0.5">Only your assigned periods are shown here. Contact the school admin to request changes.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  fetchRoutine(e.target.value);
                }}
                className={inputClass}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.name} ({c.section})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Academic Year</label>
              <div className="flex items-center h-[42px] px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                {selectedClassInfo?.academicYear || "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timetable card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {isTeacher ? "My Timetable" : "Weekly Routine"}
            <span className="ml-2 text-sm font-normal text-slate-400">
              {isTeacher
                ? routine?.teacher?.name || ""
                : selectedClassInfo
                ? `${selectedClassInfo.name} (${selectedClassInfo.section})`
                : ""}
            </span>
          </h3>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Period
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">Loading timetable…</p>
            </div>
          </div>
        ) : !isTeacher && !selectedClass ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">Pick a class to view its timetable.</p>
          </div>
        ) : maxPeriods === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">
              {isTeacher ? "No periods are assigned to you yet." : "No periods scheduled for this class yet."}
            </p>
            {isAdmin && !isTeacher && (
              <button onClick={openAddModal} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                Add your first period
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-left font-medium">
                  <th className="px-4 py-3 w-20">Period</th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-3 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider">{d.slice(0, 3)}</span>
                      <span className="text-slate-300 ml-1.5 text-xs normal-case">{d.slice(3)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxPeriods }, (_, i) => (
                  <tr key={i} className="border-b border-slate-50 align-top">
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">P{i + 1}</td>
                    {DAYS.map((day) => {
                      const period = dayPeriods[day][i];
                      return (
                        <td key={day} className="px-2 py-2">
                          {period ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 group relative">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-700 text-sm truncate">{period.subject?.name || "—"}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">{period.startTime}–{period.endTime}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                                    {isTeacher
                                      ? period.class
                                        ? `${period.class.name}${period.class.section ? ` ${period.class.section}` : ""}`
                                        : ""
                                      : period.teacher?.name || ""}
                                  </p>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => openEditModal(period, day)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit period"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmDelete({
                                          id: period.periodId,
                                          name: `${period.subject?.name || "Period"} · ${day} ${period.startTime}`,
                                        })
                                      }
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete period"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="min-h-[72px] rounded-xl border border-dashed border-slate-100" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === "add" ? "Add Period" : "Edit Period"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Day</label>
            <select name="day" value={formData.day} onChange={handleFormChange} className={inputClass}>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
            <select name="subjectId" value={formData.subjectId} onChange={handleFormChange} required className={inputClass}>
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Teacher</label>
            <select name="teacherId" value={formData.teacherId} onChange={handleFormChange} required className={inputClass}>
              <option value="">Select Teacher</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Time</label>
              <input name="startTime" type="time" value={formData.startTime} onChange={handleFormChange} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End Time</label>
              <input name="endTime" type="time" value={formData.endTime} onChange={handleFormChange} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Academic Year</label>
            <input
              name="academicYear"
              type="number"
              value={formData.academicYear}
              onChange={handleFormChange}
              required
              className={inputClass}
              placeholder="e.g. 2026"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? "Saving…" : modalMode === "add" ? "Add Period" : "Update Period"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirm Delete">
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDelete(confirmDelete.id)}
            className="px-5 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Routine;
