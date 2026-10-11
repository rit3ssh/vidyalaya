import { useState, useEffect, useCallback } from "react";
import StatCard from "../components/layout/StatCard";
import NoticeDetailModal from "../components/notices/NoticeDetailModal";
import NoteDetailModal from "../components/notes/NoteDetailModal";
import { useAuth } from "../services/auth.context.jsx";
import { getUsers, getClasses, getNotices, getNotes } from "../services/api.js";
import { formatNoticeDate } from "../utils/format.js";

const Dashboard = ({ onNavigate }) => {
  const { user } = useAuth();
  const isStudent = user?.role === "STUDENT";
  const isTeacher = user?.role === "TEACHER";
  // The stats / rosters only exist for admins — the underlying endpoints are
  // admin-only, so other roles must not call them (they'd just 403).
  const isAdmin = user?.role === "SCHOOL_ADMIN";

  // The notes API only serves students and teachers, so only they see the
  // "Latest Note" section (parents/admins have no notes access).
  const canSeeNotes = isStudent || isTeacher;

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [notices, setNotices] = useState([]);
  const [latestNote, setLatestNote] = useState(null);
  const [viewingNotice, setViewingNotice] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // No synchronous setState here (loading already starts true) so the initial
  // fetch stays effect-clean — same pattern as the Notices page.
  const fetchData = useCallback(async () => {
    try {
      // Notices are sorted newest-first by the backend; take the top 3. For
      // students the latest note is their class's newest; for teachers it's
      // the newest across their assigned classes.
      const [sRes, tRes, cRes, nRes, noteRes] = await Promise.all([
        isAdmin ? getUsers("STUDENT").catch(() => []) : Promise.resolve([]),
        isAdmin ? getUsers("TEACHER").catch(() => []) : Promise.resolve([]),
        isAdmin ? getClasses().catch(() => ({ classes: [] })) : Promise.resolve({ classes: [] }),
        getNotices(3).catch(() => ({ notices: [] })),
        canSeeNotes
          ? getNotes().catch(() => ({ latestNote: null }))
          : Promise.resolve({ latestNote: null }),
      ]);
      setStudents(Array.isArray(sRes) ? sRes : []);
      setTeachers(Array.isArray(tRes) ? tRes : []);
      setClasses(cRes.classes || []);
      setNotices(Array.isArray(nRes.notices) ? nRes.notices : []);
      setLatestNote(noteRes.latestNote || null);
    } catch {
      setError("Failed to load data. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [canSeeNotes, isAdmin]);

  useEffect(() => {
    // Matches the data-fetching pattern used across the app's pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back! Here&apos;s an overview of your school.
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

      {/* Recent Notices — newest first, up to 3 */}
      <div className="bg-white rounded-2xl shadow-lg mb-8">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </span>
            <h3 className="text-lg font-semibold text-slate-800">Recent Notices</h3>
          </div>
          <button
            onClick={() => onNavigate("Notices")}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all →
          </button>
        </div>

        {notices.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No notices published yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {notices.map((notice) => (
              <button
                key={notice.noticeId}
                onClick={() => setViewingNotice(notice)}
                className="w-full text-left flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
              >
                {/* Photo thumbnail */}
                {notice.imageUrl ? (
                  <img
                    src={notice.imageUrl}
                    alt={notice.title}
                    loading="lazy"
                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100 group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {formatNoticeDate(notice.noticeDate)}
                    </span>
                    {notice.attachmentUrl && (
                      <span className="text-xs text-red-500" title="Has an attached PDF">
                        <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 truncate">{notice.title}</p>
                  <p className="text-sm text-slate-500 truncate">{notice.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Latest Note — the newest note for the student's class (or across the
          teacher's assigned classes), opens the full note in a modal */}
      {canSeeNotes && (
        <div className="bg-white rounded-2xl shadow-lg mb-8">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-800">
                {isStudent ? "Latest Note for Your Class" : "Latest Note in Your Classes"}
              </h3>
            </div>
            <button
              onClick={() => onNavigate("Notes")}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all →
            </button>
          </div>

          {!latestNote ? (
            <p className="text-sm text-slate-400 py-8 text-center">No notes shared yet.</p>
          ) : (
            <button
              onClick={() => setViewingNote(latestNote)}
              className="w-full text-left flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
            >
              <span className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {latestNote.subjectName || "Subject"}
                  </span>
                  {latestNote.className && (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {latestNote.className}
                      {latestNote.section ? ` (${latestNote.section})` : ""}
                    </span>
                  )}
                  {latestNote.fileUrl && (
                    <span className="text-xs text-slate-400" title="Has an attachment">
                      <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800 truncate">{latestNote.title}</p>
                <p className="text-sm text-slate-500 truncate">
                  {latestNote.teacherName ? `${latestNote.teacherName} · ` : ""}
                  {formatNoticeDate(latestNote.createdAt)}
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Stats grid — admin-only (the counts come from admin-only endpoints) */}
      {isAdmin && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Students"
          value={students.length.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          title="Total Teachers"
          value={teachers.length.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          title="Classes"
          value={classes.length.toLocaleString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <StatCard
          title="Parents"
          value="—"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      </div>
      )}

      {/* Recent activity cards — admin-only */}
      {isAdmin && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Students */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Students</h3>
          {students.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No students yet.</p>
          ) : (
            <div className="space-y-2">
              {students.slice(0, 5).map((s) => (
                <div key={s._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                    {`${s.firstName?.[0] || ""}${s.lastName?.[0] || ""}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Teachers */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Teachers</h3>
          {teachers.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No teachers yet.</p>
          ) : (
            <div className="space-y-2">
              {teachers.slice(0, 5).map((t) => (
                <div key={t._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-600">
                    {`${t.firstName?.[0] || ""}${t.lastName?.[0] || ""}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{t.firstName} {t.lastName}</p>
                    <p className="text-xs text-slate-400 truncate">{t.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Notice detail modal */}
      <NoticeDetailModal notice={viewingNotice} onClose={() => setViewingNotice(null)} />

      {/* Note detail modal */}
      <NoteDetailModal note={viewingNote} onClose={() => setViewingNote(null)} />
    </div>
  );
};

export default Dashboard;
