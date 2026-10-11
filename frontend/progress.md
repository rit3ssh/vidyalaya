# Vidyalaya — Frontend Progress

## Tech Stack

| Tool | Purpose |
|------|---------|
| **React 19** | UI framework |
| **Vite 8** | Build tool & dev server |
| **Tailwind CSS v4** | Utility-first styling (`@import "tailwindcss"`) |
| **Axios** | HTTP client (cookie-based auth) |
| **ESLint** | Code linting |

---

## Project Structure

```
frontend/
├── index.html              # HTML entry point
├── vite.config.js          # Vite config (React plugin + Tailwind)
├── package.json
├── progress.md             # ← This file
└── src/
    ├── main.jsx            # App bootstrap — wraps <App> in <AuthProvider>
    ├── App.jsx             # Root: renders Login | SignUp | Dashboard based on auth state
    ├── index.css           # " @import "tailwindcss" "
    ├── services/
    │   ├── api.js          # All API functions (auth + student/teacher CRUD + classes)
    │   └── auth.context.jsx# Auth context: login, register, logout, user state, localStorage
    ├── pages/
    │   ├── Login.jsx       # Sign-in form
    │   ├── SignUp.jsx      # School registration form
    │   └── Dashboard.jsx   # Main dashboard with tabs (Overview / Students / Teachers)
    └── components/layout/
        ├── Layout.jsx      # Shell: Sidebar + Navbar + <main> content area
        ├── Sidebar.jsx     # Navigation sidebar (logo, nav items, settings, logout)
        ├── Navbar.jsx      # Top bar (title, search, notifications, profile)
        ├── StatCard.jsx    # Reusable metric card (icon, title, value, trend)
        └── Modal.jsx       # Reusable modal dialog (backdrop, close, scroll)
```

---

## App Flow

```
main.jsx
  └─ <AuthProvider>          ← wraps entire app with auth context
       └─ <App>
            ├─ loading?  →  Spinner
            ├─ user?     →  <Dashboard />         ← logged in
            └─ else      →  <Login /> / <SignUp /> ← toggle via state
```

### Auth Flow (`auth.context.jsx`)

- **Login**: hits `POST /api/auth/login` → stores `data.user` in state + localStorage
- **Register**: hits `POST /api/auth/register` → same storage flow
- **Logout**: hits `GET /api/auth/logout` → clears state + localStorage
- **Session restore**: on mount, reads `localStorage("user")` if available
- User object shape: `{ user_id, school_id, name, role, schoolName }`

---

## Dashboard Architecture

The Dashboard has **3 tabs** controlled by `activeTab` state:

| Tab | Content |
|-----|---------|
| `overview` (default) | Stat cards (students/teachers/classes/parents counts) + quick preview lists |
| `students` | Full student table + Add/Edit/Delete via modals |
| `teachers` | Full teacher table + Add/Edit/Delete via modals |

### Sidebar ↔ Dashboard Sync

- Sidebar passes `onNavigate` callback + `activeTab` prop to keep highlights in sync
- `tabMap`: `{ Dashboard → overview, Students → students, Teachers → teachers }`
- Unmapped sidebar items (Attendance, Courses, etc.) use local state only
- Clicking a dashboard tab button also updates sidebar highlight via `activeTab` prop

### CRUD State Pattern

For both students and teachers:

1. **Read**: `fetchData()` via `useCallback`, called on mount + after every mutation
2. **Create**: `openAddModal(entity)` → inline form → `handle[Entity]Submit()`
3. **Update**: `openEditModal(entity, item)` → pre-filled form → `handle[Entity]Submit()`
4. **Delete**: `setConfirmDelete({ type, id, name })` → confirm modal → `handleDelete[Entity]()`

---

## API Service (`api.js`)

Base URL: `http://localhost:4000` with `withCredentials: true` (sends httpOnly cookie).

### Auth Endpoints

| Function | Method | Path |
|----------|--------|------|
| `register()` | POST | `/api/auth/register` |
| `login()` | POST | `/api/auth/login` |
| `logout()` | GET | `/api/auth/logout` |

### Student CRUD

