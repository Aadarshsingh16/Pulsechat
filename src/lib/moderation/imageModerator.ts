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

// Memoized promise for lazy model loading on first image request
let modelPromise: Promise<any> | null = null;

async function getModel(): Promise<any> {
  if (!modelPromise) {
    modelPromise = (async () => {
      console.log('[ServerImageModerator] Initializing NSFWJS model lazily on first visual upload...');
      const nsfwjs = await import('nsfwjs');
      const loaded = await nsfwjs.load();
      console.log('[ServerImageModerator] NSFWJS model loaded and ready for inference.');
      return loaded;
    })();
  }
  return modelPromise;
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

      // 2. Load cached MobileNetV2 NSFWJS classifier lazily
      const model = await getModel();
      const tf = await import('@tensorflow/tfjs');

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
