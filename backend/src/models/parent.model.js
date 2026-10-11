import mongoose from "mongoose";


const parentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        occupation: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Parent = mongoose.model('Parent', parentSchema);

export default Parent;