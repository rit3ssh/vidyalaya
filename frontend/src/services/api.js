import axios from "axios"

const api = axios.create({
    baseURL: "http://localhost:4000",
    withCredentials: true
})

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function register({ schoolName, schoolAddress, schoolEmail, schoolPhoneNumber, firstName, lastName, email, password, phoneNumber }) {
    const response = await api.post('/api/auth/register', {
        schoolName, schoolAddress, schoolEmail, schoolPhoneNumber, firstName, lastName, email, password, phoneNumber
    })
    return response.data
}

export async function login({ email, password }) {
    const response = await api.post("/api/auth/login", { email, password })
    return response.data
}

export async function logout() {
    const response = await api.get("/api/auth/logout")
    return response.data
}

// ─── Users CRUD (unified) ───────────────────────────────────────────────────

// List users by role: GET /api/users?role=TEACHER
export async function getUsers(role) {
    const params = role ? { role } : {}
    const response = await api.get("/api/users", { params })
    return response.data
}

// Create any user: POST /api/users
export async function createUser(data) {
    console.log("API: createUser called with data:", data);
    const response = await api.post("/api/users", data)
    return response.data
}

// Update any user: PUT /api/users/:id
export async function updateUser(userId, data) {
    const response = await api.put(`/api/users/${userId}`, data)
    return response.data
}

// Delete any user: DELETE /api/users/:id
export async function deleteUser(userId) {
    const response = await api.delete(`/api/users/${userId}`)
    return response.data
}

// ─── Self-service ───────────────────────────────────────────────────────────

export async function getMe() {
    const response = await api.get("/api/users/me")
    return response.data
}

export async function updateMe(data) {
    const response = await api.put("/api/users/me", data)
    return response.data
}


// ─── Admissions ──────────────────────────────────────────────────────────────
export async function admitStudent(data) {
    const response = await api.post("/api/admissions", data)
    return response.data
}

export async function updateStudentAdmission(studentId, data) {
    // console.log("API: updateStudentAdmission called with studentId:", studentId, "and data:", data);
    const response = await api.put(`/api/admissions/${studentId}`, data)
    return response.data
}

export async function deleteStudentAdmission(studentId) {
    const response = await api.delete(`/api/admissions/${studentId}`)
    return response.data





}
// ─── Classes ────────────────────────────────────────────────────────────────
    
export async function getClasses() {
    const response = await api.get("/api/academics/view-class")
    return response.data
}

export async function addClass(data) {
    const response = await api.post("/api/academics/add-class", data)
    return response.data
}

export async function updateClass(classId, data) {
    const response = await api.put(`/api/academics/update-class/${classId}`, data)
    return response.data
}

export async function deleteClass(classId) {
    const response = await api.delete(`/api/academics/delete-class/${classId}`)
    return response.data
}



// ________class → subject assignments (admin) ________________
// Which subjects each class teaches and who teaches them — the source the
// exam grid and notes room use. Admin-only.

export async function getClassSubjectAssignments() {
    const response = await api.get("/api/academics/class-subject-assignments")
    return response.data
}

// data: { classId, subjectId, teacherId }
export async function addClassSubjectAssignment(data) {
    const response = await api.post("/api/academics/class-subject-assignments", data)
    return response.data
}

// data: { classId, assignments: [{ subjectId, teacherId }, ...] }
export async function addClassSubjectAssignmentsBulk(data) {
    const response = await api.post("/api/academics/class-subject-assignments/bulk", data)
    return response.data
}

export async function deleteClassSubjectAssignment(assignmentId) {
    const response = await api.delete(`/api/academics/class-subject-assignments/${assignmentId}`)
    return response.data
}



// ________subject management functions _______________________

export async function addSubject(data) {
    const response = await api.post("/api/academics/add-subject", data)
    return response.data
}

export async function viewSubjects() {
    const response = await api.get("/api/academics/view-subject")
    return response.data
}

export async function updateSubject(subjectId, data) {
    const response = await api.put(`/api/academics/update-subject/${subjectId}`, data)
    return response.data
}

export async function deleteSubject(subjectId) {
    const response = await api.delete(`/api/academics/delete-subject/${subjectId}`)
    return response.data
}




// ─── Routine / Timetable ────────────────────────────────────────────────────

export async function getClassRoutine(classId) {
    const response = await api.get(`/api/academics/view-class/${classId}/routene`)
    return response.data
}

// A teacher's own timetable; admins may pass a teacherId to preview another teacher
export async function getMyRoutine(teacherId) {
    const response = await api.get("/api/academics/my-routine", {
        params: teacherId ? { teacherId } : {}
    })
    return response.data
}

export async function addRoutinePeriod(data) {
    const response = await api.post("/api/academics/add-routine-period", data)
    return response.data
}

export async function updateRoutinePeriod(periodId, data) {
    const response = await api.put(`/api/academics/update-routine-period/${periodId}`, data)
    return response.data
}

export async function deleteRoutinePeriod(periodId) {
    const response = await api.delete(`/api/academics/delete-routine-period/${periodId}`)
    return response.data
}




// ─── Notices ────────────────────────────────────────────────────────────────
// Everyone (students, parents, teachers, admins) can read; only SCHOOL_ADMIN
// can create/update/delete. Uploads are multipart/form-data — the backend
// forwards files to ImageKit and stores the returned URLs.

export async function getNotices(limit) {
    const response = await api.get("/api/notices", {
        params: limit ? { limit } : {}
    })
    return response.data
}

