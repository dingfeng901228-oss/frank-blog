// admin/src/lib/image-upload.ts
// Phase B §13 ②③ — Drag & Drop + Ctrl+V paste image upload utility
// Mirrors /api/admin/media/upload contract (POST FormData 'file' + 'alt')
// MIME types must match worker-api/src/cms.ts MEDIA_ALLOWED_MIME

export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AllowedImageMime = typeof ALLOWED_IMAGE_MIME[number];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — matches worker-api MEDIA_MAX_SIZE

export interface UploadedImage {
  id: number;
  url: string;
  filename: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/**
 * Validate that a File is an allowed image type and within size limits.
 * Returns null on success, or an error message string.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as AllowedImageMime)) {
    return `Unsupported file type: ${file.type || 'unknown'}. Allowed: PNG, JPEG, WEBP, GIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 10 MB.`;
  }
  return null;
}

/**
 * Upload an image file to /api/admin/media/upload.
 * Returns the uploaded image record (URL + metadata).
 * Throws on validation failure or network/server error.
 */
export async function uploadImageFile(file: File, alt = ''): Promise<UploadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('alt', alt);

  const res = await fetch('/api/admin/media/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error?.message || `Upload failed (${res.status})`);
  }
  return data.data as UploadedImage;
}

/**
 * Insert text at the textarea's current cursor position.
 * Returns true if insertion happened, false if no cursor (e.g., textarea not focused).
 */
export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string
): boolean {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === undefined || end === undefined) return false;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const newCursor = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = newCursor;
  textarea.focus();
  // Trigger input event so React state syncs
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
  return true;
}

/**
 * Extract an image File from a paste or drop event.
 * Returns null if no image found in clipboard/files.
 */
export function extractImageFile(
  dataTransfer: DataTransfer | null
): File | null {
  if (!dataTransfer) return null;
  // Prefer items (DataTransferItemList) — works for clipboard paste
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  // Fallback to files (DataTransfer.files) — works for drop
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (file.type.startsWith('image/')) return file;
    }
  }
  return null;
}

/**
 * Build markdown image syntax for the uploaded image.
 * Format: ![alt](url)
 */
export function buildImageMarkdown(image: UploadedImage): string {
  const alt = image.alt || image.filename.replace(/\.[^.]+$/, '') || 'image';
  return `![${alt}](${image.url})`;
}
