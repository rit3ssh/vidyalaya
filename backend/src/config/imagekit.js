// ImageKit client — the backend uploads notice images/PDFs to ImageKit,
// which stores the file and returns a URL that we persist in MongoDB.
//
// Required env vars (see .env.example):
//   IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT

import ImageKit from "imagekit";
import path from "path";

const hasImageKitConfig = Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT
);

const imagekit = hasImageKitConfig
    ? new ImageKit({
          publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
          privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
          urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      })
    : null;

// Upload a file buffer to ImageKit and return { url, fileId }.
// `folder` keeps notice uploads grouped inside the ImageKit media library.
async function uploadToImageKit({ buffer, originalName, folder = "/notices" }) {
    if (!imagekit) {
        const error = new Error(
            "ImageKit is not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT in the backend .env file."
        );
        error.code = "IMAGEKIT_NOT_CONFIGURED";
        throw error;
    }

    const extension = path.extname(originalName || "");
    const baseName = path.basename(originalName || "file", extension);
    const fileName = `${baseName}-${Date.now()}${extension}`;

    const result = await imagekit.upload({
        file: buffer,
        fileName,
        folder,
        useUniqueFileName: true,
    });

    return { url: result.url, fileId: result.fileId };
}

// Delete a previously uploaded file from ImageKit. Best-effort: never throws,
// so removing a notice still succeeds even if the remote file is already gone.
async function deleteFromImageKit(fileId) {
    if (!imagekit || !fileId) return;
    try {
        await imagekit.deleteFile(fileId);
    } catch (error) {
        console.warn(`ImageKit: failed to delete file ${fileId}:`, error.message);
    }
}

export { uploadToImageKit, deleteFromImageKit };
