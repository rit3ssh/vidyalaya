import Modal from "../layout/Modal";
import { formatNoticeDate } from "../../utils/format.js";

// Shows the full content of a single notice. Used by both the Notices page and
// the Dashboard's "Recent Notices" preview.
const NoticeDetailModal = ({ notice, onClose }) => {
  return (
    <Modal open={!!notice} onClose={onClose} title={notice?.title || "Notice"}>
      {notice && (
        <div>
          <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatNoticeDate(notice.noticeDate)}
          </p>

          {notice.imageUrl && (
            <img
              src={notice.imageUrl}
              alt={notice.title}
              className="w-full rounded-xl mb-4 border border-slate-100"
            />
          )}

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {notice.description}
          </p>

          {notice.attachmentUrl && (
            <a
              href={notice.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download original PDF
            </a>
          )}
        </div>
      )}
    </Modal>
  );
};

export default NoticeDetailModal;
