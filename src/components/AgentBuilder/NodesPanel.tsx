import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  CalendarClock,
  Code,
  FileSpreadsheet,
  Filter,
  Github,
  Globe2,
  Linkedin,
  Mail,
  MessageSquare,
  MessagesSquare,
  NotebookText,
  Search,
  Send,
  Split,
  Table2,
  Webhook,
  Zap,
} from 'lucide-react';

export type BuilderNodeTemplate = {
  id: string;
  type: 'trigger' | 'ai' | 'logic' | 'integration' | 'data' | 'output';
  title: string;
  description: string;
  appName: string;
  color: string;
  iconKey: string;
  config: Record<string, string | boolean | number>;
  credentials: string[];
  requiredInputs: string[];
  outputs: string[];
};

export const iconMap = {
  bot: Bot,
  calendar: CalendarClock,
  code: Code,
  discord: MessagesSquare,
  filter: Filter,
  googleSheets: FileSpreadsheet,
  github: Github,
  globe: Globe2,
  linkedin: Linkedin,
  mail: Mail,
  message: MessageSquare,
  notion: NotebookText,
  send: Send,
  split: Split,
  table: Table2,
  webhook: Webhook,
  zap: Zap,
};

export const nodeCategories: Array<{ name: string; nodes: BuilderNodeTemplate[] }> = [
  {
    name: 'Triggers',
    nodes: [
      {
        id: 'manual-trigger',
        type: 'trigger',
        title: 'Manual Trigger',
        description: 'Run the workflow from Nexora',
        appName: 'Nexora',
        color: '#10B981',
        iconKey: 'zap',
        config: { event: 'manual_run' },
        credentials: [],
        requiredInputs: ['sample payload or form data'],
        outputs: ['payload'],
      },
      {
        id: 'schedule-trigger',
        type: 'trigger',
        title: 'Schedule',
        description: 'Run hourly, daily, or weekly',
        appName: 'Nexora Scheduler',
        color: '#10B981',
        iconKey: 'calendar',
        config: { cadence: 'Every weekday at 9:00 AM' },
        credentials: [],
        requiredInputs: ['cadence', 'timezone'],
        outputs: ['time'],
      },
      {
        id: 'webhook-trigger',
        type: 'trigger',
        title: 'Webhook',
        description: 'Start from an external HTTP event',
        appName: 'Webhook',
        color: '#10B981',
        iconKey: 'webhook',
        config: { path: '/webhooks/new-lead', method: 'POST' },
        credentials: ['webhook signing secret'],
        requiredInputs: ['request body', 'headers'],
        outputs: ['body', 'headers'],
      },
      {
        id: 'whatsapp-trigger',
        type: 'trigger',
        title: 'WhatsApp Message',
        description: 'New inbound business message',
        appName: 'WhatsApp Business',
        color: '#22C55E',
        iconKey: 'message',
        config: { phoneNumberId: 'connect_whatsapp', keyword: 'pricing' },
        credentials: ['phone number id', 'access token', 'verify token'],
        requiredInputs: ['message text', 'contact phone'],
        outputs: ['message', 'contact'],
      },
      {
        id: 'github-trigger',
        type: 'trigger',
        title: 'GitHub Event',
        description: 'Issue, PR, or release created',
        appName: 'GitHub',
        color: '#64748B',
        iconKey: 'github',
        config: { repository: 'owner/repo', event: 'issue.opened' },
        credentials: ['GitHub token'],
        requiredInputs: ['repository', 'event type'],
        outputs: ['issue', 'repository'],
      },
    ],
  },
  {
    name: 'AI',
    nodes: [
      {
        id: 'ai-classify',
        type: 'ai',
        title: 'Classify Text',
        description: 'Detect intent, priority, or topic',
        appName: 'Nexora AI',
        color: '#8B5CF6',
        iconKey: 'bot',
        config: { instruction: 'Classify this message as sales, support, or bug.' },
        credentials: ['AI provider key'],
        requiredInputs: ['text to classify', 'labels or routing rules'],
        outputs: ['label', 'confidence'],
      },
      {
        id: 'ai-generate',
        type: 'ai',
        title: 'Generate Response',
        description: 'Draft a reply or next action',
        appName: 'Nexora AI',
        color: '#8B5CF6',
        iconKey: 'message',
        config: { prompt: 'Write a concise helpful response using the incoming payload.' },
        credentials: ['AI provider key'],
        requiredInputs: ['agent prompt', 'incoming data'],
        outputs: ['text'],
      },
      {
        id: 'ai-extract',
        type: 'ai',
        title: 'Extract Data',
        description: 'Convert text into structured fields',
        appName: 'Nexora AI',
        color: '#8B5CF6',
        iconKey: 'code',
        config: { schema: 'name,email,company,intent' },
        credentials: ['AI provider key'],
        requiredInputs: ['source text', 'schema fields'],
        outputs: ['json'],
      },
    ],
  },
  {
    name: 'Logic',
    nodes: [
      {
        id: 'filter',
        type: 'logic',
        title: 'Filter',
        description: 'Continue only when condition matches',
        appName: 'Nexora Logic',
        color: '#F59E0B',
        iconKey: 'filter',
        config: { condition: 'label equals sales' },
        credentials: [],
        requiredInputs: ['condition', 'previous node output'],
        outputs: ['matched'],
      },
      {
        id: 'if-else',
        type: 'logic',
        title: 'If / Else',
        description: 'Branch the workflow',
        appName: 'Nexora Logic',
        color: '#F59E0B',
        iconKey: 'split',
        config: { condition: 'priority is high' },
        credentials: [],
        requiredInputs: ['condition', 'true path', 'false path'],
        outputs: ['true', 'false'],
      },
    ],
  },
  {
    name: 'Integrations',
    nodes: [
      {
        id: 'whatsapp-send',
        type: 'integration',
        title: 'Send WhatsApp',
        description: 'Reply through WhatsApp Business',
        appName: 'WhatsApp Business',
        color: '#22C55E',
        iconKey: 'send',
        config: { to: '{{contact.phone}}', message: '{{ai.text}}' },
        credentials: ['access token', 'phone number id'],
        requiredInputs: ['recipient phone', 'message body'],
        outputs: ['message_id'],
      },
      {
        id: 'linkedin-post',
        type: 'integration',
        title: 'LinkedIn',
        description: 'Create a post or log a lead',
        appName: 'LinkedIn',
        color: '#0A66C2',
        iconKey: 'linkedin',
        config: { action: 'create_post', content: '{{ai.text}}' },
        credentials: ['LinkedIn OAuth token'],
        requiredInputs: ['action', 'post content'],
        outputs: ['post_url'],
      },
      {
        id: 'github-action',
        type: 'integration',
        title: 'GitHub',
        description: 'Create issues or comment on PRs',
        appName: 'GitHub',
        color: '#64748B',
        iconKey: 'github',
        config: { repository: 'owner/repo', action: 'create_issue', title: '{{summary}}', githubToken: '' },
        credentials: ['GitHub token'],
        requiredInputs: ['repository', 'issue title', 'issue body'],
        outputs: ['issue_url'],
      },
      {
        id: 'email-send',
        type: 'integration',
        title: 'Email',
        description: 'Send email through connected inbox',
        appName: 'Email / SMTP',
        color: '#3B82F6',
        iconKey: 'mail',
        config: { to: 'team@company.com', subject: 'New automation alert', body: '{{ai.text}}' },
        credentials: ['SMTP host', 'SMTP user', 'SMTP password'],
        requiredInputs: ['recipient', 'subject', 'message body'],
        outputs: ['email_id'],
      },
      {
        id: 'slack-send',
        type: 'integration',
        title: 'Slack',
        description: 'Send a message to a channel webhook',
        appName: 'Slack',
        color: '#4A154B',
        iconKey: 'message',
        config: { webhookUrl: '', channel: '#general', text: '{{ai.text}}' },
        credentials: ['Slack webhook URL'],
        requiredInputs: ['webhook URL', 'channel', 'message text'],
        outputs: ['slack_response'],
      },
      {
        id: 'discord-send',
        type: 'integration',
        title: 'Discord',
        description: 'Send a message to a Discord webhook',
        appName: 'Discord',
        color: '#5865F2',
        iconKey: 'discord',
        config: { webhookUrl: '', content: '{{ai.text}}' },
        credentials: ['Discord webhook URL'],
        requiredInputs: ['webhook URL', 'message content'],
        outputs: ['discord_response'],
      },
      {
        id: 'notion-create',
        type: 'integration',
        title: 'Notion',
        description: 'Create a page in a Notion database',
        appName: 'Notion',
        color: '#111827',
        iconKey: 'notion',
        config: { notionToken: '', databaseId: '', title: '{{summary}}', content: '{{ai.text}}' },
        credentials: ['Notion integration token', 'database id'],
        requiredInputs: ['database id', 'page title', 'page content'],
        outputs: ['page_url'],
      },
      {
        id: 'google-sheets-append',
        type: 'integration',
        title: 'Google Sheets',
        description: 'Append a row through the Sheets API',
        appName: 'Google Sheets',
        color: '#16A34A',
        iconKey: 'googleSheets',
        config: { apiKey: '', spreadsheetId: '', range: 'Sheet1!A:D', values: '{{json}}' },
        credentials: ['Google Sheets API key'],
        requiredInputs: ['spreadsheet id', 'range', 'row values'],
        outputs: ['updated_range'],
      },
      {
        id: 'airtable-create',
        type: 'integration',
        title: 'Airtable',
        description: 'Create a record in an Airtable table',
        appName: 'Airtable',
        color: '#F59E0B',
        iconKey: 'table',
        config: { token: '', baseId: '', tableName: 'Leads', fields: '{{json}}' },
        credentials: ['Airtable personal access token'],
        requiredInputs: ['base id', 'table name', 'record fields'],
        outputs: ['record_id'],
      },
      {
        id: 'http-request',
        type: 'integration',
        title: 'HTTP Request',
        description: 'Call any external API',
        appName: 'HTTP API',
        color: '#06B6D4',
        iconKey: 'webhook',
        config: { method: 'POST', url: 'https://api.example.com/endpoint' },
        credentials: ['API key or bearer token'],
        requiredInputs: ['method', 'URL', 'request body'],
        outputs: ['response'],
      },
    ],
  },
  {
    name: 'Data & Output',
    nodes: [
      {
        id: 'save-table',
        type: 'data',
        title: 'Save Record',
        description: 'Store lead/task data in Nexora',
        appName: 'Nexora Database',
        color: '#EC4899',
        iconKey: 'table',
        config: { table: 'leads', fields: 'name,email,source,status' },
        credentials: [],
        requiredInputs: ['table name', 'fields', 'record data'],
        outputs: ['record_id'],
      },
      {
        id: 'return-response',
        type: 'output',
        title: 'Return Response',
        description: 'Send final output to caller',
        appName: 'Nexora Output',
        color: '#14B8A6',
        iconKey: 'send',
        config: { response: '{{ai.text}}' },
        credentials: [],
        requiredInputs: ['response body'],
        outputs: ['done'],
      },
    ],
  },
];

