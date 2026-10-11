import { useState } from "react";
import { useAuth } from "../services/auth.context.jsx";

function SignUp({ onSwitchToLogin }) {
  const { register, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    schoolName: "",
    schoolAddress: "",
    schoolEmail: "",
    schoolPhoneNumber: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLocalError("");

    const { schoolName, schoolAddress, schoolEmail, schoolPhoneNumber, firstName, lastName, email, phoneNumber, password } =
      formData;

    if (
      !schoolName.trim() ||
      !schoolAddress.trim() ||
      !schoolEmail.trim() ||
      !schoolPhoneNumber.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phoneNumber.trim() ||
      !password.trim()
    ) {
      setLocalError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register(formData);
      // On success, user is set in context and App will re-render to Dashboard
    } catch {
      // Error is set in context by the register function
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Vidyalaya</h1>
          <p className="text-slate-500 mt-1">Register your school</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {displayError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  First name
                </label>
                <input
                  type="text"
                  id="firstName"
                  autoComplete="given-name"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             placeholder:text-slate-400 transition-shadow"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Last name
                </label>
                <input
                  type="text"
                  id="lastName"
                  autoComplete="family-name"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             placeholder:text-slate-400 transition-shadow"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Admin email address
              </label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="admin@school.edu"
                value={formData.email}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Admin phone number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                autoComplete="tel"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="9800000000"
                value={formData.phoneNumber}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <hr className="border-slate-200" />

            <div>
              <label
                htmlFor="schoolName"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                School name
              </label>
              <input
                type="text"
                id="schoolName"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="Springfield Elementary"
                value={formData.schoolName}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="schoolAddress"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                School address
              </label>
              <input
                type="text"
                id="schoolAddress"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="123 Education St."
                value={formData.schoolAddress}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="schoolEmail"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                School email
              </label>
              <input
                type="email"
                id="schoolEmail"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="info@school.edu"
                value={formData.schoolEmail}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="schoolPhoneNumber"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                School phone number
              </label>
              <input
                type="tel"
                id="schoolPhoneNumber"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder:text-slate-400 transition-shadow"
                placeholder="9800000000"
                value={formData.schoolPhoneNumber}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg
                         hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-colors duration-200 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 font-medium hover:text-blue-700 transition-colors bg-transparent border-none p-0 cursor-pointer"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
