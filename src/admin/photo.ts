// The same result as `npm run minify`: webp at quality 50, at most 1200 × 1200, never larger.
const MAX_SIZE = 1200;
const QUALITY = 50;

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

// The canvas keeps only the pixels, so the webp holds no camera data and no location.
export async function processPhoto(file: File): Promise<Photo> {
  let bitmap: ImageBitmap;
  try {
    // The browser turns the photo by its orientation tag here.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("This browser cannot open this photo. Choose a JPEG, PNG or WebP photo.");
  }

  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("This browser cannot process photos.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // About 300 KB of WebAssembly. It loads only when the owner chooses a photo.
  const { default: encode } = await import("@jsquash/webp/encode");
  const webp = await encode(context.getImageData(0, 0, width, height), { quality: QUALITY });
  return { base64: toBase64(webp), blob: new Blob([webp], { type: "image/webp" }), width, height };
}
