import { useState } from "react";

const inputClass =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

const NoteForm = ({ mode, note, assignments, onSubmit, onClose, saving, error }) => {
  const isEdit = mode === "edit";

  // Unique classes among the teacher's assignments (the combos they may post to)
  const classes = assignments.reduce((acc, a) => {
    if (!acc.some((c) => c.classId === a.classId)) {
      acc.push({ classId: a.classId, className: a.className, section: a.section });
    }
    return acc;
  }, []);

  const [classId, setClassId] = useState(note?.classId || classes[0]?.classId || "");
  const [subjectId, setSubjectId] = useState(note?.subjectId || "");
  const [title, setTitle] = useState(note?.title || "");
  const [description, setDescription] = useState(note?.description || "");
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);

  const subjectsForClass = assignments.filter((a) => a.classId === classId);

  // Guard: if this note's subject is no longer in the teacher's current
  // assignment list (e.g. admin reassigned it), keep it selectable so the
  // teacher can still edit the rest of the note without losing the subject.
  const subjectOptions =
    isEdit &&
    note &&
    note.classId === classId &&
    !subjectsForClass.some((s) => s.subjectId === note.subjectId) &&
    note.subjectName
      ? [...subjectsForClass, { subjectId: note.subjectId, subjectName: note.subjectName }]
      : subjectsForClass;

  const handleClassChange = (value) => {
    setClassId(value);
    setSubjectId(""); // subjects depend on the selected class
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("classId", classId);
    formData.append("subjectId", subjectId);

    // New file wins over "remove". An explicit empty string tells the backend
    // to clear an existing file; if neither is chosen the file is left as-is.
    if (file) {
      formData.append("file", file);
    } else if (isEdit && removeFile) {
      formData.append("fileUrl", "");
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
          <select
            value={classId}
            onChange={(e) => handleClassChange(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className}
                {c.section ? ` (${c.section})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
            disabled={!classId}
            className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
          >
            <option value="">Select Subject</option>
            {subjectOptions.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subjectName}
                {s.subjectCode ? ` (${s.subjectCode})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
          placeholder="e.g. Algebra: Linear Equations"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Note</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className={`${inputClass} resize-none`}
          placeholder="Write the lesson note here…"
        />
      </div>

      {/* Optional file (PDF or image) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Attachment{" "}
          <span className="text-slate-400 font-normal">(optional, PDF or image — 10 MB max)</span>
        </label>
        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="text-sm text-slate-600 truncate">
            {file
              ? file.name
              : isEdit && note?.fileUrl
                ? "Current attachment kept — upload a new one to replace"
                : "Click to choose a file"}
          </span>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        {isEdit && note?.fileUrl && (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={removeFile}
              onChange={(e) => {
                setRemoveFile(e.target.checked);
                if (e.target.checked) setFile(null);
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Remove current attachment
          </label>
        )}
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
          {saving ? "Saving…" : isEdit ? "Update Note" : "Share Note"}
        </button>
      </div>
    </form>
  );
};

export default NoteForm;
