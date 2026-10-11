import { useState } from "react";
import { toDateInputValue } from "../../utils/format.js";

const inputClass =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

const ExamForm = ({ mode, exam, classesWithSubjects, onSubmit, onClose, saving, error }) => {
  const isEdit = mode === "edit";

  // [{ className, subjects }] — class names and the subjects each class teaches.
  const classNames = classesWithSubjects.map((c) => c.className);

  const [className, setClassName] = useState(exam?.className || classNames[0] || "");
  const [date, setDate] = useState(toDateInputValue(exam?.date));
  const [subjectId, setSubjectId] = useState(exam?.subjectId || "");
  const [startTime, setStartTime] = useState(exam?.startTime || "09:00");
  const [endTime, setEndTime] = useState(exam?.endTime || "11:00");

  // Only the selected class's subjects are offered.
  const subjectsForClass =
    classesWithSubjects.find((c) => c.className === className)?.subjects || [];

  // Guard: if this entry's subject is no longer assigned to the class (e.g. the
  // admin reassigned subjects), keep it selectable so the rest can still be edited.
  const subjectOptions =
    isEdit &&
    exam &&
    exam.className === className &&
    exam.subjectId &&
    !subjectsForClass.some((s) => String(s.subjectId) === String(exam.subjectId))
      ? [...subjectsForClass, { subjectId: exam.subjectId, name: exam.subjectName }]
      : subjectsForClass;

  const handleClassChange = (value) => {
    setClassName(value);
    setSubjectId(""); // subjects depend on the selected class
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ className, date, subjectId, startTime, endTime });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Class{" "}
          <span className="text-slate-400 font-normal">(all sections — the whole class sits the exam on the same day)</span>
        </label>
        <select
          value={className}
          onChange={(e) => handleClassChange(e.target.value)}
          required
          className={inputClass}
        >
          <option value="">Select Class</option>
          {classNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
          disabled={subjectOptions.length === 0}
          className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
        >
          <option value="">
            {subjectOptions.length === 0 ? "No subjects assigned to this class" : "Select Subject"}
          </option>
          {subjectOptions.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.name}
              {s.code ? ` (${s.code})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
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
          {saving ? "Saving…" : isEdit ? "Update Exam" : "Add Exam"}
        </button>
      </div>
    </form>
  );
};

export default ExamForm;
