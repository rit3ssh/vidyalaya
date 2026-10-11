import { useAuth } from "../../services/auth.context.jsx";
import { useState } from "react";

// Nav items available to every logged-in user — students, parents and teachers
// always see these.
const commonNavItems = [
  { label: "Dashboard" },
  { label: "Notices" },
  { label: "Exams" },
  { label: "Chat" },
];

// The notes room — teachers share notes for their assigned classes, students
// browse their own class's notes (parents don't have access).
const notesNavItems = [{ label: "Notes" }];

// Available to teaching staff (teachers + admins) — the backend allows both
// roles to view the routine and attendance.
const staffNavItems = [{ label: "Routine" }, { label: "Attendance" }];

// School management pages — SCHOOL_ADMIN only.
const adminNavItems = [
  { label: "Students" },
  { label: "Teachers" },
  { label: "Classes" },
  { label: "Subjects" },
  { label: "Class Subjects" },
];

// Placeholder pages that don't have a dedicated view yet (kept for admins).
const placeholderNavItems = [{ label: "Courses" }];

const Sidebar = ({ onNavigate, activePage }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const isStudent = user?.role === "STUDENT";
  const navItems = [
    ...commonNavItems,
    ...(isTeacher || isStudent ? notesNavItems : []),
    ...(isAdmin || isTeacher ? staffNavItems : []),
    ...(isAdmin ? [...adminNavItems, ...placeholderNavItems] : []),
  ];

  return (
    <aside className="fixed top-0 inset-x-0 h-auto md:w-64 md:static md:h-screen bg-slate-800 text-white flex flex-col p-6 shadow-xl shrink-0 z-50">
      
      {/* Logo Area */}
      <div className="flex items-center justify-between md:justify-start gap-3 mb-4 md:mb-10 w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
            {user?.schoolName?.split(" ")[0]?.[0]?.toUpperCase() || "V"}
          </div>
          <h1 className="text-sm font-bold text-white">{user?.schoolName}</h1>
        </div>

        {/* Hamburger Trigger Toggle (Hidden on desktop viewports) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors focus:outline-none md:hidden"
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Wrapping Navigation and Footer inside a toggleable container block */}
      <div className={`
        /* Mobile Dropdown Mechanics */
        flex-col gap-4 transition-all duration-300 ease-in-out origin-top w-full
        ${isOpen ? "flex opacity-100 scale-y-100 max-h-screen" : "hidden opacity-0 scale-y-95 max-h-0 pointer-events-none"}
        
        /* Desktop Core Overrides */
        md:flex md:opacity-100 md:scale-y-100 md:max-h-full md:pointer-events-auto md:flex-1 md:justify-between
      `}>
        
        {/* Main Navigation Links */}
        <nav className="flex flex-col gap-1 w-full">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onNavigate(item.label);
                setIsOpen(false); // Automatically closes mobile menu drop list on choice click
              }} 
              className={`rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                activePage === item.label
                  ? "bg-red-20 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom Actions Block */}
        <div className="mt-auto space-y-1 pt-4 border-t border-slate-700/50 w-full">
          <button className="w-full text-left rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all duration-200">
            Settings
          </button>
          <button
            onClick={logout}
            className="w-full text-left rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-red-500/80 transition-all duration-200"
          >
            Logout
          </button>
        </div>
        
      </div>
    </aside>
  );
};

export default Sidebar;