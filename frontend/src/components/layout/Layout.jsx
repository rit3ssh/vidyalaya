import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

const Layout = ({ children, onNavigate, activeTab }) => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Sidebar */}
      {/* <h1>{activeTab}{onNavigate}</h1> */}
      <Sidebar onNavigate={onNavigate} activePage={activeTab} />

      {/* Right Section */}
      <div className="flex flex-1 flex-col overflow-hidden pt-[100px] md:pt-0">
        <Navbar />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;