import type { MultipartFile } from '@fastify/multipart';
import { HttpError } from '../errors/HttpError.js';

export interface IncomingAudioChunk {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  startedAt: string;
  endedAt: string;
  sequenceNumber: number;
}

const SUPPORTED_PREFIXES = ['audio/', 'video/webm', 'application/octet-stream'];
const MAX_BYTES = 25 * 1024 * 1024; // Whisper API limit-ish, plenty for 30s

/**
 * Single responsibility: receive an uploaded multipart audio chunk, validate it,
 * and produce a normalized `IncomingAudioChunk` for the transcription pipeline.
 *
 * Does not call any model — just I/O + validation.
 */
export class AudioChunkService {
  async parse(file: MultipartFile | undefined): Promise<IncomingAudioChunk> {
    if (!file) {
      throw new HttpError(400, 'No audio file uploaded (expected multipart field "audio")');
    }
    if (!SUPPORTED_PREFIXES.some((p) => file.mimetype.startsWith(p))) {
      throw new HttpError(400, `Unsupported mime type: ${file.mimetype}`);
    }

    const buffer = await file.toBuffer();
    if (buffer.byteLength === 0) {
      throw new HttpError(400, 'Audio chunk is empty');
    }
    if (buffer.byteLength > MAX_BYTES) {
      throw new HttpError(413, `Audio chunk too large: ${buffer.byteLength} bytes`);
    }

    const fields = file.fields as Record<string, { value?: string } | undefined>;
    const startedAt = fields.startedAt?.value ?? new Date().toISOString();
    const endedAt = fields.endedAt?.value ?? new Date().toISOString();
    const sequenceRaw = fields.sequenceNumber?.value;
    const sequenceNumber = sequenceRaw ? Number.parseInt(sequenceRaw, 10) : 0;

    return {
      buffer,
      filename: file.filename || 'chunk.webm',
      mimeType: file.mimetype,
      startedAt,
      endedAt,
      sequenceNumber: Number.isFinite(sequenceNumber) ? sequenceNumber : 0,
    };
  }
}
