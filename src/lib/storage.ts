/**
 * DEPRECATED: PulseChat media uploads have been migrated to direct Cloudinary
 * signed uploads (see src/lib/cloudinary.ts and /api/uploads/signature).
 *
 * Local-disk and Cloudflare R2 upload pipelines are disabled.
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  mimeType?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Magic bytes verification
export function validateImageMagicBytes(buffer: Buffer): { isValid: boolean; detectedMime?: string } {
  if (buffer.length < 4) return { isValid: false };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedMime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { isValid: true, detectedMime: 'image/png' };
  }

  // GIF: GIF87a or GIF89a (47 49 46 38)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { isValid: true, detectedMime: 'image/gif' };
  }

  // WEBP: RIFF....WEBP (52 49 46 46)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return { isValid: true, detectedMime: 'image/webp' };
  }

  return { isValid: false };
}

export async function saveMediaFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string
): Promise<{ url: string; size: number; mimeType: string }> {
  // 1. Size validation
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
  }

  // 2. MIME type validation
  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
    throw new Error(`Disallowed file type: ${declaredMimeType}`);
  }

  // 3. Header Magic bytes validation
  const magicCheck = validateImageMagicBytes(buffer);
  if (!magicCheck.isValid) {
    throw new Error('File contents do not match genuine image headers (magic bytes verification failed)');
  }

  // 4. Local disk and R2 storage pipeline is permanently retired
  throw new Error('Local disk and R2 storage paths are disabled. PulseChat uses direct Cloudinary signed uploads.');
}
