# Test Credentials — Green Valley School

Seeded database for local testing. **All accounts share the same password:**

> **Password: `Test@1234`**

The school login (`info@greenvalley.test`) is only used for registration — you
log into the app with the individual accounts below.

---

## Admin

| Role | Email |
| --- | --- |
| School Admin | `admin@greenvalley.test` |

Can do everything: notices, notes, exams, attendance, class subjects, classes,
subjects, teachers, students, parents, admissions, routine.

---

## Teachers

| # | Email | Name | Teaches |
| --- | --- | --- | --- |
| 1 | `teacher1@greenvalley.test` | Ram Shrestha | English (Grade 8 & 9) |
| 2 | `teacher2@greenvalley.test` | Sita Gurung | Mathematics (Grade 8 & 9) |
| 3 | `teacher3@greenvalley.test` | Hari Thapa | Science (Grade 8 & 9) |
| 4 | `teacher4@greenvalley.test` | Gita Sharma | Social Studies (Grade 8) / Nepali (Grade 9) |

Teachers can share notes for their assigned class+subject, view their own
timetable, and mark attendance.

---

## Students

| # | Email | Name | Class |
| --- | --- | --- | --- |
| 1 | `student1@greenvalley.test` | Aayush Adhikari | Grade 8 A |
| 2 | `student2@greenvalley.test` | Anjali Adhikari | Grade 8 A |
| 3 | `student3@greenvalley.test` | Bibek Basnet | Grade 8 B |
| 4 | `student4@greenvalley.test` | Deepak Magar | Grade 8 B |
| 5 | `student5@greenvalley.test` | Sabin Rai | Grade 9 A |
| 6 | `student6@greenvalley.test` | Nisha Rai | Grade 9 A |
| 7 | `student7@greenvalley.test` | Pooja Karki | Grade 9 B |
| 8 | `student8@greenvalley.test` | Ramesh Shrestha | Grade 9 B |

Students see notices, notes for their own class (by subject), the exam grid
(with their class highlighted), and their attendance.

---

## Parents

| # | Email | Name | Child(ren) |
| --- | --- | --- | --- |
| 1 | `parent1@greenvalley.test` | Bina Adhikari | Aayush, Anjali |
| 2 | `parent2@greenvalley.test` | Kiran Adhikari | Aayush, Anjali |
| 3 | `parent3@greenvalley.test` | Maya Basnet | Bibek |
| 4 | `parent4@greenvalley.test` | Kamala Magar | Deepak |
| 5 | `parent5@greenvalley.test` | Suresh Rai | Sabin, Nisha |
| 6 | `parent6@greenvalley.test` | Rina Karki | Pooja |
| 7 | `parent7@greenvalley.test` | Sunita Shrestha | Ramesh |

Parents can view their children's notices, notes, exams and attendance.

---

## Seeded data overview

- **Notices:** 5 (mix of plain, image, and PDF attachment)
- **Classes:** Grade 8 A/B, Grade 9 A/B (Grade 8 ↔ Social Studies, Grade 9 ↔ Nepali)
- **Subjects:** English, Mathematics, Science, Social Studies, Nepali
- **Notes:** 10 across classes/subjects (one with a PDF attachment)
- **Exam routine:** 8 entries, Nov 2026 (Math, English, Science + Social/Nepali per class)
- **Timetable:** full weekly routine (Sun–Fri, 5 periods/day) for all 4 classes
- **Attendance:** sheets for the current month so registers/summaries/Excel have data

> Regenerate at any time: `cd backend && npm run seed -- --fresh`
