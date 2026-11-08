// The same result as `npm run minify`: webp at quality 50, at most 1200 × 1200, never larger.
const MAX_SIZE = 1200;
const QUALITY = 50;
const READING_SIZE = 1600;

export interface Photo {
  base64: string;
  blob: Blob;
  width: number;
  height: number;
}

export class PhotoError extends Error {}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = "";
  // In parts, because one call with 100 KB of arguments overflows the stack in some browsers.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

// The canvas keeps only the pixels, so the result holds no camera data and no location.
async function drawScaled(file: File, maxSize: number): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    // The browser turns the photo by its orientation tag here.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("This browser cannot open this photo. Choose a JPEG, PNG or WebP photo.");
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("This browser cannot process photos.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function processPhoto(file: File): Promise<Photo> {
  const canvas = await drawScaled(file, MAX_SIZE);
  const { width, height } = canvas;
  // About 300 KB of WebAssembly. It loads only when the owner chooses a photo.
  const { default: encode } = await import("@jsquash/webp/encode");
  const webp = await encode(canvas.getContext("2d")!.getImageData(0, 0, width, height), { quality: QUALITY });
  return { base64: toBase64(webp), blob: new Blob([webp], { type: "image/webp" }), width, height };
}

// A photo of a recipe for the model to read. Small print stays sharp at 1600 px; a larger photo
// costs more time and more of the daily allowance.
export async function readingPhoto(file: File): Promise<string> {
  const canvas = await drawScaled(file, READING_SIZE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new PhotoError("This browser cannot process photos.");
  return toBase64(await blob.arrayBuffer());
}