interface NodesPanelProps {
  onNodeSelect: (nodeType: BuilderNodeTemplate) => void;
}

export default function NodesPanel({ onNodeSelect }: NodesPanelProps) {
  const [query, setQuery] = useState('');
  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return nodeCategories;
    return nodeCategories
      .map((category) => ({
        ...category,
        nodes: category.nodes.filter((node) =>
          `${node.title} ${node.description} ${node.type}`.toLowerCase().includes(normalized)
        ),
      }))
      .filter((category) => category.nodes.length > 0);
  }, [query]);

  return (
    <motion.div
      className="h-full w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white/95"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">Blocks</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Add one step, tool, or output.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search triggers, apps, AI..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#ff6d5a] focus:bg-white"
          />
        </div>
      </div>

      <div className="pb-4">
        {filteredCategories.map((category) => (
          <div key={category.name} className="mt-3">
            <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {category.name}
            </div>
            <div className="space-y-1 px-2">
              {category.nodes.map((node) => {
                const Icon = iconMap[node.iconKey as keyof typeof iconMap] ?? Zap;
                return (
                  <motion.div
                    key={node.id}
                    className="flex cursor-grab items-center rounded-xl border border-transparent p-2.5 hover:border-slate-200 hover:bg-slate-50"
                    whileHover={{ x: 2 }}
                    onDoubleClick={() => onNodeSelect(node)}
                    draggable
                    onDragStart={(event) => {
                      const dragEvent = event as unknown as React.DragEvent<HTMLDivElement>;
                      dragEvent.dataTransfer.setData('node', JSON.stringify(node));
                    }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${node.color}18`, color: node.color }}>
                      <Icon size={16} />
                    </div>
                    <div className="ml-2 min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{node.title}</div>
                      <div className="truncate text-xs text-slate-500">{node.description}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>{node.appName}</span>
                        {node.credentials.length > 0 && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-200">credentials</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
