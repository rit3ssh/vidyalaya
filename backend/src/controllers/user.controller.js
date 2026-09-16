import userModel from "../models/user.model.js";
import parentModel from "../models/parent.model.js";
import studentModel from "../models/student.model.js";
import teacherModel from "../models/teacher.model.js";
import studentParentModel from "../models/studentParent.model.js"; 

import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";





const PROFILE_MODELS = { TEACHER: teacherModel, STUDENT: studentModel, PARENT: parentModel };

// Fields an admin is allowed to set on the role-specific profile at creation time.
const CREATE_PROFILE_FIELDS = {
  TEACHER: ['qualification', 
    'joiningDate',
    'designation',
],
  STUDENT: ['rollNumber', 
    'admissionNumber', 
    'dateOfBirth', 
    'admissionDate', 
    'bloodGroup'],

  PARENT: [
    'occupation',
  ],
};

function pick(obj, keys) {
  console.log("pick called with obj:", obj, "and keys:", keys);
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

async function getProfile(role, userId) {
  const Model = PROFILE_MODELS[role];
  if (!Model) return null; // admin role has no separate profile table
  return Model.findOne({ user: userId });
}

// ---------- ADMIN: create any user (teacher/student/parent/admin) ----------
// POST /api/users
async function adminCreateUser(req, res) {
  const { email,firstName, lastName, phoneNumber, profileImageURL, role, ...rest } = req.body;
  console.log("adminCreateUser called with data:", req.body);
  // console.log("Creating user in school:", req.user.schoolId);
  console.log(role)
  // console.log("rest:",rest);
  if (!email || !firstName || !lastName || !role) {
    return res.status(400).json({ message: 'email, password, firstName, lastName and role are required' });
  }
  if (!['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const existing = await userModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const password = crypto.randomBytes(8).toString('hex'); // generate a random password
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await userModel.create(
      [
        {
          schoolId: req.user.schoolId, // always scoped to the creating admin's own school
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          phoneNumber,
          profileImageURL,
          role,
        },
      ],
      { session }
    );
    console.log("User created with ID:", user._id, "and role:", role);
    let profile = null;
    const Model = PROFILE_MODELS[role];
    if (Model) {
      const profileData = pick(rest, CREATE_PROFILE_FIELDS[role]);
      // console.log("Creating profile for role:", role, "with data:", profileData);
      const [created] = await Model.create([{ userId: user._id, ...profileData }], { session });
      profile = created;
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
        message: 'User created successfully',
        password: password, // return the generated password so the admin can communicate it to the user
        user: user, profile });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.status(500).json({ message: 'User creation failed', error: err.message });
  }
}





// GET /api/users?role=student
async function adminListUsers(req, res) {
  try {
    const filter = { schoolId: req.user.schoolId };

    if (req.query.role) {
      filter.role = req.query.role.toUpperCase();
    }

    let query = userModel.find(filter).select("-passwordHash");

    // If requesting students, perform deep population for the class
    if (filter.role === "STUDENT") {
      query = query.populate({
        path: "studentProfile",
        populate: {
          path: "classId", // Deep populate to swap classId with the actual Class document
          select: "name section ", // Select the fields you want to show
        },
      });
    } else if (filter.role === "TEACHER") {
      query = query.populate("teacherProfile");
    } else if (filter.role === "PARENT") {
      query = query.populate("parentProfile");
    }

    const users = await query;

    // IF THE ROLE IS STUDENT: We must attach the parent's info manually from studentParentModel
    if (filter.role === "STUDENT" && users.length > 0) {
      // 1. Gather all student profile IDs from the fetched users
      const studentProfileIds = users
        .map((u) => u.studentProfile?._id)
        .filter(Boolean);

      // 2. Query the link table to find all matching parent records
      const parentMappings = await studentParentModel
        .find({ studentId: { $in: studentProfileIds } })
        .populate({
          path: "parentId",
          populate: {
            path: "userId", // Go up to the user table to get the parent's actual first/last name
            select: "firstName lastName email phoneNumber",
          },
        });

      // 3. Convert the users array to normal objects and map the parent information in
      const customizedStudents = users.map((user) => {
        const userObj = user.toJSON();
        
        if (userObj.studentProfile) {
          // Find all links matching this specific student profile ID
          const matches = parentMappings.filter(
            (link) => link.studentId.toString() === userObj.studentProfile._id.toString()
          );

          // Format parent metadata into a clean array inside the student profile block
          userObj.studentProfile.parents = matches.map((m) => ({
            relationType: m.relationType,
            parentId: m.parentId?._id,
            occupation: m.parentId?.occupation || "",
            parentFirstName: m.parentId?.userId?.firstName || "Unknown",
            parentLastName: m.parentId?.userId?.lastName || "Unknown",
            phoneNumber: m.parentId?.userId?.phoneNumber || "",
            email: m.parentId?.userId?.email || "",
          }));
        }
        return userObj;
      });

      return res.status(200).json(customizedStudents);
    }

    // Default response configuration for teachers, parents, or generic users
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error in adminListUsers:", error);
    return res.status(500).json({ 
      message: "Failed to retrieve user list", 
      error: error.message 
    });
  }
}





// ---------- ADMIN: update any user in their school (including self) ----------
// PUT /api/users/:id
async function adminUpdateUser(req, res) {
  const target = await userModel.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!target) return res.status(404).json({ message: 'User not found' });

  const { firstName, lastName, phoneNumber, profileImageURL, password, ...rest } = req.body;

  if (firstName !== undefined) target.firstName = firstName;
  if (lastName !== undefined) target.lastName = lastName;
  if (phoneNumber !== undefined) target.phoneNumber = phoneNumber;
  if (profileImageURL !== undefined) target.profileImageURL = profileImageURL;
  if (password) target.passwordHash = await bcrypt.hash(password, 10);
  // Note: role changes are intentionally not supported here — moving a user
  // between roles means migrating their profile record, which deserves its
  // own dedicated, carefully-audited endpoint rather than a silent side effect.

  await target.save();

  const Model = PROFILE_MODELS[target.role];
  let profile = null;
  if (Model) {
    const allowed = CREATE_PROFILE_FIELDS[target.role];
    const updates = pick(rest, allowed);
    profile = await Model.findOneAndUpdate({ user: target._id }, updates, { new: true, upsert: true });
  }

  return res.json({ user: target, profile });
}

