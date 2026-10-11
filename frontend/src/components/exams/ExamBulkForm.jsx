import { useState, useMemo } from "react";
import { formatTime, formatDateHeader } from "../../utils/format.js";

const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-shadow";

const smallInputClass =
  "px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs transition-shadow";

// Bulk "Add Exams" workspace: pick one date at a time (each date becomes a grid
// column), then tap "+ Add subject" in a class × date cell to schedule that
// class's subject and exam time. Exactly one exam per cell — adding again edits
// the existing one. Everything is saved at once via the bulk endpoint.
const ExamBulkForm = ({ classesWithSubjects, onSubmit, onClose, saving, error }) => {
  // The date picker value (yyyy-mm-dd) — picking one adds a grid column.
  const [selectedDate, setSelectedDate] = useState("");
  const [dates, setDates] = useState([]);

  // The working set: one entry { className, date, subjectId, startTime, endTime }
  // per class × date cell.
  const [entries, setEntries] = useState([]);

  // Which cell's inline editor is open ({ className, date, entry? }), plus its draft.
  const [editingCell, setEditingCell] = useState(null);
  const [draft, setDraft] = useState({ subjectId: "", startTime: "09:00", endTime: "11:00" });

  const classNames = classesWithSubjects.map((c) => c.className);

  // Class name → its assigned subjects (strictly class-respective).
  const subjectsByClass = useMemo(() => {
    const map = new Map();
    for (const c of classesWithSubjects) map.set(c.className, c.subjects || []);
    return map;
  }, [classesWithSubjects]);

  // subjectId → { name, code } for rendering chips.
  const subjectLookup = useMemo(() => {
    const map = new Map();
    for (const c of classesWithSubjects) {
      for (const s of c.subjects || []) map.set(String(s.subjectId), s);
    }
    return map;
  }, [classesWithSubjects]);

  const addDate = () => {
    const d = selectedDate.trim();
    if (!d || dates.includes(d)) return;
    setDates((prev) => [...prev, d].sort());
    setSelectedDate("");
  };

  const removeDate = (d) => {
    setDates((prev) => prev.filter((x) => x !== d));
    setEntries((prev) => prev.filter((e) => e.date !== d));
    setEditingCell((c) => (c?.date === d ? null : c));
  };

  const openCellEditor = (className, date, entry = null) => {
    setEditingCell({ className, date, entry });
    setDraft(
      entry
        ? { subjectId: entry.subjectId, startTime: entry.startTime, endTime: entry.endTime }
        : { subjectId: "", startTime: "09:00", endTime: "11:00" }
    );
  };

  // One exam per cell: adding replaces any existing entry for that cell.
  const addEntry = () => {
    if (!editingCell) return;
    const { subjectId, startTime, endTime } = draft;
    if (!subjectId || !startTime || !endTime || endTime <= startTime) return;
    const next = {
      className: editingCell.className,
      date: editingCell.date,
      subjectId,
      startTime,
      endTime,
    };
    setEntries((prev) => [
      ...prev.filter(
        (e) => !(e.className === editingCell.className && e.date === editingCell.date)
      ),
      next,
    ]);
    setEditingCell(null);
  };

  const removeEntry = (className, date) => {
    setEntries((prev) => prev.filter((e) => !(e.className === className && e.date === date)));
  };

  const cellEntry = (className, date) =>
    entries.find((e) => e.className === className && e.date === date) || null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (entries.length === 0) return;
    onSubmit(entries);
  };

  if (classNames.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="text-sm">No classes exist yet. Create classes first, then schedule exams.</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <p className="text-sm text-slate-500">
        Pick a date to add a column, then tap <strong>+ Add subject</strong> in a cell to
        schedule that class's subject and exam time. One exam per class per day — adding
        again edits it. You can add several dates before saving.
      </p>

      {/* Date picker — each picked date becomes a grid column */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={addDate}
          disabled={!selectedDate || dates.includes(selectedDate) || saving}
          className="px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add Date Column
        </button>
      </div>

      {dates.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm">Pick a date above to start building the routine.</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
                  Class
                </th>
                {dates.map((d) => (
                  <th key={d} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[190px]">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      {formatDateHeader(d)}
                      <button
                        type="button"
                        onClick={() => removeDate(d)}
                        title="Remove this date"
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classNames.map((cn) => (
                <tr key={cn} className="border-b border-slate-50 last:border-0 align-top">
                  <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{cn}</td>
                  {dates.map((d) => {
                    const entry = cellEntry(cn, d);
                    const subjects = subjectsByClass.get(cn) || [];
                    const isEditing = editingCell?.className === cn && editingCell?.date === d;

                    return (
                      <td key={d} className="px-3 py-3 align-top">
                        {isEditing ? (
                          subjects.length === 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-400">
                                This class has no subjects assigned yet.
                              </p>
                              <button
                                type="button"
                                onClick={() => setEditingCell(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <select
                                value={draft.subjectId}
                                onChange={(e) => setDraft((prev) => ({ ...prev, subjectId: e.target.value }))}
                                className={inputClass}
                              >
                                <option value="">Select Subject</option>
                                {subjects.map((s) => (
                                  <option key={s.subjectId} value={s.subjectId}>
                                    {s.name}
                                    {s.code ? ` (${s.code})` : ""}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={draft.startTime}
                                  onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
                                  className={smallInputClass}
                                  aria-label="Start time"
                                />
                                <span className="text-xs text-slate-400">to</span>
                                <input
                                  type="time"
                                  value={draft.endTime}
                                  onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value }))}
                                  className={smallInputClass}
                                  aria-label="End time"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={addEntry}
                                  disabled={
                                    !draft.subjectId ||
                                    !draft.startTime ||
                                    !draft.endTime ||
                                    draft.endTime <= draft.startTime
                                  }
                                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  {editingCell?.entry ? "Update" : "Add"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCell(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )
                        ) : !entry ? (
                          <button
                            type="button"
                            onClick={() => openCellEditor(cn, d)}
                            disabled={saving}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            + Add subject
                          </button>
                        ) : (
                          <div className="flex flex-col items-start gap-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                              {subjectLookup.get(String(entry.subjectId))?.name || "Subject"}
                              {entry.startTime && (
                                <span className="font-normal opacity-80">· {formatTime(entry.startTime)}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => openCellEditor(cn, d, entry)}
                                title="Edit exam"
                                className="hover:opacity-70 transition-opacity"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeEntry(cn, d)}
                                title="Remove exam"
                                className="hover:opacity-70 transition-opacity"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          </div>
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

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-slate-400">
          {entries.length === 0
            ? "Nothing scheduled yet."
            : `${entries.length} exam${entries.length === 1 ? "" : "s"} ready to save.`}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || entries.length === 0}
            className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? "Saving…" : `Save Exams${entries.length > 0 ? ` (${entries.length})` : ""}`}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ExamBulkForm;
