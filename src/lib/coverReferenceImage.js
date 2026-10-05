const MAX_FILE_BYTES = 12 * 1024 * 1024;
const OUTPUT_SIZE = 1024;

/**
 * Center-crop to square and export PNG for OpenAI image edits.
 * @param {File|Blob} file
 * @returns {Promise<{ base64: string, mimeType: "image/png" }>}
 */
export async function fileToCoverReferencePng(file) {
  if (!file) throw new Error("Choose an image file.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Image is too large (max 12 MB). Try a smaller photo.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image.");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    if (!base64) throw new Error("Could not encode image.");
    return { base64, mimeType: "image/png" };
  } finally {
    bitmap.close?.();
  }
}

/**
 * @param {string} url — same-origin or CORS-enabled artwork URL
 */
export async function urlToCoverReferencePng(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("Could not load image for editing.");
  const blob = await res.blob();
  return fileToCoverReferencePng(blob);
}