export async function getNotice(noticeId) {
    const response = await api.get(`/api/notices/${noticeId}`)
    return response.data
}

// data: FormData with title, description, noticeDate (+ optional image/attachment files)
export async function createNotice(formData) {
    const response = await api.post("/api/notices", formData)
    return response.data
}

// data: FormData with the fields to change (+ optional image/attachment files).
// Send imageUrl="" / attachmentUrl="" to remove an existing file.
export async function updateNotice(noticeId, formData) {
    const response = await api.put(`/api/notices/${noticeId}`, formData)
    return response.data
}

export async function deleteNotice(noticeId) {
    const response = await api.delete(`/api/notices/${noticeId}`)
    return response.data
}


// ─── Notes room ─────────────────────────────────────────────────────────────
// Teachers share notes for an assigned class+subject (multipart/form-data —
// text fields + an optional "file"); students view only their own class's notes.

// The class+subject combos the logged-in teacher is assigned to (for posting)
export async function getNoteAssignments() {
    const response = await api.get("/api/notes/assignments")
    return response.data
}

// List notes for the user's scope (student's class / teacher's own notes).
// Optional subjectId filters by subject. Response also includes `subjects`
// (for the dropdown) and `latestNote` (for the latest-note card).
export async function getNotes(subjectId) {
    const response = await api.get("/api/notes", {
        params: subjectId ? { subjectId } : {}
    })
    return response.data
}

// data: FormData with title, description, classId, subjectId (+ optional file)
export async function createNote(formData) {
    const response = await api.post("/api/notes", formData)
    return response.data
}

// data: FormData with the fields to change (+ optional file).
// Send fileUrl="" to remove an existing file.
export async function updateNote(noteId, formData) {
    const response = await api.put(`/api/notes/${noteId}`, formData)
    return response.data
}

export async function deleteNote(noteId) {
    const response = await api.delete(`/api/notes/${noteId}`)
    return response.data
}


// ─── Exams (upcoming exam routine) ──────────────────────────────────────────
// Everyone in the school can view the routine; only SCHOOL_ADMIN manages it.
// Entries are keyed by className (all sections of a class sit the same exam
// on the same day).

export async function getExamRoutine() {
    const response = await api.get("/api/exams")
    return response.data
}

// Every class name with the subjects assigned to it — for the admin's bulk
// add-exams grid (only a class's own subjects are offered).
export async function getClassSubjects() {
    const response = await api.get("/api/exams/class-subjects")
    return response.data
}

export async function addExam(data) {
    const response = await api.post("/api/exams", data)
    return response.data
}

// entries: [{ className, date, subjectId, startTime, endTime }, ...]
export async function addExamsBulk(entries) {
    const response = await api.post("/api/exams/bulk", { entries })
    return response.data
}

export async function updateExam(examId, data) {
    const response = await api.put(`/api/exams/${examId}`, data)
    return response.data
}

export async function deleteExam(examId) {
    const response = await api.delete(`/api/exams/${examId}`)
    return response.data
}


// ─── Chat (1:1 conversations) ───────────────────────────────────────────────
// Everyone within their role-based scope can chat (students ↔ classmates +
// class teachers, parents ↔ child's class people, teachers ↔ their classes,
// admins ↔ everyone).

// Everyone the current user can start a chat with.
export async function getChatPeople() {
    const response = await api.get("/api/chats/people")
    return response.data
}

// The current user's conversations, newest first, with unread counts.
export async function getChatConversations() {
    const response = await api.get("/api/chats/conversations")
    return response.data
}

// The full thread with one user (marks their messages as read).
export async function getChatMessages(otherUserId) {
    const response = await api.get(`/api/chats/conversations/${otherUserId}/messages`)
    return response.data
}

// Users currently connected (green dots in chat).
export async function getOnlineUsers() {
    const response = await api.get("/api/chats/online")
    return response.data
}

// Send a message to a user (creates the conversation on first contact).
// Accepts { text, file? } — file is uploaded to ImageKit by the backend.
export async function sendChatMessage(otherUserId, { text = "", file = null } = {}) {
    const form = new FormData()
    form.append("text", text)
    if (file) form.append("file", file)
    const response = await api.post(`/api/chats/conversations/${otherUserId}/messages`, form)
    return response.data
}


// ─── Attendance ─────────────────────────────────────────────────────────────
export async function getAttendanceSheet(classId, subjectId, date, timeSlot) {
    // console.log("API: getAttendanceSheet called with params:", { classId, subjectId, date, timeSlot });
    const response = await api.get("/api/attendance", {
        params: { classId, subjectId, date, timeSlot }
    });
    return response.data;
}

export async function saveAttendanceSheet(data) {
    const response = await api.post("/api/attendance/mark-attendance", data);
    return response.data;
}

export async function getSubjectAttendanceSummary(classId, subjectId, month, year) {
    const response = await api.get("/api/attendance/subject-summary", {
        params: { classId, subjectId, month, year }
    });
    return response.data;
}

export async function getDailyRegister(classId, date) {
    const response = await api.get("/api/attendance/register", {
        params: { classId, date }
    });
    return response.data;
}

// Downloads the annual .xlsx register (12 monthly worksheets + summary) for a subject
export async function downloadAnnualAttendance(classId, subjectId, year) {
    const response = await api.get("/api/attendance/export", {
        params: { classId, subjectId, year },
        responseType: "blob"
    });

    const disposition = response.headers["content-disposition"] || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : `Attendance_${year}.xlsx`;

    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return filename;
}