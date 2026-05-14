declare module 'whisper-node' {
  export function whisper(filePath: string, options?: unknown): Promise<unknown>;
}
