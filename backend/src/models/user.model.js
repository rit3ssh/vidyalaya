import mongoose from "mongoose";
import School from "./school.model.js";

const userSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 6,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    profileImageURL: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["SUPER_ADMIN","SCHOOL_ADMIN","STUDENT","TEACHER","PARENT"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


userSchema.virtual('studentProfile', {
  ref: 'Student',        // The model to use
  localField: '_id',     // Find people where `localField`
  foreignField: 'userId', // is equal to `foreignField`
  justOne: true          // Student profiles are 1-to-1 mappings
});

userSchema.virtual('teacherProfile', {
  ref: 'Teacher',        // The model to use
  localField: '_id',     // Find people where `localField`
  foreignField: 'userId', // is equal to `foreignField`
  justOne: true          // Teacher profiles are 1-to-1 mappings
});

userSchema.virtual('parentProfile', {
  ref: 'Parent',        // The model to use
  localField: '_id',     // Find people where `localField`
  foreignField: 'userId', // is equal to `foreignField`
  justOne: true          // Parent profiles are 1-to-1 mappings
});

// Ensure virtuals are included when converting documents to JSON
userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });


const User = mongoose.model("User", userSchema);




export default User;
