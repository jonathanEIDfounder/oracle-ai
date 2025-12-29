import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import OWP from './owp-guardian';

const WATERMARK_MAGIC = [0x4F, 0x57, 0x50, 0x31];
const HIGH_FREQ_PATTERN = [1, -1, 1, -1, 1, -1, 1, -1];

interface WatermarkResult {
  success: boolean;
  originalPath: string;
  outputPath: string;
  payloadHash: string;
  timestamp: number;
}

interface VerifyResult {
  valid: boolean;
  payload: any | null;
  owner: string | null;
  timestamp: number | null;
  error?: string;
}

function embedInHighFrequency(
  channelData: Uint8Array,
  width: number,
  height: number,
  payload: number[]
): Uint8Array {
  const result = new Uint8Array(channelData);
  let payloadIndex = 0;
  
  for (let i = 0; i < WATERMARK_MAGIC.length && payloadIndex < payload.length + WATERMARK_MAGIC.length; i++) {
    if (i < result.length) {
      result[i] = (result[i] & 0xF0) | (WATERMARK_MAGIC[i] & 0x0F);
    }
  }
  
  const startOffset = WATERMARK_MAGIC.length;
  const step = Math.max(1, Math.floor((width * height) / (payload.length + 100)));
  
  for (let i = 0; i < payload.length && (startOffset + i * step) < result.length; i++) {
    const pos = startOffset + i * step;
    const nibble = payload[i] & 0x0F;
    
    const freqMod = HIGH_FREQ_PATTERN[i % 8];
    result[pos] = (result[pos] & 0xF0) | nibble;
    
    if (pos + 1 < result.length) {
      const adjacent = result[pos + 1];
      result[pos + 1] = Math.max(0, Math.min(255, adjacent + freqMod));
    }
  }
  
  const lengthPos = startOffset + payload.length * step;
  if (lengthPos + 3 < result.length) {
    result[lengthPos] = (payload.length >> 8) & 0xFF;
    result[lengthPos + 1] = payload.length & 0xFF;
    result[lengthPos + 2] = 0xED;
  }
  
  return result;
}

function extractFromHighFrequency(
  channelData: Uint8Array,
  width: number,
  height: number
): number[] | null {
  for (let i = 0; i < WATERMARK_MAGIC.length; i++) {
    if (i >= channelData.length) return null;
    const nibble = channelData[i] & 0x0F;
    if (nibble !== (WATERMARK_MAGIC[i] & 0x0F)) {
      return null;
    }
  }
  
  let payloadLength = 0;
  const startOffset = WATERMARK_MAGIC.length;
  
  for (let testLen = 100; testLen < 2000; testLen++) {
    const step = Math.max(1, Math.floor((width * height) / (testLen + 100)));
    const lengthPos = startOffset + testLen * step;
    
    if (lengthPos + 2 < channelData.length) {
      const marker = channelData[lengthPos + 2];
      if (marker === 0xED) {
        const high = channelData[lengthPos];
        const low = channelData[lengthPos + 1];
        const candidateLen = (high << 8) | low;
        if (candidateLen === testLen) {
          payloadLength = testLen;
          break;
        }
      }
    }
  }
  
  if (payloadLength === 0) return null;
  
  const step = Math.max(1, Math.floor((width * height) / (payloadLength + 100)));
  const payload: number[] = [];
  
  for (let i = 0; i < payloadLength; i++) {
    const pos = startOffset + i * step;
    if (pos < channelData.length) {
      payload.push(channelData[pos] & 0x0F);
    }
  }
  
  return payload;
}

export async function embedWatermark(
  inputPath: string,
  outputPath?: string
): Promise<WatermarkResult> {
  const outPath = outputPath || inputPath;
  
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width = 512, height = 512 } = metadata;
  
  const rawBuffer = await image.raw().toBuffer();
  const channels = metadata.channels || 3;
  
  const owpPayload = OWP.generatePayload();
  const encodedPayload = OWP.encodeForStego(owpPayload);
  
  const blueChannel = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    blueChannel[i] = rawBuffer[i * channels + 2] || 0;
  }
  
  const watermarkedBlue = embedInHighFrequency(blueChannel, width, height, encodedPayload);
  
  const newBuffer = Buffer.from(rawBuffer);
  for (let i = 0; i < width * height; i++) {
    newBuffer[i * channels + 2] = watermarkedBlue[i];
  }
  
  await sharp(newBuffer, { raw: { width, height, channels } })
    .png()
    .toFile(outPath);
  
  const payloadHash = crypto.createHash('sha256')
    .update(JSON.stringify(owpPayload))
    .digest('hex');
  
  return {
    success: true,
    originalPath: inputPath,
    outputPath: outPath,
    payloadHash,
    timestamp: owpPayload.timestamp
  };
}

