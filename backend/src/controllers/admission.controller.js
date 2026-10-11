import userModel from "../models/user.model.js";
import parentModel from "../models/parent.model.js";
import studentModel from "../models/student.model.js";
import studentParentModel from "../models/studentParent.model.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// POST /api/admissions
//
// Simulates the real admission form: one submission creates the Student
// and one-or-more Parents/Guardians together, and links them via
// StudentParent — all inside a single transaction.
//
// Body shape:
// {
//   student: {
//     email, firstName, lastName, phoneNumber, profileImageURL,
//     class, rollNumber, admissionNumber, dateOfBirth, admissionDate, bloodGroup
//   },
//   parents: [
//     // Option A: link an existing parent already in this school
//     { existingUserId: "<User _id>", relationType: "father" },
//
//     // Option B: create a brand-new parent alongside the student
//     { email, firstName, lastName, phoneNumber, occupation, relationType: "mother" }
//   ]
// }
async function admitStudent(req, res) {
  const { student, parents } = req.body;
  console.log("admitStudent called with:", { student, parents });

  if (!student || !student.email || !student.firstName || !student.lastName) {
    return res.status(400).json({ message: "student.email, firstName and lastName are required" });
  }
  if (!Array.isArray(parents) || parents.length === 0) {
    return res.status(400).json({ message: "At least one parent/guardian is required" });
  }
 
  const studentEmail = student.email.toLowerCase();
  const existingStudentUser = await userModel.findOne({ email: studentEmail });
  if (existingStudentUser) {
    return res.status(409).json({ message: `Email ${studentEmail} is already in use` });
  }

  // Pre-validate any brand-new parent emails before opening the transaction,
  // so we fail fast with a clear message instead of aborting mid-transaction.
  for (const p of parents) {
    if (!p.existingUserId) {
      if (!p.email || !p.firstName || !p.lastName) {
        return res.status(400).json({ message: "New parent entries require email, firstName and lastName" });
      }
      const existingParentUser = await userModel.findOne({ email: p.email.toLowerCase() });
      if (existingParentUser) {
        return res.status(409).json({ message: `Email ${p.email} is already in use` });
      }
    }
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const generatedPasswords = {};

    // 1. Resolve or create each parent
    const parentLinks = [];
    for (const p of parents) {
      let parentProfile;

      if (p.existingUserId) {
        const parentUser = await userModel.findOne({ _id: p.existingUserId, schoolId: req.user.schoolId });
        if (!parentUser || parentUser.role.toUpperCase() !== "PARENT") {
          throw new Error(`existingUserId ${p.existingUserId} is not a valid parent in this school`);
        }
        parentProfile = await parentModel.findOne({ user: parentUser._id });
        if (!parentProfile) throw new Error(`Parent profile missing for user ${p.existingUserId}`);
      } else {
        const rawPassword = crypto.randomBytes(8).toString("hex");
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        const [parentUser] = await userModel.create(
          [
            {
              schoolId: req.user.schoolId,
              email: p.email.toLowerCase(),
              passwordHash,
              firstName: p.firstName,
              lastName: p.lastName,
              phoneNumber: p.phoneNumber,
              role: "PARENT",
            },
          ],
          { session }
        );
        const [createdProfile] = await parentModel.create(
          [{ userId: parentUser._id, occupation: p.occupation }],
          { session }
        );
        parentProfile = createdProfile;
        generatedPasswords[p.email.toLowerCase()] = rawPassword;
      }

      parentLinks.push({ profile: parentProfile, relationType: p.relationType });
    }

    // 2. Create the student user + profile
    const studentPassword = crypto.randomBytes(8).toString("hex");
    const studentPasswordHash = await bcrypt.hash(studentPassword, 10);
    const [studentUser] = await userModel.create(
      [
        {
          schoolId: req.user.schoolId,
          email: studentEmail,
          passwordHash: studentPasswordHash,
          firstName: student.firstName,
          lastName: student.lastName,
          phoneNumber: student.phoneNumber,
          profileImageURL: student.profileImageURL,
          role: "STUDENT",
        },
      ],
      { session }
    );
    generatedPasswords[studentEmail] = studentPassword;

    const [studentProfile] = await studentModel.create(
      [
        {
          userId: studentUser._id,
          classId: student.classId,
          rollNumber: student.rollNumber,
          admissionNumber: student.admissionNumber,
          dateOfBirth: student.dateOfBirth,
          admissionDate: student.admissionDate,
        },
      ],
      { session }
    );

    // 3. Link the student to every parent resolved in step 1
    const links = [];
    for (const { profile: parentProfile, relationType } of parentLinks) {
      const [link] = await studentParentModel.create(
        [{ studentId: studentProfile._id, parentId: parentProfile._id, relationType }],
        { session }
      );
      links.push(link);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Admission completed successfully",
      generatedPasswords, // share these with the respective people once, securely, then discard
      student: { user: studentUser, profile: studentProfile },
      parents: parentLinks.map((pl) => pl.profile),
      links,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(500).json({ message: "Admission failed", error: err.message });
  }
}











// PATCH /api/admissions/:studentUserId
async function updateStudentAdmission(req, res) {

  const studentId  = req.params.studentId;
  const { student, parents } = req.body; 
  console.log(student,parents)
  // console.log(studentId)
  // console.log(studentprofile)
  // parents shape expected: 
  // [ { parentProfileId: "...", firstName, lastName, phoneNumber, occupation, relationType } ]
// console.log("updateStudentAdmission called with:", { studentUserId, student, parents });
  const session = await mongoose.startSession();
  try {
    session.startTransaction();


    const studentprofile= await studentModel.findOne({ _id:studentId });
    // console.log("Found studentprofile:", studentprofile);
    const studentUserId=studentprofile.userId;
    // 1. Update Core Student User Account
    const studentUser = await userModel.findOne({ _id: studentUserId, schoolId: req.user.schoolId });
    // console.log("Found studentUser:", studentUser);
    if (!studentUser) {
      return res.status(404).json({ message: "Student not found in this school" });
    }

    if (student) {
      const allowedUserFields = ['firstName', 'lastName', 'phoneNumber', 'profileImageURL'];
      allowedUserFields.forEach(field => {
        if (student[field] !== undefined) studentUser[field] = student[field];
      });
      await studentUser.save({ session });

      // 2. Update Extended Student Profile (Roll, Class, etc.)
      const studentProfile = await studentModel.findOne({ userId: studentUser._id });
      if (studentProfile) {
        const allowedProfileFields = ['classId', 'rollNumber', 'admissionNumber', 'dateOfBirth'];
        allowedProfileFields.forEach(field => {
          if (student[field] !== undefined) studentProfile[field] = student[field];
        });
        await studentProfile.save({ session });
      }
    }

    // 3. Process Parent Updates if provided
    if (Array.isArray(parents)) {
      const studentProfile = await studentModel.findOne({ userId: studentUser._id });

      for (const p of parents) {
        if (!p.parentProfileId) continue;

        // Verify this parent is actually linked to this student to prevent security bypassing
        const linkExists = await studentParentModel.findOne({
          studentId: studentProfile._id,
          parentId: p.parentProfileId
        });

        if (!linkExists) {
          throw new Error(`Parent with profile ID ${p.parentProfileId} is not linked to this student`);
        }

        // Fetch parent profile and core user profile
        const currentParentProfile = await parentModel.findById(p.parentProfileId);
        const parentUser = await userModel.findById(currentParentProfile.userId);

        // Update Parent's User Record
        const allowedParentUserFields = ['firstName', 'lastName', 'phoneNumber'];
        allowedParentUserFields.forEach(field => {
          if (p[field] !== undefined) parentUser[field] = p[field];
        });
        await parentUser.save({ session });

        // Update Parent's Profile Record (e.g. Occupation)
        if (p.occupation !== undefined) {
          currentParentProfile.occupation = p.occupation;
          await currentParentProfile.save({ session });
        }

        // Update Relationship Type if modified (e.g., changing 'guardian' to 'father')
        if (p.relationType !== undefined) {
          linkExists.relationType = p.relationType;
          await linkExists.save({ session });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: "Student and parent records updated successfully" });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Update failed:", error);
    return res.status(500).json({ message: `Update failed: ${error.errmsg || error.message}`, error: error.errmsg || error.message });
  }
}




async function deleteStudentAdmission(req, res) {
  const studentId = req.params.studentId; // This is the StudentProfile _id
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // 1. Locate the extended student profile
    const studentProfile = await studentModel.findById(studentId).session(session);
    if (!studentProfile) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    // 2. Locate the core user account matching the student
    const studentUser = await userModel.findById(studentProfile.userId).session(session);
    if (!studentUser) {
      return res.status(404).json({ message: "Student user record not found" });
    }

    // 3. Find all parent/guardian links attached to this specific student
    const connectedParents = await studentParentModel.find({ studentId: studentProfile._id }).session(session);

    // 4. Safely handle Parent Accounts
    for (const link of connectedParents) {
      // Check if this parent is linked to ANY other students in the school system
      const otherChildrenCount = await studentParentModel.countDocuments({
        parentId: link.parentId,
        studentId: { $ne: studentProfile._id } // Not equal to current student
      }).session(session);

      // If this parent has no other children registered, purge their account fully
      if (otherChildrenCount === 0) {
        const parentProfile = await parentModel.findById(link.parentId).session(session);
        if (parentProfile) {
          // Delete core parent credentials out of user collection
          await userModel.deleteOne({ _id: parentProfile.userId }).session(session);
          // Delete parent demographic information
          await parentProfile.deleteOne({ session });
        }
      }
    }

    // 5. Clean up junction references and student records
    await studentParentModel.deleteMany({ studentId: studentProfile._id }).session(session);
    await studentProfile.deleteOne({ session });
    await studentUser.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: "Student, links, and unique parent accounts purged successfully." });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Deletion failed:", error);
    return res.status(500).json({ message: "Deletion failed", error: error.message });
  }
}




export { admitStudent, updateStudentAdmission, deleteStudentAdmission };