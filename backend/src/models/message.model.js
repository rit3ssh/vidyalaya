import mongoose from "mongoose";

// A single chat message inside a Conversation.
const messageSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true,
        },
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: "",
        },
        // Optional file/image shared in the message. The file itself lives on
        // ImageKit; only metadata + the returned URL are stored here.
        attachment: {
            fileName: { type: String, default: null },
            fileType: { type: String, default: null },
            fileUrl: { type: String, default: null },
            fileSize: { type: Number, default: null },
            // ImageKit fileId — kept server-side for later cleanup.
            fileId: { type: String, default: null },
        },
        // User ids that have read this message — used for unread counts and
        // the "read" tick in the sender's UI.
        readBy: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
