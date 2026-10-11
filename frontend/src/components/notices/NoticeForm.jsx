import { useState } from "react";

// Local helpers for converting dates between ISO (from API) and yyyy-mm-dd (input)
const toDateInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().split("T")[0];
};

const inputClass =
  "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

const NoticeForm = ({ mode, notice, onSubmit, onClose, saving, error }) => {
  const [title, setTitle] = useState(notice?.title || "");
  const [description, setDescription] = useState(notice?.description || "");
  const [noticeDate, setNoticeDate] = useState(toDateInputValue(notice?.noticeDate));
  const [imageFile, setImageFile] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const isEdit = mode === "edit";

  const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("noticeDate", noticeDate);

    // New file wins over "remove". An explicit empty string tells the backend
    // to clear an existing file; if neither is chosen the file is left as-is.
    if (imageFile) {
      formData.append("image", imageFile);
    } else if (isEdit && removeImage) {
      formData.append("imageUrl", "");
    }
    if (attachmentFile) {
      formData.append("attachment", attachmentFile);
    } else if (isEdit && removeAttachment) {
      formData.append("attachmentUrl", "");
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
          placeholder="e.g. School Closed — Dashain Holiday"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className={`${inputClass} resize-none`}
          placeholder="Write the notice details here…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Notice Date</label>
        <input
          type="date"
          value={noticeDate}
          onChange={(e) => setNoticeDate(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      {/* Photo upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Photo <span className="text-slate-400 font-normal">(optional, jpg/png/webp — 5 MB max)</span>
        </label>
        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-slate-600 truncate">
            {imageFile
              ? imageFile.name
              : isEdit && notice?.imageUrl
                ? "Current photo attached — upload a new one to replace"
                : "Click to choose a photo"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
        </label>
        {isEdit && notice?.imageUrl && (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={removeImage}
              onChange={(e) => {
                setRemoveImage(e.target.checked);
                if (e.target.checked) setImageFile(null);
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Remove current photo
          </label>
        )}
      </div>

      {/* PDF attachment upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Original PDF <span className="text-slate-400 font-normal">(optional, PDF — 10 MB max)</span>
        </label>
        <label className="flex items-center gap-3 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm text-slate-600 truncate">
            {attachmentFile
              ? attachmentFile.name
              : isEdit && notice?.attachmentUrl
                ? "Current PDF attached — upload a new one to replace"
                : "Click to choose a PDF"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
          />
        </label>
        {isEdit && notice?.attachmentUrl && (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={removeAttachment}
              onChange={(e) => {
                setRemoveAttachment(e.target.checked);
                if (e.target.checked) setAttachmentFile(null);
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Remove current PDF
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
          {saving ? "Saving…" : isEdit ? "Update Notice" : "Publish Notice"}
        </button>
      </div>
    </form>
  );
};

export default NoticeForm;
