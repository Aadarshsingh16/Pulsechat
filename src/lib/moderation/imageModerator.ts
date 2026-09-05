import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import sharp from 'sharp';

export interface ImageModerationResult {
  isSafe: boolean;
  reason?: string;
  probabilities?: {
    porn: number;
    hentai: number;
    sexy: number;
    neutral: number;
    drawings: number;
  };
  inferenceLatencyMs: number;
}

export interface IImageModerator {
  moderate(buffer: Buffer, mimeType: string): Promise<ImageModerationResult>;
}

let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;
function getModel(): Promise<nsfwjs.NSFWJS> {
  // Load model once into memory and reuse across requests to avoid per-request load overhead
  if (!modelPromise) {
    modelPromise = nsfwjs.load();
  }
  return modelPromise;
}

// Warm up model in background on server boot so uploads don't suffer cold-start delays
if (typeof window === 'undefined') {
  getModel().catch((err) => {
    console.warn('[ServerImageModerator] Background model preload notice:', err?.message || err);
  });
}

export class ServerImageModerator implements IImageModerator {
  private readonly pornThreshold = 0.60;
  private readonly hentaiThreshold = 0.60;
  private readonly sexyThreshold = 0.80;

  async moderate(buffer: Buffer, mimeType: string): Promise<ImageModerationResult> {
    const startTime = performance.now();

    if (!buffer || buffer.length === 0) {
      return {
        isSafe: false,
        reason: 'Empty image buffer provided',
        inferenceLatencyMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      // 1. Decode compressed JPEG/PNG/WebP buffer to 224x224 raw 3-channel RGB pixels
      const { data, info } = await sharp(buffer)
        .resize(224, 224, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 2. Load cached MobileNetV2 NSFWJS classifier
      const model = await getModel();

      // 3. Construct 3D tensor [224, 224, 3] from raw pixel byte buffer
      const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], 'int32');
      const predictions = await model.classify(tensor as any);
      tensor.dispose();

      // 4. Extract class probabilities
      const probs = { porn: 0, hentai: 0, sexy: 0, neutral: 0, drawings: 0 };
      for (const p of predictions) {
        const cls = p.className.toLowerCase();
        if (cls === 'porn') probs.porn = p.probability;
        else if (cls === 'hentai') probs.hentai = p.probability;
        else if (cls === 'sexy') probs.sexy = p.probability;
        else if (cls === 'neutral') probs.neutral = p.probability;
        else if (cls === 'drawing' || cls === 'drawings') probs.drawings = p.probability;
      }

      const latency = Math.round(performance.now() - startTime);

      // 5. Evaluate classification thresholds
      if (probs.porn > this.pornThreshold) {
        return {
          isSafe: false,
          reason: `P(Pornography) = ${probs.porn.toFixed(2)} exceeds threshold ${this.pornThreshold}`,
          probabilities: probs,
          inferenceLatencyMs: latency,
        };
      }

      if (probs.hentai > this.hentaiThreshold) {
        return {
          isSafe: false,
          reason: `P(Hentai) = ${probs.hentai.toFixed(2)} exceeds threshold ${this.hentaiThreshold}`,
          probabilities: probs,
          inferenceLatencyMs: latency,
        };
      }

      if (probs.sexy > this.sexyThreshold) {
        return {
          isSafe: false,
          reason: `P(Sexy) = ${probs.sexy.toFixed(2)} exceeds threshold ${this.sexyThreshold}`,
          probabilities: probs,
          inferenceLatencyMs: latency,
        };
      }

      return {
        isSafe: true,
        probabilities: probs,
        inferenceLatencyMs: latency,
      };
    } catch (error: any) {
      console.error('[ServerImageModerator] Visual decoding or inference failed:', error);
      return {
        isSafe: false,
        reason: `Image rejection: ${error?.message || 'Corrupted or unreadable image file'}`,
        inferenceLatencyMs: Math.round(performance.now() - startTime),
      };
    }
  }
}

export const defaultImageModerator: IImageModerator = new ServerImageModerator();
