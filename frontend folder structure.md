src/
│
├── assets/
│   ├── images/
│   ├── icons/
│   └── styles/
│
├── components/
│   ├── common/
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── Table/
│   │   └── Loader/
│   │
│   ├── layout/
│   │   ├── Sidebar/
│   │   ├── Navbar/
│   │   ├── Header/
│   │   └── Footer/
│
├── pages/
│   │
│   ├── Dashboard/
│   │   ├── Dashboard.jsx
│   │   └── Dashboard.css
│   │
│   ├── Students/
│   │   ├── StudentsList.jsx
│   │   ├── StudentDetails.jsx
│   │   ├── AddStudent.jsx
│   │   └── EditStudent.jsx
│   │
│   ├── Teachers/
│   ├── Classes/
│   ├── Subjects/
│   ├── Attendance/
│   ├── Exams/
│   ├── Grades/
│   ├── Fees/
│   ├── Timetable/
│   ├── Reports/
│   └── Settings/
│
├── services/
│   ├── api.js
│   ├── studentService.js
│   ├── teacherService.js
│   ├── attendanceService.js
│   └── authService.js
│
├── hooks/
│   ├── useAuth.js
│   ├── useStudents.js
│   └── useAttendance.js
│
├── context/
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
│
├── routes/
│   ├── AppRoutes.jsx
│   └── ProtectedRoute.jsx
│
├── utils/
│   ├── constants.js
│   ├── helpers.js
│   └── formatters.js
│
├── store/
│   ├── index.js
│   └── slices/
│       ├── authSlice.js
│       ├── studentSlice.js
│       └── teacherSlice.js
│
├── App.jsx
├── main.jsx
└── index.css