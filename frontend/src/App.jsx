import { useState, useEffect } from "react";
import { useAuth } from "./services/auth.context.jsx";
import socket from "./services/socket.js";
import ChatNotifications from "./components/chat/ChatNotifications.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import Layout from "./components/layout/Layout.jsx"; // Adjust path as needed
import Dashboard from "./pages/Dashboard.jsx";
import Students from "./pages/Students.jsx";
import Teachers from "./pages/Teachers.jsx";
import Classes from "./pages/Classes.jsx";
import Subjects from "./pages/Subjects.jsx";
import ClassSubjects from "./pages/ClassSubjects.jsx";
import Routine from "./pages/Routine.jsx";
import Attendance from "./pages/Attendance.jsx";
import Notices from "./pages/Notices.jsx";
import Notes from "./pages/Notes.jsx";
import Exams from "./pages/Exams.jsx";
import Chat from "./pages/Chat.jsx";

function App() {
  const { user, loading } = useAuth();
  const [showSignUp, setShowSignUp] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");

  // Global navigation (used by chat notification clicks to jump to the page).
  useEffect(() => {
    const onNavigate = (e) => {
      if (e.detail) setActivePage(e.detail);
    };
    window.addEventListener("app:navigate", onNavigate);
    return () => window.removeEventListener("app:navigate", onNavigate);
  }, []);

  // Keep the real-time socket in sync with the auth session: connect once the
  // user is logged in (the token cookie exists), disconnect on logout.
  useEffect(() => {
    if (user) {
      socket.connect();
    } else {
      socket.disconnect();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Auth Routing Gate
  if (!user) {
    return showSignUp ? (
      <SignUp onSwitchToLogin={() => setShowSignUp(false)} />
    ) : (
      <Login onSwitchToSignUp={() => setShowSignUp(true)} />
    );
  }

  // App Page Resolution
  const renderPage = () => {
    switch (activePage.toLowerCase()) {
      case "students":
        return <Students />;
      case "teachers":
        return <Teachers />;
      case "classes":
        return <Classes />;
      case "subjects":
        return <Subjects />;
      case "class subjects":
        return <ClassSubjects />;
      case "routine":
        return <Routine />;
      case "attendance":
        return <Attendance />;
      case "notices":
        return <Notices />;
      case "notes":
        return <Notes />;
      case "exams":
        return <Exams />;
      case "chat":
        return <Chat />;
      case "dashboard":
      default:
        return <Dashboard onNavigate={setActivePage} />;
    }
  };

  // Render Layout with the dynamic page wrapped as children
  return (
    <Layout onNavigate={setActivePage} activeTab={activePage}>
      {renderPage()}
      <ChatNotifications />
    </Layout>
  );
}

export default App;