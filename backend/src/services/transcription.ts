import { whisper } from 'whisper-node';
import fs from 'fs';

export interface TranscriptionOptions {
  model?: string;
  language?: string;
}

export async function transcribeAudio(filePath: string, options?: TranscriptionOptions): Promise<any> {
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found for transcription');
  }

  const whisperOpts = {
    modelName: options?.model || 'base.en',
    whisperOptions: {
      language: options?.language || 'auto',
      gen_file_txt: false,
      gen_file_subtitle: true,
      gen_file_vtt: false,
    }
  };

  try {
    const transcript = await whisper(filePath, whisperOpts);
    return transcript;
  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
}
