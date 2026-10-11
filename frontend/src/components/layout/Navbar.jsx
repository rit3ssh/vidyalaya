import { useAuth } from "../../services/auth.context.jsx";


const Navbar = () => {
  const { user } = useAuth();
  if (!user) {
    return null; // or return a placeholder, or redirect to login
  }
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-20 px-8 flex items-center justify-between postion-relative z-10">
      <h1 className="text-2xl font-bold text-slate-800">
        Dashboard
      </h1>

      <div className="relative w-96">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-slate-400 text-sm transition-shadow"
        />
      </div>

      <div className="flex items-center gap-5">
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors duration-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
        </button>

        <div className="flex items-center gap-3">
          <img
            src="https://i.pravatar.cc/40?img=12"
            alt="Profile"
            className="w-9 h-9 rounded-full ring-2 ring-slate-200 hover:ring-blue-400 transition-all duration-200 cursor-pointer"
          />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700 -mb-0.5">{user.name}</p>
            <p className="text-xs text-slate-400">{user.role?.replace("_", " ")}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;