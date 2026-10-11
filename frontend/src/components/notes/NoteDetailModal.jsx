import Modal from "../layout/Modal";
import { formatNoticeDate } from "../../utils/format.js";

// A note attachment can be a PDF or an image — images render inline.
const isImageFile = (url) => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url || "");

// Shows the full content of a single note. Used by both the Notes page and the
// latest-note card.
const NoteDetailModal = ({ note, onClose }) => {
  const showInlineImage = note?.fileUrl && isImageFile(note.fileUrl);
  return (
    <Modal open={!!note} onClose={onClose} title={note?.title || "Note"}>
      {note && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {note.subjectName || "Subject"}
            </span>
            {note.className && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {note.className}
                {note.section ? ` (${note.section})` : ""}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatNoticeDate(note.createdAt)}
            {note.teacherName && (
              <span className="ml-auto text-slate-400">
                by <span className="text-slate-600 font-medium">{note.teacherName}</span>
              </span>
            )}
          </p>

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {note.description}
          </p>

          {showInlineImage && (
            <img
              src={note.fileUrl}
              alt={note.title}
              className="w-full rounded-xl mt-5 border border-slate-100"
            />
          )}

          {note.fileUrl && (
            <a
              href={note.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {note.fileName || "Open attachment"}
            </a>
          )}
        </div>
      )}
    </Modal>
  );
};

export default NoteDetailModal;
