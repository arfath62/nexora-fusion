import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  CalendarClock,
  Code,
  Filter,
  Github,
  Linkedin,
  Mail,
  MessageSquare,
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
  color: string;
  iconKey: string;
  config: Record<string, string | boolean | number>;
  outputs: string[];
};

export const iconMap = {
  bot: Bot,
  calendar: CalendarClock,
  code: Code,
  filter: Filter,
  github: Github,
  linkedin: Linkedin,
  mail: Mail,
  message: MessageSquare,
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
        color: '#10B981',
        iconKey: 'zap',
        config: { event: 'manual_run' },
        outputs: ['payload'],
      },
      {
        id: 'schedule-trigger',
        type: 'trigger',
        title: 'Schedule',
        description: 'Run hourly, daily, or weekly',
        color: '#10B981',
        iconKey: 'calendar',
        config: { cadence: 'Every weekday at 9:00 AM' },
        outputs: ['time'],
      },
      {
        id: 'webhook-trigger',
        type: 'trigger',
        title: 'Webhook',
        description: 'Start from an external HTTP event',
        color: '#10B981',
        iconKey: 'webhook',
        config: { path: '/webhooks/new-lead', method: 'POST' },
        outputs: ['body', 'headers'],
      },
      {
        id: 'whatsapp-trigger',
        type: 'trigger',
        title: 'WhatsApp Message',
        description: 'New inbound business message',
        color: '#22C55E',
        iconKey: 'message',
        config: { phoneNumberId: 'connect_whatsapp', keyword: 'pricing' },
        outputs: ['message', 'contact'],
      },
      {
        id: 'github-trigger',
        type: 'trigger',
        title: 'GitHub Event',
        description: 'Issue, PR, or release created',
        color: '#64748B',
        iconKey: 'github',
        config: { repository: 'owner/repo', event: 'issue.opened' },
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
        color: '#8B5CF6',
        iconKey: 'bot',
        config: { instruction: 'Classify this message as sales, support, or bug.' },
        outputs: ['label', 'confidence'],
      },
      {
        id: 'ai-generate',
        type: 'ai',
        title: 'Generate Response',
        description: 'Draft a reply or next action',
        color: '#8B5CF6',
        iconKey: 'message',
        config: { prompt: 'Write a concise helpful response using the incoming payload.' },
        outputs: ['text'],
      },
      {
        id: 'ai-extract',
        type: 'ai',
        title: 'Extract Data',
        description: 'Convert text into structured fields',
        color: '#8B5CF6',
        iconKey: 'code',
        config: { schema: 'name,email,company,intent' },
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
        color: '#F59E0B',
        iconKey: 'filter',
        config: { condition: 'label equals sales' },
        outputs: ['matched'],
      },
      {
        id: 'if-else',
        type: 'logic',
        title: 'If / Else',
        description: 'Branch the workflow',
        color: '#F59E0B',
        iconKey: 'split',
        config: { condition: 'priority is high' },
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
        color: '#22C55E',
        iconKey: 'send',
        config: { to: '{{contact.phone}}', message: '{{ai.text}}' },
        outputs: ['message_id'],
      },
      {
        id: 'linkedin-post',
        type: 'integration',
        title: 'LinkedIn',
        description: 'Create a post or log a lead',
        color: '#0A66C2',
        iconKey: 'linkedin',
        config: { action: 'create_post', content: '{{ai.text}}' },
        outputs: ['post_url'],
      },
      {
        id: 'github-action',
        type: 'integration',
        title: 'GitHub',
        description: 'Create issues or comment on PRs',
        color: '#64748B',
        iconKey: 'github',
        config: { repository: 'owner/repo', action: 'create_issue', title: '{{summary}}', githubToken: '' },
        outputs: ['issue_url'],
      },
      {
        id: 'email-send',
        type: 'integration',
        title: 'Email',
        description: 'Send email through connected inbox',
        color: '#3B82F6',
        iconKey: 'mail',
        config: { to: 'team@company.com', subject: 'New automation alert', body: '{{ai.text}}' },
        outputs: ['email_id'],
      },
      {
        id: 'http-request',
        type: 'integration',
        title: 'HTTP Request',
        description: 'Call any external API',
        color: '#06B6D4',
        iconKey: 'webhook',
        config: { method: 'POST', url: 'https://api.example.com/endpoint' },
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
        color: '#EC4899',
        iconKey: 'table',
        config: { table: 'leads', fields: 'name,email,source,status' },
        outputs: ['record_id'],
      },
      {
        id: 'return-response',
        type: 'output',
        title: 'Return Response',
        description: 'Send final output to caller',
        color: '#14B8A6',
        iconKey: 'send',
        config: { response: '{{ai.text}}' },
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
      className="h-full w-72 shrink-0 overflow-y-auto border-r border-white/10 bg-black/30 backdrop-blur-xl"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="border-b border-white/10 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search triggers, apps, AI..."
            className="h-9 w-full rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="pb-4">
        {filteredCategories.map((category) => (
          <div key={category.name} className="mt-3">
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              {category.name}
            </div>
            <div className="space-y-1 px-2">
              {category.nodes.map((node) => {
                const Icon = iconMap[node.iconKey as keyof typeof iconMap] ?? Zap;
                return (
                  <motion.div
                    key={node.id}
                    className="flex cursor-grab items-center rounded-md p-2 hover:bg-white/5"
                    whileHover={{ x: 2 }}
                    onDoubleClick={() => onNodeSelect(node)}
                    draggable
                    onDragStart={(event) => {
                      const dragEvent = event as unknown as React.DragEvent<HTMLDivElement>;
                      dragEvent.dataTransfer.setData('node', JSON.stringify(node));
                    }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: node.color }}>
                      <Icon size={15} className="text-white" />
                    </div>
                    <div className="ml-2 min-w-0">
                      <div className="truncate text-sm font-medium text-white">{node.title}</div>
                      <div className="truncate text-xs text-gray-400">{node.description}</div>
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
