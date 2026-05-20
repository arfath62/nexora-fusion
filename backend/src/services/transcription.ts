import fs from 'fs';
import { openAsBlob } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { config } from '../config';

const execFileAsync = promisify(execFile);

export interface TranscriptionOptions {
  model?: string;
  language?: string;
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const normalized = value.replace(',', '.').trim();
  const parts = normalized.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(normalized) || 0;
}

function normalizeSegments(transcript: any): CaptionSegment[] {
  const rawSegments = Array.isArray(transcript)
    ? transcript
    : Array.isArray(transcript?.segments)
      ? transcript.segments
      : Array.isArray(transcript?.transcription)
        ? transcript.transcription
        : [];

  const segments = rawSegments
    .map((segment: any, index: number) => {
      const start = parseTimestamp(segment.start ?? segment.from ?? segment.startTime ?? segment.offsets?.from);
      const end = parseTimestamp(segment.end ?? segment.to ?? segment.endTime ?? segment.offsets?.to) || start + 4;
      const text = String(segment.text ?? segment.speech ?? segment.caption ?? '').trim();
      return text ? { id: `caption_${Date.now()}_${index}`, start, end: Math.max(end, start + 0.8), text } : null;
    })
    .filter(Boolean) as CaptionSegment[];

  if (segments.length > 0) return segments;

  const text = String(transcript?.text ?? transcript ?? '').trim();
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks: CaptionSegment[] = [];
  for (let i = 0; i < words.length; i += 8) {
    const start = (i / 8) * 3.5;
    chunks.push({
      id: `caption_${Date.now()}_${i}`,
      start,
      end: start + 3.5,
      text: words.slice(i, i + 8).join(' '),
    });
  }
  return chunks;
}

function normalizeLanguage(language?: string) {
  if (!language || language === 'auto') return undefined;
  if (language === 'hi-Latn') return 'hi';
  return language.split('-')[0];
}

function isMediaFile(filePath: string) {
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac'].includes(
    path.extname(filePath).toLowerCase()
  );
}

function isVideoFile(filePath: string) {
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'].includes(path.extname(filePath).toLowerCase());
}

async function prepareTranscriptionInput(
  filePath: string,
  format: 'mp3' | 'wav' = 'mp3',
  forceConvert = false
): Promise<{ filePath: string; cleanup?: () => Promise<void> }> {
  if ((!forceConvert && !isVideoFile(filePath)) || !ffmpegPath) {
    return { filePath };
  }

  const tempDir = path.join(process.cwd(), 'uploads', 'transcription-cache');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const outputPath = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}-${Date.now()}.${format}`);
  const outputArgs = format === 'mp3' ? ['-b:a', '48k'] : [];

  await execFileAsync(
    ffmpegPath,
    [
      '-y',
      '-i',
      filePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      ...outputArgs,
      outputPath,
    ],
    { timeout: 120000 }
  );

  return {
    filePath: outputPath,
    cleanup: async () => {
      await fs.promises.rm(outputPath, { force: true });
    },
  };
}

export async function transcribeAudio(filePath: string, options?: TranscriptionOptions): Promise<CaptionSegment[]> {
  if (!fs.existsSync(filePath)) {
    const error = new Error('Uploaded media file was not found for transcription.');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  if (!isMediaFile(filePath)) {
    const error = new Error('Only audio and video files can be transcribed.');
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  if (config.transcriptionProvider === 'local') {
    const error = new Error('Local Whisper transcription is disabled. Set TRANSCRIPTION_PROVIDER=openrouter in backend/.env and restart the backend.');
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  const prepared = await prepareTranscriptionInput(filePath);

  if (config.transcriptionProvider === 'openrouter') {
    if (!config.openRouterApiKey) {
      const error = new Error('OpenRouter API key is required for video captions. Set OPENROUTER_API_KEY in backend/.env and restart the backend.');
      (error as Error & { status?: number }).status = 503;
      throw error;
    }

    try {
      const audioBuffer = await fs.promises.readFile(prepared.filePath);
      const format = path.extname(prepared.filePath).replace('.', '').toLowerCase() || 'mp3';
      const language = normalizeLanguage(options?.language);

      const response = await fetch(`${config.openRouterBaseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.publicAppUrl,
          'X-Title': 'Nexora Fusion',
        },
        body: JSON.stringify({
          input_audio: {
            data: audioBuffer.toString('base64'),
            format,
          },
          model: options?.model || config.transcriptionModel,
          ...(language ? { language } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        const error = new Error(`OpenRouter transcription failed (${response.status}): ${detail}`);
        (error as Error & { status?: number }).status = response.status >= 500 ? 502 : response.status;
        throw error;
      }

      const transcript = await response.json();
      return normalizeSegments(transcript);
    } catch (error) {
      console.error('OpenRouter transcription error:', error);
      throw error;
    } finally {
      await prepared.cleanup?.();
    }
  }

  if (!config.openaiApiKey) {
    const error = new Error('OpenAI API key is required for real transcription. Set OPENAI_API_KEY in backend/.env and restart the backend.');
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  try {
    const formData = new FormData();
    const fileBlob = await openAsBlob(prepared.filePath);
    formData.append('file', fileBlob, path.basename(prepared.filePath));
    formData.append('model', options?.model || config.transcriptionModel);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const language = normalizeLanguage(options?.language);
    if (language) formData.append('language', language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`OpenAI transcription failed (${response.status}): ${detail}`);
      (error as Error & { status?: number }).status = response.status >= 500 ? 502 : response.status;
      throw error;
    }

    const transcript = await response.json();
    return normalizeSegments(transcript);
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  } finally {
    await prepared.cleanup?.();
  }
}
