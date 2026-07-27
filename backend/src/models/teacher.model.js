import mongoose from "mongoose";


const teacherSchema = new mongoose.Schema(
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
    },
    {
        timestamps: true,
    }
);

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;