| Function | Method | Path |
|----------|--------|------|
| `getStudents()` | GET | `/api/users/view-student` |
| `getStudent(id)` | GET | `/api/users/view-student/:id` |
| `addStudent(data)` | POST | `/api/users/add-student` |
| `updateStudent(id, data)` | PUT | `/api/users/update-student/:id` |
| `deleteStudent(id)` | DELETE | `/api/users/delete-student/:id` |

Backend creates both a `User` (login account, role: STUDENT) and a `Student` (academic profile: rollNumber, classId, parentId).

### Teacher CRUD

| Function | Method | Path |
|----------|--------|------|
| `getTeachers()` | GET | `/api/users/view-teacher` |
| `getTeacher(id)` | GET | `/api/users/view-teacher/:id` |
| `addTeacher(data)` | POST | `/api/users/add-teacher` |
| `updateTeacher(id, data)` | PUT | `/api/users/update-teacher/:id` |
| `deleteTeacher(id)` | DELETE | `/api/users/delete-teacher/:id` |

Teacher fields: firstName, lastName, email, qualification, joiningDate, phoneNumber, specialization, salary.

### Classes

| Function | Method | Path |
|----------|--------|------|
| `getClasses()` | GET | `/api/academics/view-class` |

Used in the student add/edit form's class dropdown. Fields: className, classSection.

---

## Backend Dependencies

The frontend assumes the backend is running at `http://localhost:4000` with these routes:

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/logout

POST /api/users/add-student        (auth required, SCHOOL_ADMIN)
GET  /api/users/view-student        (auth required, SCHOOL_ADMIN)
PUT  /api/users/update-student/:id  (auth required, SCHOOL_ADMIN)
DELETE /api/users/delete-student/:id (auth required, SCHOOL_ADMIN)

POST /api/users/add-teacher         (auth required, SCHOOL_ADMIN)
GET  /api/users/view-teacher        (auth required, SCHOOL_ADMIN)
PUT  /api/users/update-teacher/:id  (auth required, SCHOOL_ADMIN)
DELETE /api/users/delete-teacher/:id (auth required, SCHOOL_ADMIN)

GET  /api/academics/view-class      (auth required, SCHOOL_ADMIN)
```

All authenticated routes use **httpOnly cookie** (`token`) for auth. Middleware:
- `authenticateUser` — verifies JWT from cookie, sets `req.user`
- `authorizeRoles('SCHOOL_ADMIN')` — restricts to admin role

---

## Design Language

| Element | Style |
|---------|-------|
| Page background | `bg-gradient-to-br from-slate-100 to-slate-200` |
| Cards | `bg-white rounded-2xl shadow-lg` |
| Primary button | `bg-blue-600 text-white rounded-lg hover:bg-blue-700` |
| Input focus | `focus:ring-2 focus:ring-blue-500 focus:border-transparent` |
| Text | slate palette: 800 (headings), 700 (body), 500/400 (muted) |
| Transitions | `transition-colors duration-200`, `transition-shadow duration-300` |
| Sidebar | `bg-slate-800` with blue-600 active state |

---

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to dist/
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

---

## What's Implemented

- [x] Auth: login, register, logout with localStorage persistence
- [x] Dashboard with 3 tabs (Overview, Students, Teachers)
- [x] Student CRUD (create, read, update, delete) with modals
- [x] Teacher CRUD (create, read, update, delete) with modals
- [x] Class dropdown in student forms (fetched from API)
- [x] Dynamic stat cards with live counts
- [x] Delete confirmation dialog
- [x] Sidebar ↔ Dashboard tab sync
- [x] Reusable Modal component
- [x] Consistent design language across all pages
- [x] Error banner with dismiss support
- [x] Loading spinner states

## What's Not Implemented Yet

- [ ] Parent CRUD management
- [ ] Attendance, Courses, Exams, Payments tabs/pages
- [ ] Search/filter in student & teacher tables
- [ ] Toast/snackbar notifications for CRUD feedback
- [ ] Pagination for large datasets
- [ ] Dark mode
- [ ] Form validation beyond `required` attributes
