import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../services/auth.context.jsx";
import { getClasses, getAttendanceSheet, saveAttendanceSheet, viewSubjects, getSubjectAttendanceSummary, getDailyRegister, downloadAnnualAttendance, getNoteAssignments } from "../services/api.js";

// Status display maps (module scope — no need to recreate on every render)
const STATUS_CELL_STYLE = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
  LATE: "bg-amber-100 text-amber-700",
  LEAVE: "bg-blue-100 text-blue-700",
  NO_CLASS: "bg-slate-50 text-slate-300",
  UNMARKED: "bg-orange-50 text-orange-500 border border-dashed border-orange-200",
};
const STATUS_LETTER = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  LEAVE: "E",
  NO_CLASS: "·",
  UNMARKED: "?",
};

const Attendance = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";

  // Filter panel state
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(""); // Populate with local array or fetch mapping
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [timeSlot, setTimeSlot] = useState("Period1");
  // The teacher's own class+subject combos (from the notes assignments
  // endpoint) — teachers may only mark attendance for these.
  const [teacherAssignments, setTeacherAssignments] = useState([]);

  // Core records and view states
  const [records, setRecords] = useState([]);
  const [isNewSheet, setIsNewSheet] = useState(true);
  
  // UI Indicators
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [subjects, setSubjects] = useState([]);

  // Monthly subject summary (subject-wise register) state
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // Daily register (whole day at a glance) state
  const [register, setRegister] = useState(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Annual Excel export state
  const [exporting, setExporting] = useState(false);
  // Subjects mock data - adapt to your specific subjects routing if available
//   const subjects = [
//     { _id: "sub1", name: "Distributed Systems" },
//     { _id: "sub2", name: "Computer Networks" },
//     { _id: "sub3", name: "Simulation and Modeling" },
//   ];

  // Fetch classes + subjects on mount. Admins get the whole school; teachers
  // get only the classes/subjects assigned to them (they may only mark
  // attendance for their own combos).
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (isTeacher) {
          const assignRes = await getNoteAssignments().catch(() => ({ assignments: [] }));
          const assignments = Array.isArray(assignRes.assignments) ? assignRes.assignments : [];
          setTeacherAssignments(assignments);

          // Unique classes across the teacher's assignments
          const classMap = new Map();
          for (const a of assignments) {
            if (!a.classId) continue;
            classMap.set(String(a.classId), {
              classId: a.classId,
              name: a.className,
              section: a.section,
              academicYear: a.academicYear,
            });
          }
          const classList = [...classMap.values()];
          setClasses(classList);
          if (classList.length > 0) {
            setSelectedClass(classList[0].classId);
            // Default the subject to the first subject of that class.
            const firstSubject = assignments.find(
              (a) => a.classId && String(a.classId) === String(classList[0].classId)
            );
            if (firstSubject?.subjectId) setSelectedSubject(firstSubject.subjectId);
          }
          setSubjects([]);
        } else {
          const cRes = await getClasses().catch(() => ({ classes: [] }));
          const classList = cRes.classes || [];
          setClasses(classList);
          const subjectRes = await viewSubjects();
          const subjectList = subjectRes.subjects || [];
          setSubjects(subjectList);
          if (classList.length > 0) setSelectedClass(classList[0].classId);
          if (subjectList.length > 0) setSelectedSubject(subjectList[0].subjectId);
        }
      } catch {
        setError("Failed to load classes configuration setup.");
      }
    };
    fetchInitialData();
  }, [isTeacher]);

  // Fetch Attendance Log Matrix (accepts optional overrides so the summary view
  // can jump straight into marking an unmarked day)
  const handleLoadSheet = useCallback(async (overrides = {}) => {
    const cls = overrides.classId ?? selectedClass;
    const subj = overrides.subjectId ?? selectedSubject;
    const day = overrides.date ?? date;
    const slot = overrides.timeSlot ?? timeSlot;
    if (!cls || !subj || !day) {
      setError("Please pick a Class, Subject, and Date explicitly.");
      return;
    }
    console.log("selectedClass =", cls);
    console.log("selectedSubject =", subj);
    console.log("date =", day);
    console.log("timeSlot =", slot);
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await getAttendanceSheet(cls, subj, day, slot);
      
      setRecords(res.data?.records || []);
      setIsNewSheet(res.isNewSheet);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch attendance logs.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject, date, timeSlot]);

  // Toggle status inside local memory array state
  const toggleStatus = (studentProfileId) => {
    setRecords(prev =>
      prev.map(rec => {
        if (rec.studentProfileId === studentProfileId) {
          return {
            ...rec,
            status: rec.status === "PRESENT" ? "ABSENT" : "PRESENT"
          };
        }
        return rec;
      })
    );
  };

  // Handle remarks change inline
  const handleRemarksChange = (studentProfileId, text) => {
    setRecords(prev =>
      prev.map(rec =>
        rec.studentProfileId === studentProfileId ? { ...rec, remarks: text } : rec
      )
    );
  };

  // Bulk mark state manipulations
  const markAllStatus = (targetStatus) => {
    setRecords(prev => prev.map(rec => ({ ...rec, status: targetStatus })));
  };

  // Submit collection to backend route
  const handleSaveAttendance = async () => {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const payload = {
        classId: selectedClass,
        subjectId: selectedSubject,
        date,
        timeSlot,
        records
      };
      
      await saveAttendanceSheet(payload);
      setSuccessMessage("Attendance records synchronized and registered cleanly!");
      setIsNewSheet(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to commit attendance records.");
    } finally {
      setSaving(false);
    }
  };

  // The subject dropdown options: admins see every school subject; teachers
  // see only the subjects they teach in the currently selected class.
  const subjectOptions = isTeacher
    ? [...new Map(
        teacherAssignments
          .filter((a) => a.classId && String(a.classId) === String(selectedClass))
          .map((a) => [String(a.subjectId), { subjectId: a.subjectId, name: a.subjectName }])
      ).values()]
    : subjects;

  // Switching class resets the subject (teachers only see that class's subjects).
  const handleClassChange = (e) => {
    const value = e.target.value;
    setSelectedClass(value);
    if (isTeacher) {
      const firstSubject = teacherAssignments.find(
        (a) => a.classId && String(a.classId) === String(value)
      );
      setSelectedSubject(firstSubject?.subjectId || "");
    }
    clearSummary();
    clearRegister();
  };

  // ─── Monthly subject summary (subject-wise register) ───────────────────
  const clearSummary = () => setSummary(null);
  const clearRegister = () => setRegister(null);

  const handleLoadSummary = async () => {
    if (!selectedClass || !selectedSubject) {
      setSummaryError("Please pick a Class and Subject (above) first.");
      return;
    }
    const [year, month] = summaryMonth.split("-");
    if (!year || !month) {
      setSummaryError("Please pick a month first.");
      return;
    }
    setSummaryLoading(true);
    setSummaryError("");
    setSummary(null);
    try {
      const res = await getSubjectAttendanceSummary(selectedClass, selectedSubject, month, year);
      setSummary(res.summary || null);
    } catch (err) {
      setSummaryError(err.response?.data?.message || "Failed to load the monthly summary.");
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Clicking an UNMARKED day in the register jumps straight to marking that sheet
  const jumpToDaySheet = (dateStr) => {
    setDate(dateStr);
    handleLoadSheet({ classId: selectedClass, subjectId: selectedSubject, date: dateStr });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pctBadgeStyle = (pct) => {
    if (pct === null || pct === undefined) return "bg-slate-100 text-slate-500";
    if (pct >= 75) return "bg-green-100 text-green-700";
    if (pct >= 60) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  // ─── Daily register (whole day at a glance) ─────────────────────────────
  const handleLoadRegister = async () => {
    if (!selectedClass || !date) {
      setRegisterError("Please pick a Class and Date first.");
      return;
    }
    setRegisterLoading(true);
    setRegisterError("");
    setRegister(null);
    try {
      const res = await getDailyRegister(selectedClass, date);
      setRegister(res.register || null);
    } catch (err) {
      setRegisterError(err.response?.data?.message || "Failed to load the daily register.");
      setRegister(null);
    } finally {
      setRegisterLoading(false);
    }
  };

  // Clicking an unmarked period in the register opens that subject's sheet for marking.
  // timeSlot state is synced too, so "Save Attendance Sheet" writes to the same period.
  const jumpToMarkPeriod = (rp) => {
    setSelectedSubject(rp.subject?.subjectId || "");
    setTimeSlot(`Period${rp.periodNumber}`);
    handleLoadSheet({ classId: selectedClass, subjectId: rp.subject?.subjectId, date, timeSlot: `Period${rp.periodNumber}` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Download the whole year (12 monthly worksheets + summary) as an .xlsx register
  const handleExportYear = async () => {
    if (!selectedClass || !selectedSubject) {
      setSummaryError("Please pick a Class and Subject first to export.");
      return;
    }
    const year = summaryMonth.split("-")[0];
    if (!year) {
      setSummaryError("Please pick a month/year first to export.");
      return;
    }
    setExporting(true);
    setSummaryError("");
    try {
      const filename = await downloadAnnualAttendance(selectedClass, selectedSubject, year);
      setSuccessMessage(`Annual register downloaded: ${filename}`);
    } catch (err) {
      setSummaryError(err.response?.data?.message || "Failed to export the annual register.");
    } finally {
      setExporting(false);
    }
  };

  // Computed summary fields
  const totalStudents = records.length;
  const presentCount = records.filter(r => r.status === "PRESENT").length;
  const absentCount = totalStudents - presentCount;

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-shadow bg-white";

  return (
    <div>
      {/* Header details */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance Tracker</h1>
        <p className="text-slate-500 mt-1">
          {isTeacher
            ? "Mark attendance for the classes and subjects assigned to you."
            : "Review, check, and commit daily student classroom rosters cleanly."}
        </p>
      </div>

      {/* No-assignments hint for teachers */}
      {isTeacher && classes.length === 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            You haven't been assigned any class + subject yet, so you can't mark attendance.
            Ask the school admin to add your subjects on the <strong>Class Subjects</strong> page.
          </span>
        </div>
      )}

      {/* Notifications banner framework */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="text-green-400 hover:text-green-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Control Filter Bar Panel */}
      <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Class</label>
            <select value={selectedClass} onChange={handleClassChange} className={inputClass}>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>{c.name} ({c.section})</option>
              ))}
            </select>
          </div>
           {/* <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Class</label>
            <select value={selectedClass} onChange={(e) =>console.log(e.target.value)} className={inputClass}>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c._id}{c.name} {c.section}</option>
              ))}
            </select>
          </div> */}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Subject</label>
            <select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); clearSummary(); }} className={inputClass}>
              <option value="">Select Subject</option>
              {subjectOptions.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); clearRegister(); }} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Time Slot</label>
            <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className={inputClass}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={`Period${n}`}>Period {n}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleLoadSheet}
              disabled={loading}
              className="w-full bg-slate-800 text-white text-sm font-medium h-9 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Fetch Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Workspace Render */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-xs">Assembling student list metadata…</p>
          </div>
        </div>
      ) : records.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          
          {/* Dashboard Summary Sub-header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">Total: {totalStudents}</span>
              <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Present: {presentCount}</span>
              <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full">Absent: {absentCount}</span>
              <span className={`px-2.5 py-1 rounded-full font-semibold ${isNewSheet ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                {isNewSheet ? "⚡ New Active Template" : "💾 Saved Records Document"}
              </span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => markAllStatus("PRESENT")}
                className="text-xs font-semibold px-3 py-1.5 border border-green-200 text-green-700 bg-green-50/50 hover:bg-green-100 rounded-lg transition-colors"
              >
                Mark All Present
              </button>
              <button
                onClick={() => markAllStatus("ABSENT")}
                className="text-xs font-semibold px-3 py-1.5 border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100 rounded-lg transition-colors"
              >
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Table Data View */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-left font-medium">
                  <th className="px-6 py-3.5">Roll No.</th>
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5 text-center">Status Action</th>
                  <th className="px-6 py-3.5">Remarks / Exceptions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const studentInfo = row.studentDetails || {};
                  // Alternate nested fallback parsing based on mongoose populate parameters
                  const fName = studentInfo.firstName || row.studentProfileId?.userId?.firstName || "—";
                  const lName = studentInfo.lastName || row.studentProfileId?.userId?.lastName || "";
                  const roll = studentInfo.rollNumber || row.studentProfileId?.rollNumber || "—";
                  const isPresent = row.status === "PRESENT";

                  return (
                    <tr key={row.studentProfileId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-600 text-xs">
                        {roll}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            isPresent ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {`${fName[0] || ""}${lName[0] || ""}`}
                          </div>
                          <span className="font-medium text-slate-700">{fName} {lName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleStatus(row.studentProfileId)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            isPresent 
                              ? "bg-green-600 text-white shadow-sm shadow-green-100" 
                              : "bg-red-600 text-white shadow-sm shadow-red-100"
                          }`}
                        >
                          {row.status}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          placeholder="e.g. Sick Leave, Late arrival"
                          value={row.remarks || ""}
                          onChange={(e) => handleRemarksChange(row.studentProfileId, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-1 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs text-slate-600 transition-colors"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Form Submit Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60 shadow-md shadow-blue-50"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? "Registering logs…" : "Save Attendance Sheet"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 text-slate-400 shadow-lg">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No classroom matrix loaded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Select parameters above and click &quot;Fetch Sheet&quot; to manage layout logs.</p>
        </div>
      )}

      {/* ══════════ Monthly Subject Summary (subject-wise register) ══════════ */}
      <div className="mt-10">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Monthly Subject Summary</h2>
            <p className="text-slate-500 mt-1 text-sm">
              Subject-wise register: students × days for the whole month. Uses the Class &amp; Subject selected above.
            </p>
          </div>
          <button
            onClick={handleExportYear}
            disabled={exporting}
            className="bg-blue-600 text-white text-sm font-semibold h-9 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-blue-100"
            title="Download the full year (12 monthly sheets + summary) as an Excel register"
          >
            {exporting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {exporting ? "Preparing…" : "Download Year (Excel)"}
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Month</label>
              <input
                type="month"
                value={summaryMonth}
                onChange={(e) => { setSummaryMonth(e.target.value); clearSummary(); }}
                className={inputClass}
              />
            </div>
            <div>
              <button
                onClick={handleLoadSummary}
                disabled={summaryLoading}
                className="w-full bg-slate-800 text-white text-sm font-medium h-9 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {summaryLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Load Summary
              </button>
            </div>
          </div>
        </div>

        {summaryError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
            <span>{summaryError}</span>
            <button onClick={() => setSummaryError("")} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {summaryLoading ? (
          <div className="flex items-center justify-center min-h-[20vh]">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs">Pivoting the register…</p>
            </div>
          </div>
        ) : summary ? (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            {/* Summary sub-header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3 text-xs font-medium">
              <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
                {summary.class?.name} {summary.class?.section} · {summary.subject?.name}
              </span>
              <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                Class Avg: {summary.classStats?.averagePercentage ?? "—"}%
              </span>
              <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                Unmarked days: {summary.classStats?.unmarkedSheets ?? 0}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-green-100 text-green-700">P</span>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-red-100 text-red-700">A</span>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-amber-100 text-amber-700">L</span>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-blue-100 text-blue-700">E</span>
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-orange-50 text-orange-500 border border-dashed border-orange-200">?</span>
                <span className="text-slate-400 text-[10px] uppercase tracking-wider ml-1">? = not marked · click to mark</span>
              </span>
            </div>

            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-slate-50/95 text-slate-400 text-left font-medium backdrop-blur">
                    <th className="px-4 py-3 sticky left-0 bg-slate-50">Roll No.</th>
                    <th className="px-4 py-3 sticky left-0 bg-slate-50">Student Name</th>
                    {summary.dates.map((d) => (
                      <th key={d.date} className="px-1.5 py-3 text-center" title={`${d.day} · ${d.date}${d.scheduled ? "" : " (no class)"}`}>
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-slate-600 font-semibold">{d.date.slice(-2)}</span>
                          <span className="text-[9px] text-slate-400 uppercase">{d.day.slice(0, 3)}</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((student) => (
                    <tr key={student.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-600 text-xs sticky left-0 bg-white">{student.rollNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-white">{student.name}</td>
                      {summary.dates.map((d) => {
                        const status = student.days[d.date];
                        const isUnmarked = status === "UNMARKED";
                        return (
                          <td key={d.date} className="px-1.5 py-2.5 text-center">
                            <button
                              type="button"
                              disabled={!isUnmarked}
                              onClick={() => isUnmarked && jumpToDaySheet(d.date)}
                              title={`${d.date} · ${status === "NO_CLASS" ? "No class" : status}`}
                              className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center transition-all ${
                                STATUS_CELL_STYLE[status] || "bg-slate-50 text-slate-400"
                              } ${isUnmarked ? "cursor-pointer hover:ring-2 hover:ring-orange-300 hover:scale-110" : "cursor-default"}`}
                            >
                              {STATUS_LETTER[status] || "·"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block min-w-12 px-2 py-1 rounded-full text-xs font-bold ${pctBadgeStyle(student.percentage)}`}
                          title={`Present: ${student.present} · Late: ${student.late} · Absent: ${student.absent} · Leave: ${student.leave}`}
                        >
                          {student.percentage ?? "—"}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 text-slate-400 shadow-lg">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No monthly summary loaded yet.</p>
            <p className="text-xs text-slate-400 mt-1">Pick a month and click &quot;Load Summary&quot; to render the subject-wise register.</p>
          </div>
        )}
      </div>

      {/* ══════════ Daily Register (whole day at a glance) ══════════ */}
      <div className="mt-10">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">Daily Register</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Whole-day view: every period from the timetable for the selected Class &amp; Date, with each student&apos;s status per period.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-slate-500">
            Uses the <span className="font-semibold text-slate-700">Class</span> and <span className="font-semibold text-slate-700">Date</span> selected above.
          </p>
          <button
            onClick={handleLoadRegister}
            disabled={registerLoading}
            className="bg-slate-800 text-white text-sm font-medium h-9 px-4 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {registerLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Load Day View
          </button>
        </div>

        {registerError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
            <span>{registerError}</span>
            <button onClick={() => setRegisterError("")} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {registerLoading ? (
          <div className="flex items-center justify-center min-h-[20vh]">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs">Pulling today&apos;s timetable…</p>
            </div>
          </div>
        ) : register ? (
          register.periods.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 text-slate-400 shadow-lg">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No classes scheduled for {register.day}, {register.date}.</p>
              <p className="text-xs text-slate-400 mt-1">Add routine periods for this day in the timetable to see the register.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              {/* Register sub-header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3 text-xs font-medium">
                <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
                  {register.class?.name} {register.class?.section} · {register.day}, {register.date}
                </span>
                <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">Periods: {register.stats?.totalPeriods}</span>
                <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Marked: {register.stats?.markedPeriods}</span>
                <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">Unmarked: {register.stats?.unmarkedPeriods}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-green-100 text-green-700">P</span>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-red-100 text-red-700">A</span>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-amber-100 text-amber-700">L</span>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-blue-100 text-blue-700">E</span>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-orange-50 text-orange-500 border border-dashed border-orange-200">?</span>
                  <span className="text-slate-400 text-[10px] uppercase tracking-wider ml-1">? = not marked · click to mark</span>
                </span>
              </div>

              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-100 bg-slate-50/95 text-slate-400 text-left font-medium backdrop-blur">
                      <th className="px-4 py-3 sticky left-0 bg-slate-50">Roll No.</th>
                      <th className="px-4 py-3 sticky left-0 bg-slate-50">Student Name</th>
                      {register.periods.map((rp) => (
                        <th key={rp.periodId} className="px-1.5 py-3 text-center" title={`${rp.subject?.name || "—"} · ${rp.startTime}–${rp.endTime}${rp.teacher ? ` · ${rp.teacher.name}` : ""}`}>
                          <div className="flex flex-col items-center leading-tight">
                            <span className="text-slate-600 font-semibold">{rp.subject?.name || "—"}</span>
                            <span className="text-[9px] text-slate-400">{rp.startTime}–{rp.endTime}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {register.students.map((student) => (
                      <tr key={student.studentId} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-600 text-xs sticky left-0 bg-white">{student.rollNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-white">{student.name}</td>
                        {register.periods.map((rp) => {
                          const status = student.cells[rp.periodId];
                          const isUnmarked = !rp.marked;
                          return (
                            <td key={rp.periodId} className="px-1.5 py-2.5 text-center">
                              <button
                                type="button"
                                disabled={!isUnmarked}
                                onClick={() => isUnmarked && jumpToMarkPeriod(rp)}
                                title={
                                  isUnmarked
                                    ? `${rp.subject?.name || "Period"} — not marked yet, click to mark`
                                    : `${rp.subject?.name || "Period"} · ${status || "not on sheet"}`
                                }
                                className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center transition-all ${
                                  STATUS_CELL_STYLE[status] || "bg-slate-50 text-slate-300"
                                } ${isUnmarked ? "cursor-pointer hover:ring-2 hover:ring-orange-300 hover:scale-110" : "cursor-default"}`}
                              >
                                {isUnmarked ? "?" : STATUS_LETTER[status] || "–"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 text-slate-400 shadow-lg">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No daily register loaded yet.</p>
            <p className="text-xs text-slate-400 mt-1">Pick a class &amp; date and click &quot;Load Day View&quot; to see the whole timetable.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;