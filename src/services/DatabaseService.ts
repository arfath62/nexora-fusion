import localforage from 'localforage';
import CryptoJS from 'crypto-js';
import { getApiBaseUrl } from '../lib/apiEnv';
import { publicPlanCatalog } from '../lib/featureAccess';

// Configure localforage
localforage.config({
  name: 'nexora',
  storeName: 'nexora_data',
  description: 'Nexora AI Platform Storage'
});

// Get encryption key from environment or generate one
// In a real app, this would come from a secure source
const getEncryptionKey = (): string => {
  let key = localStorage.getItem('nexora_encryption_key');
  if (!key) {
    // Generate a random 256-bit key
    key = CryptoJS.lib.WordArray.random(32).toString();
    localStorage.setItem('nexora_encryption_key', key);
  }
  return key ?? '';
};

// Encrypt data before storing
const encrypt = (data: any): string => {
  const key = getEncryptionKey();
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

// Decrypt data after retrieval
const decrypt = (encryptedData: string): any => {
  const key = getEncryptionKey();
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

// Storage collections
const COLLECTIONS = {
  CHATS: 'chats',
  AGENTS: 'agents',
  VIDEOS: 'videos',
  SETTINGS: 'settings'
};

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  status: 'Active' | 'Invited';
};

export type WorkspaceSettings = {
  companyName: string;
  plan: 'Starter' | 'Growth' | 'Scale';
  seats: number;
  monthlyCredits: number;
  members: WorkspaceMember[];
};

export type PlanDefinition = {
  id: 'Starter' | 'Growth' | 'Scale';
  name: string;
  monthlyInr: number;
  displayPrice: string;
  monthlyCredits: number;
  limits: {
    chatsPerMonth: number;
    workflows: number;
    videoProjects: number;
    videoExports: number;
    transcriptionMinutes: number;
    seats: number;
  };
  features: string[];
};

export type AccountOverview = {
  workspace: WorkspaceSettings;
  activePlan?: PlanDefinition;
  plans?: PlanDefinition[];
  usage: {
    creditsUsed: number;
    chats: number;
    workflows: number;
    videoProjects: number;
    videoJobs: number;
    automationRuns: number;
  };
  user: { id: string; email: string; name: string | null };
};

const defaultWorkspace = (): WorkspaceSettings => ({
  companyName: 'Nexora workspace',
  plan: 'Starter',
  seats: 2,
  monthlyCredits: 10000,
  members: [
    {
      id: 'owner',
      name: 'Workspace owner',
      email: 'local@nexora.app',
      role: 'Owner',
      status: 'Active',
    },
  ],
});

// Database wrapper with error handling and encryption
class DatabaseService {
  private apiBaseUrl = (() => {
    return getApiBaseUrl();
  })();

  private get hasApi(): boolean {
    return this.apiBaseUrl.length > 0;
  }

  private authHeaders(): HeadersInit {
    if (typeof localStorage === 'undefined') return {};
    const t = localStorage.getItem('nexora_access_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  private async apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(),
        ...(init?.headers || {}),
      },
      ...init,
    });

    if (response.status === 401) {
      localStorage.removeItem('nexora_access_token');
      window.dispatchEvent(new CustomEvent('nexora:auth-lost'));
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // Initialize database and perform recovery if needed
  async initialize(): Promise<void> {
    try {
      // Check if database is accessible
      await localforage.ready();
      console.log('Database initialized successfully');
      
      // Create backup of current data
      this.createBackup();
    } catch (error) {
      console.error('Database initialization failed:', error);
      // Attempt recovery from backup
      this.recoverFromBackup();
    }
  }
  
  // Store data with encryption
  async setItem<T>(collection: string, id: string, data: T): Promise<void> {
    try {
      const storageKey = `${collection}_${id}`;
      const encryptedData = encrypt(data);
      
      // Add metadata for versioning and recovery
      const storageObject = {
        data: encryptedData,
        version: 1,
        timestamp: new Date().toISOString()
      };
      
      await localforage.setItem(storageKey, storageObject);
    } catch (error) {
      console.error(`Error storing data in ${collection}:`, error);
      throw new Error(`Failed to store data: ${error}`);
    }
  }
  
  // Retrieve and decrypt data
  async getItem<T>(collection: string, id: string): Promise<T | null> {
    try {
      const storageKey = `${collection}_${id}`;
      const storedObject = await localforage.getItem<any>(storageKey);
      
      if (!storedObject) return null;
      
      // Decrypt and return the data
      return decrypt(storedObject.data);
    } catch (error) {
      console.error(`Error retrieving data from ${collection}:`, error);
      return null;
    }
  }
  
  // Get all items in a collection
  async getAllItems<T>(collection: string): Promise<T[]> {
    const results: T[] = [];
    
    try {
      await localforage.iterate((value, key) => {
        if (key.startsWith(collection)) {
          const storageValue = value as { data?: string };
          if (storageValue.data) {
            const data = decrypt(storageValue.data);
            results.push(data);
          }
        }
      });
      
      return results;
    } catch (error) {
      console.error(`Error retrieving all items from ${collection}:`, error);
      return [];
    }
  }
  
  // Remove an item
  async removeItem(collection: string, id: string): Promise<void> {
    try {
      const storageKey = `${collection}_${id}`;
      await localforage.removeItem(storageKey);
    } catch (error) {
      console.error(`Error removing item from ${collection}:`, error);
    }
  }
  
  // Clear all data
  async clearAll(): Promise<void> {
    try {
      await localforage.clear();
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  }
  
  // Create periodic backup
  private async createBackup(): Promise<void> {
    try {
      const allData: Record<string, any> = {};
      
      await localforage.iterate((value, key) => {
        allData[key] = value;
      });
      
      localStorage.setItem('nexora_backup', JSON.stringify(allData));
      localStorage.setItem('nexora_backup_time', new Date().toISOString());
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  }
  
  // Recover from backup if database is corrupted
  private async recoverFromBackup(): Promise<void> {
    try {
      const backup = localStorage.getItem('nexora_backup');
      if (!backup) return;
      
      const backupData = JSON.parse(backup);
      
      // Clear corrupted database
      await localforage.clear();
      
      // Restore from backup
      for (const [key, value] of Object.entries(backupData)) {
        await localforage.setItem(key, value);
      }
      
      console.log('Recovery from backup successful');
    } catch (error) {
      console.error('Recovery from backup failed:', error);
    }
  }
  
  // Chat-specific methods
  async saveChat(chatId: string, messages: any[]): Promise<void> {
    if (this.hasApi) {
      await this.apiFetch('/api/chat/sessions/' + chatId, {
        method: 'PUT',
        body: JSON.stringify({
          id: chatId,
          title: messages?.[0]?.content?.slice(0, 40) || 'Conversation',
          updatedAt: new Date().toISOString(),
          isFavorite: false,
          messages,
        }),
      });
      return;
    }
    return this.setItem(COLLECTIONS.CHATS, chatId, messages);
  }
  
  async getChat(chatId: string): Promise<any[] | null> {
    if (this.hasApi) {
      try {
        const payload = await this.apiFetch<{ session: { messages: any[] } }>(`/api/chat/sessions/${chatId}`);
        return payload.session.messages;
      } catch {
        return null;
      }
    }
    return this.getItem(COLLECTIONS.CHATS, chatId);
  }
  
  async getAllChats(): Promise<any[]> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ sessions: any[] }>('/api/chat/sessions');
      return payload.sessions;
    }
    return this.getAllItems(COLLECTIONS.CHATS);
  }
  
  async deleteChat(chatId: string): Promise<void> {
    if (this.hasApi) {
      await this.apiFetch(`/api/chat/sessions/${chatId}`, {
        method: 'DELETE',
      });
      return;
    }
    return this.removeItem(COLLECTIONS.CHATS, chatId);
  }

  // Agent workflow methods
  async saveAgentWorkflow(workflowId: string, workflow: any): Promise<void> {
    if (this.hasApi) {
      await this.apiFetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        body: JSON.stringify(workflow),
      });
      return;
    }
    return this.setItem(COLLECTIONS.AGENTS, workflowId, workflow);
  }

  async getAgentWorkflow(workflowId: string): Promise<any | null> {
    if (this.hasApi) {
      try {
        const payload = await this.apiFetch<{ workflow: any }>(`/api/workflows/${workflowId}`);
        return payload.workflow;
      } catch {
        return null;
      }
    }
    return this.getItem(COLLECTIONS.AGENTS, workflowId);
  }

  async getAllAgentWorkflows(): Promise<any[]> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ workflows: any[] }>('/api/workflows');
      return payload.workflows;
    }
    return this.getAllItems(COLLECTIONS.AGENTS);
  }

  async executeAgentWorkflow(workflowName: string, nodes: any[], inputData?: any): Promise<any> {
    if (this.hasApi) {
      return this.apiFetch('/api/workflows/execute', {
        method: 'POST',
        body: JSON.stringify({ workflowName, nodes, inputData }),
      });
    }
    throw new Error('API required for live external workflow execution');
  }

  // Video project methods
  async saveVideoProject(projectId: string, project: any): Promise<void> {
    if (this.hasApi) {
      await this.apiFetch(`/api/video/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(project),
      });
      return;
    }
    return this.setItem(COLLECTIONS.VIDEOS, projectId, project);
  }

  async getVideoProject(projectId: string): Promise<any | null> {
    if (this.hasApi) {
      try {
        const payload = await this.apiFetch<{ project: any }>(`/api/video/projects/${projectId}`);
        return payload.project;
      } catch {
        return null;
      }
    }
    return this.getItem(COLLECTIONS.VIDEOS, projectId);
  }

  async getAllVideoProjects(): Promise<any[]> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ projects: any[] }>('/api/video/projects');
      return payload.projects;
    }
    return this.getAllItems(COLLECTIONS.VIDEOS);
  }

  async uploadMedia(file: File): Promise<any> {
    if (!this.hasApi) {
      throw new Error("File upload requires API");
    }
    const formData = new FormData();
    formData.append('file', file);

    let response: Response;
    try {
      response = await fetch(`${this.apiBaseUrl}/api/video/upload`, {
        method: 'POST',
        headers: this.authHeaders() as Record<string, string>,
        body: formData,
      });
    } catch (error) {
      throw new Error(`Video upload could not reach the API at ${this.apiBaseUrl}. Start the backend or set VITE_API_BASE_URL correctly.`);
    }

    if (response.status === 401) {
      localStorage.removeItem('nexora_access_token');
      window.dispatchEvent(new CustomEvent('nexora:auth-lost'));
    }
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed (${response.status}): ${text || response.statusText}`);
    }
    return response.json();
  }

  async transcribeMedia(url: string, language: string): Promise<{ captions: Array<{ start: number; end: number; text: string }> }> {
    if (this.hasApi) {
      try {
        return await this.apiFetch('/api/video/transcribe', {
          method: 'POST',
          body: JSON.stringify({ url, language }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('API 404')) {
          throw new Error('Caption API route was not found. Restart the backend and Vite dev server, then try again.');
        }
        if (message.includes('API 401')) {
          throw new Error('Please log in again before generating captions.');
        }
        throw error;
      }
    }
    throw new Error('API required for transcription');
  }

  // Job methods
  async createVideoJob(projectId: string, command: string): Promise<any> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ job: any }>('/api/video/jobs', {
        method: 'POST',
        body: JSON.stringify({ projectId, command }),
      });
      return payload.job;
    }
    throw new Error('API required for video jobs');
  }

  async getVideoJob(jobId: string): Promise<any> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ job: any }>(`/api/video/jobs/${jobId}`);
      return payload.job;
    }
    throw new Error('API required for video jobs');
  }

  // Settings methods
  async saveSettings(settings: Record<string, any>): Promise<void> {
    if (this.hasApi) {
      await this.apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      return;
    }
    return this.setItem(COLLECTIONS.SETTINGS, 'user_preferences', settings);
  }

  async getSettings<T extends Record<string, any>>(): Promise<T | null> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ settings: T | null }>('/api/settings');
      return payload.settings;
    }
    return this.getItem<T>(COLLECTIONS.SETTINGS, 'user_preferences');
  }

  async getAccountOverview(): Promise<AccountOverview> {
    if (this.hasApi) {
      const locale = navigator.language || 'en-IN';
      const currency = Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Calcutta') ? 'INR' : 'USD';
      return this.apiFetch<AccountOverview>(`/api/account/overview?locale=${encodeURIComponent(locale)}&currency=${encodeURIComponent(currency)}`);
    }

    const [chats, workflows, videoProjects, workspace] = await Promise.all([
      this.getAllChats(),
      this.getAllAgentWorkflows(),
      this.getAllVideoProjects(),
      this.getWorkspaceSettings(),
    ]);

    const usage = {
      chats: chats.length,
      workflows: workflows.length,
      videoProjects: videoProjects.length,
      videoJobs: 0,
      automationRuns: workflows.length * 3,
      creditsUsed: chats.length * 35 + workflows.length * 120 + videoProjects.length * 450,
    };

    return {
      workspace,
      usage,
      user: { id: 'local', email: workspace.members[0]?.email ?? 'local@nexora.app', name: workspace.members[0]?.name ?? null },
    };
  }

  async getWorkspaceSettings(): Promise<WorkspaceSettings> {
    if (this.hasApi) {
      const overview = await this.apiFetch<AccountOverview>('/api/account/overview');
      return overview.workspace;
    }
    return (await this.getItem<WorkspaceSettings>(COLLECTIONS.SETTINGS, 'workspace')) ?? defaultWorkspace();
  }

  async saveWorkspaceSettings(workspace: WorkspaceSettings): Promise<WorkspaceSettings> {
    if (this.hasApi) {
      const payload = await this.apiFetch<{ workspace: WorkspaceSettings }>('/api/account/workspace', {
        method: 'PUT',
        body: JSON.stringify(workspace),
      });
      return payload.workspace;
    }
    await this.setItem(COLLECTIONS.SETTINGS, 'workspace', workspace);
    return workspace;
  }

  async getPlans(): Promise<PlanDefinition[]> {
    if (this.hasApi) {
      const locale = navigator.language || 'en-IN';
      const currency = Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Calcutta') ? 'INR' : 'USD';
      const payload = await this.apiFetch<{ plans: PlanDefinition[] }>(
        `/api/account/plans?locale=${encodeURIComponent(locale)}&currency=${encodeURIComponent(currency)}`
      );
      return payload.plans;
    }
    if (publicPlanCatalog.length) return publicPlanCatalog;
    return [
      {
        id: 'Starter',
        name: 'Starter',
        monthlyInr: 500,
        displayPrice: '₹500',
        monthlyCredits: 10000,
        limits: { chatsPerMonth: 500, workflows: 10, videoProjects: 5, videoExports: 10, transcriptionMinutes: 120, seats: 2 },
        features: ['AI chat', 'basic workflows', 'video captions', 'standard exports'],
      },
      {
        id: 'Growth',
        name: 'Growth',
        monthlyInr: 1000,
        displayPrice: '₹1,000',
        monthlyCredits: 30000,
        limits: { chatsPerMonth: 2000, workflows: 50, videoProjects: 25, videoExports: 50, transcriptionMinutes: 500, seats: 10 },
        features: ['higher AI limits', 'workflow automations', 'priority video captions', 'team workspace'],
      },
      {
        id: 'Scale',
        name: 'Scale',
        monthlyInr: 2000,
        displayPrice: '₹2,000',
        monthlyCredits: 90000,
        limits: { chatsPerMonth: 8000, workflows: 200, videoProjects: 100, videoExports: 200, transcriptionMinutes: 2000, seats: 50 },
        features: ['scale limits', 'advanced automations', 'bulk video work', 'admin controls'],
      },
    ];
  }
}

// Create and export a singleton instance
const databaseService = new DatabaseService();

// Initialize database on module load
databaseService.initialize().catch(console.error);

export default databaseService;
export { COLLECTIONS };
