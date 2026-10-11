import mongoose from "mongoose";

// A 1:1 conversation between two users (any roles).
//
// NOTE: MongoDB cannot dedupe an array field with a unique index — an index on
// `participants` is multikey (one entry per element), so it would make each
// *individual* user id globally unique instead of the pair. To enforce "one
// conversation per pair", we store `pairKey` = the two sorted user ids joined
// (e.g. "64ab...|64cd...") and index THAT uniquely.
const conversationSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true,
        },
        participants: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            required: true,
            validate: {
                validator: (v) => v.length === 2,
                message: "A conversation must have exactly two participants",
            },
        },
        // Sorted "id1|id2" — the actual uniqueness key for a participant pair.
        pairKey: {
            type: String,
            required: true,
        },
        // Denormalized preview for the conversation list (avoids a join).
        lastMessage: {
            type: String,
            trim: true,
            default: "",
        },
        lastMessageAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// One conversation per (school, pair).
conversationSchema.index({ schoolId: 1, pairKey: 1 }, { unique: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
