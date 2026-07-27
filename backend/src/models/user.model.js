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
    password: {
      type: String,
      required: true,
      minlength: 6,
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
const User = mongoose.model("User", userSchema);




export default User;