// ---------- ADMIN: delete any user in their school (including self) ----------
// DELETE /api/users/:id
async function adminDeleteUser(req, res) {
  const target = await userModel.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!target) return res.status(404).json({ message: 'User not found' });

  const Model = PROFILE_MODELS[target.role];
  if (Model) await Model.deleteOne({ user: target._id });
  await userModel.deleteOne({ _id: target._id });

  return res.json({ message: 'User deleted' });
}

// ---------- SELF: any logged-in user views their own profile ----------
// GET /api/users/me
async function getMe(req, res) {
  const user = await userModel.findById(req.user.id).select('-passwordHash');
  if (!user) return res.status(404).json({ message: 'User not found' });
  const profile = await getProfile(user.role, user._id);
  return res.json({ user: user, profile });
}

// ---------- SELF: any logged-in user updates their own basic details ----------
// PUT /api/users/me
// Deliberately narrow: no role, school, is_active, or administrative
// profile fields (e.g. admission_number, employee_id, class) here — those
// stay admin-only via adminUpdateUser.
async function updateMe(req, res) {
    //user could only update their profile picture ,email,phoneNumber and password 
    const { email, phoneNumber, profileImageURL, password } = req.body;
    const user = await userModel.findOneAndUpdate(
        { _id: req.user.id }, 
        {$set: req.body }, 
            { new: true ,runValidators: true }
        );

    res.status(200).json({ message: "User updated successfully", user: user });



}

export { adminCreateUser, adminListUsers, adminUpdateUser, adminDeleteUser, getMe, updateMe };