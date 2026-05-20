export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  isFavorite: boolean;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface AgentWorkflow {
  id: string;
  name: string;
  updatedAt: string;
  nodes: unknown[];
}

export interface VideoClip {
  id: string;
  type: 'video' | 'audio' | 'text' | 'image';
  start: number;
  end: number;
  track: number;
  name: string;
  color: string;
  url?: string;
  sourceStart?: number;
  filter?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  playbackRate?: number;
  opacity?: number;
  effect?: string;
  textStyle?: Record<string, unknown>;
}

export interface VideoProject {
  id: string;
  updatedAt: string;
  clips: VideoClip[];
  commandHistory: string[];
  videoDuration: number;
}

export interface VideoJob {
  id: string;
  projectId: string;
  command: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  finishedAt?: string;
  result?: string;
  error?: string;
}

export interface DatabaseShape {
  users: Record<
    string,
    {
      id: string;
      email: string;
      name?: string;
      passwordHash: string;
      createdAt: string;
    }
  >;
  chatSessions: Record<string, ChatSession>;
  workflows: Record<string, AgentWorkflow>;
  videoProjects: Record<string, VideoProject>;
  videoJobs: Record<string, VideoJob>;
  settings: Record<string, Record<string, unknown>>;
}
