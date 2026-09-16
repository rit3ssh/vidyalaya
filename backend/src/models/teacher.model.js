import mongoose from "mongoose";
import User from "./user.model.js";


const teacherSchema = new mongoose.Schema(
    {
        userId:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        qualification: {
            type: String,
            required: true
        },
        joiningDate: {
            type: Date,
            required: true
        },
        designation:{
            type: String,
            required: true
        },    
    },
    {
        timestamps: true
    }
);

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;