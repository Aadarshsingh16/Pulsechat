import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

export interface IObjectStorageService {
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
}

// Cloudflare R2 / S3 compatible Object Storage Adapter
export class CloudflareR2StorageService implements IObjectStorageService {
  private endpoint?: string;
  private bucket?: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;
  private s3Client?: S3Client;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    this.endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    this.bucket = process.env.R2_BUCKET_NAME;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (this.isConfigured()) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId!,
          secretAccessKey: this.secretAccessKey!,
        },
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.bucket && this.accessKeyId && this.secretAccessKey);
  }

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    if (!this.isConfigured() || !this.s3Client || !this.bucket) {
      throw new Error('R2 Object Storage is not fully configured in environment variables');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);

    const publicBase = process.env.R2_PUBLIC_URL || `https://${this.bucket}.r2.cloudflarestorage.com`;
    return `${publicBase}/${filename}`;
  }
}

let hasLoggedStorageWarning = false;

function warnR2FallbackOnce() {
  if (!hasLoggedStorageWarning) {
    hasLoggedStorageWarning = true;
    console.warn('[Storage] R2 not configured — falling back to local disk storage. Uploaded images will not persist across redeploys.');
  }
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

  const ext = path.extname(originalFilename) || '.jpg';
  const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  // 4. In production or whenever R2 is configured, uploads MUST go to Cloudflare R2
  const r2Service = new CloudflareR2StorageService();
  if (r2Service.isConfigured()) {
    const r2Url = await r2Service.upload(buffer, uniqueName, magicCheck.detectedMime || declaredMimeType);
    return {
      url: r2Url,
      size: buffer.length,
      mimeType: magicCheck.detectedMime || declaredMimeType,
    };
  }

  // If R2 is not configured, log a one-time warning and fall back to local disk
  warnR2FallbackOnce();

  // Local storage fallback (Note: on Render free tier, files in public/uploads are ephemeral and reset on container restart)
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, uniqueName);
  await fs.promises.writeFile(filePath, buffer);

  return {
    url: `/uploads/${uniqueName}`,
    size: buffer.length,
    mimeType: magicCheck.detectedMime || declaredMimeType,
  };
}
