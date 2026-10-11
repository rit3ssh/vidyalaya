import { createContext, useState, useEffect, useContext, useCallback } from "react";
import { login as apiLogin, register as apiRegister, logout as apiLogout } from "./api.js";

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // On mount, restore session from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setError("");
    try {
      const data = await apiLogin({ email, password });
      const userData = data.user;
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      return userData;
    } catch (err) {
      const message =
        err.response?.data?.message || "Login failed. Please try again.";
      setError(message);
      throw err;
    }
  }, []);

  const register = useCallback(async (formData) => {
    setError("");
    try {
      const data = await apiRegister(formData);
      const userData = data.user;
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      return userData;
    } catch (err) {
      const message =
        err.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Even if the API call fails, clear local state
    } finally {
      setUser(null);
      localStorage.removeItem("user");
    }
  }, []);

  const clearError = useCallback(() => setError(""), []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, setLoading, error, login, register, logout, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};
