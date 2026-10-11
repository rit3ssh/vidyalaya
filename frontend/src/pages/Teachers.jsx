import { useState, useEffect, useCallback } from "react";
import Modal from "../components/layout/Modal";
import { getUsers, createUser, updateUser, deleteUser } from "../services/api.js";

const emptyForm = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  qualification: "",
  joiningDate: "",
  designation: "",
  role: "TEACHER",
});

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Generated password display
  const [generatedPassword, setGeneratedPassword] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getUsers("TEACHER");
      setTeachers(Array.isArray(res) ? res : []);
    } catch {
      setError("Failed to load teachers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAddModal = () => {
    setModalMode("add");
    setEditingId(null);
    setFormData(emptyForm());
    console.log(formData);
    setGeneratedPassword(null);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode("edit");
    setEditingId(item._id);
    setFormData({
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      email: item.email || "",
      phoneNumber: item.phoneNumber || "",
      qualification: item.teacherProfile?.qualification || "",
      joiningDate: item.teacherProfile?.joiningDate ? new Date(item.teacherProfile.joiningDate).toISOString().split("T")[0] : "",
      designation: item.teacherProfile?.designation || "",
      role: "TEACHER",
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
        const res = await createUser(formData);
        if (res.password) {
          setGeneratedPassword(res.password);
          setModalOpen(false);
        }
      } else {
        await updateUser(editingId, formData);
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
      await deleteUser(id);
      setConfirmDelete(null);
      await fetchData();
    } catch {
      setError("Failed to delete teacher");
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 text-sm transition-shadow";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading teachers…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
        <p className="text-slate-500 mt-1">Manage your school&apos;s teachers.</p>
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
          <p className="font-medium mb-1">Teacher created successfully!</p>
          <p>Generated password: <span className="font-mono font-bold bg-green-100 px-2 py-0.5 rounded">{generatedPassword}</span></p>
          <p className="text-xs text-green-600 mt-1">Share this password with the teacher. It won&apos;t be shown again.</p>
          <button onClick={() => setGeneratedPassword(null)} className="mt-2 text-xs text-green-600 hover:text-green-800 underline">Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            Teachers ({teachers.length})
          </h3>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Teacher
          </button>
        </div>

        {teachers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm">No teachers added yet.</p>
            <button onClick={openAddModal} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Add your first teacher
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Name</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Email</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Phone</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Joining Date</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Qualification</th>
                  <th className="text-left font-medium text-slate-400 px-6 py-4">Designation</th>
                  <th className="text-right font-medium text-slate-400 px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-600">
                          {`${t.firstName?.[0] || ""}${t.lastName?.[0] || ""}`}
                        </div>
                        <span className="font-medium text-slate-700">{t.firstName} {t.lastName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{t.email}</td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{t.phoneNumber || "—"}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {t.joiningDate ? new Date(t.joiningDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {t.qualification || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {t.designation || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: t._id, name: `${t.firstName} ${t.lastName}` })}
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
        title={modalMode === "add" ? "Add Teacher" : "Edit Teacher"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
              <input name="firstName" value={formData.firstName} onChange={handleFormChange} required className={inputClass} placeholder="Jane" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
              <input name="lastName" value={formData.lastName} onChange={handleFormChange} required className={inputClass} placeholder="Smith" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input name="email" type="email" value={formData.email} onChange={handleFormChange} required className={inputClass} placeholder="teacher@school.edu" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleFormChange} required className={inputClass} placeholder="9800000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Joining Date</label>
            <input name="joiningDate" type="date" value={formData.joiningDate} onChange={handleFormChange} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Qualification</label>
            <input name="qualification" value={formData.qualification} onChange={handleFormChange} required className={inputClass} placeholder="M.Sc, B.Ed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
            <input name="designation" value={formData.designation} onChange={handleFormChange} required className={inputClass} placeholder="Senior Teacher" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 ">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? "Saving…" : modalMode === "add" ? "Add Teacher" : "Update Teacher"}
            </button>
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

export default Teachers;