export async function verifyWatermark(imagePath: string): Promise<VerifyResult> {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { width = 512, height = 512 } = metadata;
    
    const rawBuffer = await image.raw().toBuffer();
    const channels = metadata.channels || 3;
    
    const blueChannel = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      blueChannel[i] = rawBuffer[i * channels + 2] || 0;
    }
    
    const extractedData = extractFromHighFrequency(blueChannel, width, height);
    
    if (!extractedData) {
      return {
        valid: false,
        payload: null,
        owner: null,
        timestamp: null,
        error: 'No watermark detected'
      };
    }
    
    const payload = OWP.decodeFromStego(extractedData);
    
    if (!payload) {
      return {
        valid: false,
        payload: null,
        owner: null,
        timestamp: null,
        error: 'Invalid watermark payload'
      };
    }
    
    const isValid = OWP.verifyPayload(payload);
    
    return {
      valid: isValid,
      payload,
      owner: payload.owner,
      timestamp: payload.timestamp
    };
  } catch (error) {
    return {
      valid: false,
      payload: null,
      owner: null,
      timestamp: null,
      error: `Verification failed: ${error}`
    };
  }
}

export async function add3DHologramOverlay(
  inputPath: string,
  outputPath?: string
): Promise<void> {
  const outPath = outputPath || inputPath;
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width = 512, height = 512 } = metadata;
  
  const svgOverlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="holo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(100,200,255,0.03)"/>
          <stop offset="50%" style="stop-color:rgba(200,100,255,0.02)"/>
          <stop offset="100%" style="stop-color:rgba(100,255,200,0.03)"/>
        </linearGradient>
        <pattern id="microtext" patternUnits="userSpaceOnUse" width="200" height="20">
          <text x="0" y="10" font-family="monospace" font-size="3" fill="rgba(128,128,128,0.08)">
            © ${OWP.OWNER_NAME} | OWP Protected | ${OWP.VERSION}
          </text>
        </pattern>
        <pattern id="grid3d" patternUnits="userSpaceOnUse" width="40" height="40">
          <path d="M0,20 L20,0 L40,20 L20,40 Z" fill="none" stroke="rgba(100,150,255,0.02)" stroke-width="0.5"/>
          <circle cx="20" cy="20" r="1" fill="rgba(150,200,255,0.03)"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#holo)"/>
      <rect width="100%" height="100%" fill="url(#grid3d)"/>
      <rect width="100%" height="100%" fill="url(#microtext)" transform="rotate(-15 ${width/2} ${height/2})"/>
      <text x="${width-5}" y="${height-3}" font-family="monospace" font-size="2" fill="rgba(128,128,128,0.15)" text-anchor="end">
        OWP:${OWP.VERSION}
      </text>
    </svg>
  `;
  
  await image
    .composite([{
      input: Buffer.from(svgOverlay),
      blend: 'over'
    }])
    .toFile(outPath);
}

export async function watermarkAllAssets(assetsDir: string): Promise<WatermarkResult[]> {
  const results: WatermarkResult[] = [];
  
  const files = fs.readdirSync(assetsDir, { recursive: true }) as string[];
  
  for (const file of files) {
    const filePath = path.join(assetsDir, file.toString());
    
    if (fs.statSync(filePath).isDirectory()) continue;
    
    const ext = path.extname(filePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
    
    try {
      const result = await embedWatermark(filePath);
      await add3DHologramOverlay(filePath);
      results.push(result);
      console.log(`[STEGO] Watermarked: ${filePath}`);
    } catch (error) {
      console.error(`[STEGO] Failed: ${filePath}`, error);
    }
  }
  
  return results;
}

export const Steganography = {
  embed: embedWatermark,
  verify: verifyWatermark,
  addHologram: add3DHologramOverlay,
  watermarkAll: watermarkAllAssets
};

export default Steganography;
