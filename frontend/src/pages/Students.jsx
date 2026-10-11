import { useState, useEffect, useCallback } from "react";
import Modal from "../components/layout/Modal";
import { getUsers, admitStudent, updateStudentAdmission, deleteStudentAdmission ,getClasses} from "../services/api.js";

const emptyForm = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  dateOfBirth: "",
  admissionDate: "",
  rollNumber: "",
  admissionNumber: "",
  classId: "",
  parentProfileId:"",
  parentFirstName: "",
  parentLastName: "",
  parentEmail: "",
  parentPhoneNumber: "",
  parentOccupation: "",
  parentRelationType: "",
  // role: "STUDENT",
});

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // const [studentId,setStudentId]=useState(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingId, setEditingId] = useState(null);///basically student ID
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

 const [classes, setClasses] = useState([]);
  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Generated password display
  const [generatedPassword, setGeneratedPassword] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getUsers("STUDENT");
      setStudents(Array.isArray(res) ? res : []);
      const classesRes = await getClasses();
      setClasses(Array.isArray(classesRes.classes) ? classesRes.classes : []);
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAddModal = () => {
    //remove parentProfileId from formData when adding a new student
    setModalMode("add");
    setEditingId(null);
    setFormData(emptyForm());
    setGeneratedPassword(null);
    setModalOpen(true);
  };

  const openEditModal = (studentUser) => {
    // const[parentFirstName,parentLastName]=studentUser.studentProfile.parents[0].name.split(" ") || ["", ""]
    setModalMode("edit");
    setEditingId(studentUser.studentProfile._id);
    setFormData({
      firstName: studentUser.firstName || "",
      lastName: studentUser.lastName || "",
      email: studentUser.email || "",
      phoneNumber: studentUser.phoneNumber || "",
      dateOfBirth: studentUser.studentProfile.dateOfBirth ? new Date(studentUser.studentProfile.dateOfBirth).toISOString().split("T")[0] : "",
      admissionDate: studentUser.studentProfile.admissionDate ? new Date(studentUser.studentProfile.admissionDate).toISOString().split("T")[0] : "",
      rollNumber: studentUser.studentProfile.rollNumber || "",
      admissionNumber: studentUser.studentProfile.admissionNumber || "",
      classId: studentUser.studentProfile.classId?._id || "",
      parentProfileId: studentUser.studentProfile.parents?.[0]?.parentId || "",
      parentFirstName: studentUser.studentProfile.parents?.[0]?.parentFirstName || "",
      parentLastName: studentUser.studentProfile.parents?.[0]?.parentLastName || "",
      parentEmail: studentUser.studentProfile.parents?.[0]?.email || "",
      parentPhoneNumber: studentUser.studentProfile.parents?.[0]?.phoneNumber || "",
      parentOccupation: studentUser.studentProfile.parents?.[0]?.occupation || "",
      parentRelationType: studentUser.studentProfile.parents?.[0]?.relationType || "",
      role: "STUDENT",
    });
    setGeneratedPassword(null);
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (modalMode === "add") {
        const data = {"student":{
          "firstName":formData.firstName,
          "lastName":formData.lastName,
          "email":formData.email,
          "phoneNumber":formData.phoneNumber,
          "dateOfBirth":formData.dateOfBirth,
          "admissionDate":formData.admissionDate,
          "rollNumber":formData.rollNumber,
          "admissionNumber":formData.admissionNumber,
          "classId":formData.classId,
        },"parents":[
          {
            "firstName":formData.parentFirstName,
            "lastName":formData.parentLastName,
            "email":formData.parentEmail,
            "phoneNumber":formData.parentPhoneNumber,
            "occupation":formData.parentOccupation,
            "relationType":formData.parentRelationType
          }]
        }
        console.log("Adding new student with data:", data);
        const res = await admitStudent(data);
        if (res.password) {
          setGeneratedPassword(res.password);
          setModalOpen(false);
        }
      } else {
        // console.log(`Updating student with ID: ${editingId}`, formData);
            const data={"student":{
              "firstName":formData.firstName,
              "lastName":formData.lastName,
              "email":formData.email,
              "phoneNumber":formData.phoneNumber,
              "dateOfBirth":formData.dateOfBirth,
              "admissionDate":formData.admissionDate,
              "rollNumber":formData.rollNumber,
              "admissionNumber":formData.admissionNumber,
              "classId":formData.classId,

            },
          "parents":[
            {
              "parentProfileId":formData.parentProfileId,
              "firstName":formData.parentFirstName,
              "lastName":formData.parentLastName,
              "email":formData.parentEmail,
              "phoneNumber":formData.parentPhoneNumber,
              "occupation":formData.parentOccupation,
              "relationType":formData.parentRelationType

              
            }
          ]}
          console.log("UPDATE STUDENT from students.jsx")
          console.log(editingId,data)
          
        await updateStudentAdmission(editingId, data);
        setModalOpen(false);
      }
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      console.log(`Deleting student with ID: ${id}`);
      await deleteStudentAdmission(id);
      // await deleteUser(id);
      setConfirmDelete(null);
      await fetchData();
    } catch (err) {
      setError("Failed to delete student");
    }
  };
  // console.log("Classes state structure:", classes);
  const inputClass =
    "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading students…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Students</h1>
        <p className="text-slate-500 mt-1">Manage your school&apos;s students.</p>
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

      {/* Generated password banner */}
      {generatedPassword && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">
          <p className="font-medium mb-1">Student created successfully!</p>
          <p>Generated password: <span className="font-mono font-bold bg-green-100 px-2 py-0.5 rounded">{generatedPassword}</span></p>
          <p className="text-xs text-green-600 mt-1">Share this password with the student. It won&apos;t be shown again.</p>
          <button onClick={() => setGeneratedPassword(null)} className="mt-2 text-xs text-green-600 hover:text-green-800 underline">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            Students ({students.length})
          </h3>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Student
          </button>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-sm">No students added yet.</p>
            <button onClick={openAddModal} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Add your first student
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="sticky left-0 z-10 bg-white text-left font-medium text-slate-400 px-6 py-4">Name</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Email</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Phone</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">RoleNumber</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">AdmissionNumber</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Class</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">DOB</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">AdmissionDate</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Parent</th>
                  {/* <th className="text-left font-medium text-slate-400 px-6 py-4">RelationType</th> */}
                  <th className="text-left font-medium text-slate-400 px-6 py-4">ParentPhoneNumber</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">ParentEmail</th>
                  {/* <th className="text-left font-medium text-slate-400 px-6 py-4">Created</th> */}
                  <th className="text-right font-medium text-slate-400 px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap">
                      {/* <div className="flex items-center gap-3"> */}
                        {/* <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600"> */}
                          {/* {`${s.firstName?.[0] || ""}${s.lastName?.[0] || ""}`} */}
                        {/* </div> */}
                        <span className="font-medium text-slate-500">{s.firstName} {s.lastName}</span>
                        {/* {s.studentProfile._id} */}
                      {/* </div> */}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{s.email}</td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{s.phoneNumber || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.rollNumber || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.admissionNumber || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.classId?.name} {s.studentProfile.classId?.section || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.dateOfBirth ? new Date(s.studentProfile.dateOfBirth).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.admissionDate ? new Date(s.studentProfile.admissionDate).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.parents[0].parentFirstName} {s.studentProfile.parents[0].parentLastName || "—"}</td>
                    {/* <td className="px-6 py-4 text-slate-500">{s.parentProfile?.relationType || "—"}</td> */}
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.parents[0].phoneNumber || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{s.studentProfile.parents[0].email || "—"}</td>

                    {/* <td className="px-6 py-4 text-slate-400 text-xs">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                    </td> */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: s.studentProfile._id, name: `${s.firstName} ${s.lastName}` })}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
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
        title={modalMode === "add" ? "Add Student" : "Update Student"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
              <input name="firstName" value={formData.firstName} onChange={handleFormChange} required className={inputClass} placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
              <input name="lastName" value={formData.lastName} onChange={handleFormChange} required className={inputClass} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input name="email" type="email" value={formData.email} onChange={handleFormChange} required className={inputClass} placeholder="student@school.edu" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
            <input name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleFormChange} required className={inputClass} placeholder="9800000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date Of Birth</label>
            <input name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleFormChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Admission Date</label>
            <input name="admissionDate" type="date" value={formData.admissionDate} onChange={handleFormChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Roll Number</label>
            <input name="rollNumber" value={formData.rollNumber} onChange={handleFormChange} required className={inputClass} placeholder="S001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Admission Number</label>
            <input name="admissionNumber" value={formData.admissionNumber} onChange={handleFormChange} required className={inputClass} placeholder="ADM-2026-001" />
          </div>
          {/* <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            <input name="classId" value={formData.classId} onChange={handleFormChange} required className={inputClass} placeholder="Class ID" />
          </div> */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            <select name="classId" value={formData.classId} onChange={handleFormChange} required className={inputClass}>
              <option value="" disabled>Select Class</option>
              {classes.map((cls,index) => (
                <option key={cls.classId || index} value={cls.classId}>
                  {cls.name} {cls.section}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Parent Details</h3>
            <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
              <input name="parentFirstName" value={formData.parentFirstName} onChange={handleFormChange} required className={inputClass} placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
              <input name="parentLastName" value={formData.parentLastName} onChange={handleFormChange} required className={inputClass} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input name="parentEmail" type="email" value={formData.parentEmail} onChange={handleFormChange} required className={inputClass} placeholder="parents email" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
            <input name="parentPhoneNumber" type="tel" value={formData.parentPhoneNumber} onChange={handleFormChange} required className={inputClass} placeholder="9800000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Occupation</label>
            <input name="parentOccupation" value={formData.parentOccupation} onChange={handleFormChange} required className={inputClass} placeholder="Occupation" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Relation</label>
            <select name="parentRelationType" value={formData.parentRelationType} onChange={handleFormChange} required className={inputClass}>
              <option value="" disabled>Select Relation</option>
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Guardian">Guardian</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? "Saving…" : modalMode === "add" ? "Add Student" : "Update Student"}
            </button>
          </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirm Delete"
      >
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

export default Students;
