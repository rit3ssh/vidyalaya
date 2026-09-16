import mongoose from 'mongoose';

//reate a school schema and model which is created by admin and can be used by teachers, students and parents to register and login to the system. The school schema should have the following fields: name, address, email, phoneNumber. All fields are required. The email field should be unique. The phoneNumber field should be a string.

const schoolSchema = new mongoose.Schema(
    {
        schoolName: {
            type: String,
            required: true,
        },
        schoolAddress: {
            type: String,
            required: true,
        },
        schoolEmail: {
            type: String,
            required: true,
            unique: true,
        },
        schoolPhoneNumber: {
            type: String,
            required: true,
        },
        schoolLogoURL: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

const School = mongoose.model('School', schoolSchema);

export default School;