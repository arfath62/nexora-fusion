import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check,
  Copy,
  Database,
  FileCode,
  KeyRound,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wand2,
} from 'lucide-react';
import NodesPanel, { BuilderNodeTemplate, nodeCategories } from '../components/AgentBuilder/NodesPanel';
import FlowNode, { WorkflowNode } from '../components/AgentBuilder/FlowNode';
import databaseService, { COLLECTIONS } from '../services/DatabaseService';

type RunLog = {
  id: string;
  nodeId: string;
  title: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
};

type RunOutput = {
  id: string;
  workflowName: string;
  status: 'success' | 'warning' | 'error';
  createdAt: string;
  context: Record<string, unknown>;
};

type ConnectedAccount = {
  id: string;
  name: string;
  connected: boolean;
  tokenHint: string;
};

const templateLookup = new Map(nodeCategories.flatMap((category) => category.nodes.map((node) => [node.id, node])));

const starterTemplates = [
  {
    id: 'whatsapp-lead',
    title: 'WhatsApp lead to GitHub task',
    description: 'Catch pricing messages, summarize intent, create an issue, and reply.',
    nodes: ['whatsapp-trigger', 'ai-extract', 'github-action', 'whatsapp-send'],
  },
  {
    id: 'linkedin-post',
    title: 'LinkedIn content assistant',
    description: 'Run on schedule, generate a post, publish it, and save the record.',
    nodes: ['schedule-trigger', 'ai-generate', 'linkedin-post', 'save-table'],
  },
  {
    id: 'github-triage',
    title: 'GitHub issue triage',
    description: 'Classify new issues, branch by priority, and send an email alert.',
    nodes: ['github-trigger', 'ai-classify', 'if-else', 'email-send'],
  },
];

const defaultAccounts: ConnectedAccount[] = [
  { id: 'whatsapp', name: 'WhatsApp Business', connected: false, tokenHint: 'Cloud API token needed' },
  { id: 'linkedin', name: 'LinkedIn', connected: false, tokenHint: 'OAuth app pending' },
  { id: 'github', name: 'GitHub', connected: true, tokenHint: 'Live with githubToken or GITHUB_TOKEN' },
  { id: 'email', name: 'Email', connected: true, tokenHint: 'Local email sender' },
  { id: 'webhook', name: 'Webhooks', connected: true, tokenHint: 'Generated endpoint ready' },
];

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

function createNode(template: BuilderNodeTemplate, index: number, position?: { x: number; y: number }): WorkflowNode {
  return {
    id: makeId(template.id),
    templateId: template.id,
    type: template.type,
    title: template.title,
    description: template.description,
    appName: template.appName,
    color: template.color,
    iconKey: template.iconKey,
    config: { ...template.config },
    credentials: [...template.credentials],
    requiredInputs: [...template.requiredInputs],
    outputs: [...template.outputs],
    position: position ?? { x: 120 + index * 340, y: 190 + (index % 2) * 150 },
  };
}

function buildTemplate(nodeIds: string[]) {
  return nodeIds
    .map((id, index) => {
      const template = templateLookup.get(id);
      return template ? createNode(template, index) : null;
    })
    .filter(Boolean) as WorkflowNode[];
}

function normalizeNode(node: WorkflowNode): WorkflowNode {
  const template = templateLookup.get(node.templateId);
  return {
    ...node,
    appName: node.appName ?? template?.appName ?? 'Nexora',
    credentials: node.credentials ?? template?.credentials ?? [],
    requiredInputs: node.requiredInputs ?? template?.requiredInputs ?? ['input data'],
    outputs: node.outputs ?? template?.outputs ?? [],
  };
}

function credentialConfigKey(credential: string) {
  const text = credential.toLowerCase();
  if (text.includes('webhook')) return 'webhookUrl';
  if (text.includes('github')) return 'githubToken';
  if (text.includes('notion')) return 'notionToken';
  if (text.includes('airtable')) return 'token';
  if (text.includes('google')) return 'apiKey';
  if (text.includes('smtp host')) return 'smtpHost';
  if (text.includes('smtp user')) return 'smtpUser';
  if (text.includes('smtp password')) return 'smtpPassword';
  if (text.includes('phone number')) return 'phoneNumberId';
  if (text.includes('access token')) return 'accessToken';
  if (text.includes('api key')) return 'apiKey';
  if (text.includes('bearer')) return 'bearerToken';
  return credential
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+([a-zA-Z0-9])/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/^([A-Z])/, (letter) => letter.toLowerCase());
}

const initialNodes = buildTemplate(['manual-trigger', 'ai-generate', 'github-action', 'email-send']);

function guessWorkflowName(prompt: string) {
  const firstSentence = prompt
    .split(/[.\n]/)[0]
    ?.replace(/^(create|build|make|automate|i want|please)\s+/i, '')
    .trim();
  if (!firstSentence) return 'Nexora quick agent';
  return firstSentence.length > 46 ? `${firstSentence.slice(0, 43)}...` : firstSentence;
}

function chooseAgentNodes(prompt: string) {
  const text = prompt.toLowerCase();
  const nodeIds = ['manual-trigger'];

  if (/(extract|lead|form|invoice|data|field|name|email|phone)/.test(text)) {
    nodeIds.push('ai-extract');
  }

  if (/(classify|route|priority|urgent|support|sales|bug|category)/.test(text)) {
    nodeIds.push('ai-classify');
  }

  nodeIds.push('ai-generate');

  if (/(only if|when|filter|condition|urgent|priority|route)/.test(text)) {
    nodeIds.push('filter');
  }

  if (/(slack|channel)/.test(text)) {
    nodeIds.push('slack-send');
  } else if (/(discord)/.test(text)) {
    nodeIds.push('discord-send');
  } else if (/(notion|wiki|page)/.test(text)) {
    nodeIds.push('notion-create');
  } else if (/(google sheet|sheets|spreadsheet)/.test(text)) {
    nodeIds.push('google-sheets-append');
  } else if (/(airtable)/.test(text)) {
    nodeIds.push('airtable-create');
  } else if (/(github|issue|bug|repo|ticket)/.test(text)) {
    nodeIds.push('github-action');
  } else if (/(whatsapp|message|customer reply|reply to customer)/.test(text)) {
    nodeIds.push('whatsapp-send');
  } else if (/(linkedin|post|social)/.test(text)) {
    nodeIds.push('linkedin-post');
  } else if (/(api|webhook|http|endpoint|crm|zapier|make.com|make )/.test(text)) {
    nodeIds.push('http-request');
  } else {
    nodeIds.push('email-send');
  }

  if (/(save|record|sheet|table|database|crm|lead)/.test(text)) {
    nodeIds.push('save-table');
  }

  nodeIds.push('return-response');
  return nodeIds;
}

export default function AgentBuilderPage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[1]?.id ?? null);
  const [workflowName, setWorkflowName] = useState('Nexora Automation MVP');
  const [isRunning, setIsRunning] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [latestOutput, setLatestOutput] = useState<RunOutput | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(defaultAccounts);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [agentPrompt, setAgentPrompt] = useState(
    'When a new lead asks about pricing, extract their name, email, company, intent and team size. Draft a helpful reply, save the lead, and email my team.'
  );
  const [sampleData, setSampleData] = useState(
    'Hi, I am Aarav from BrightLabs. We are a team of 5 and want pricing for Nexora. Email me at aarav@example.com.'
  );
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const savedWorkflow = await databaseService.getAgentWorkflow('default-workflow');
        if (savedWorkflow?.nodes?.length) {
          const savedNodes = savedWorkflow.nodes.map(normalizeNode);
          setWorkflowName(savedWorkflow.name || 'Nexora Automation MVP');
          setNodes(savedNodes);
          setSelectedNodeId(savedNodes[0]?.id ?? null);
        }
      } catch (error) {
        console.error('Failed to load workflow:', error);
      }
    };

    loadWorkflow();
  }, []);

  const handleAddNode = (nodeType: BuilderNodeTemplate) => {
    const newNode = createNode(nodeType, nodes.length);
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nodeData = event.dataTransfer.getData('node');
    if (!nodeData) return;
    const template = JSON.parse(nodeData) as BuilderNodeTemplate;
    const canvasRect = event.currentTarget.getBoundingClientRect();
    const newNode = createNode(template, nodes.length, {
      x: Math.max(20, event.clientX - canvasRect.left - 140),
      y: Math.max(20, event.clientY - canvasRect.top - 40),
    });
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const updateNodeConfig = (key: string, value: string | boolean | number) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((node) => (node.id === selectedNode.id ? { ...node, config: { ...node.config, [key]: value } } : node))
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((prev) => prev.filter((node) => node.id !== selectedNode.id));
    setSelectedNodeId(null);
  };

  const applyTemplate = (ids: string[]) => {
    const nextNodes = buildTemplate(ids);
    setNodes(nextNodes);
    setSelectedNodeId(nextNodes[0]?.id ?? null);
    setRunLogs([]);
  };

  const buildAgentFromPrompt = () => {
    const prompt = agentPrompt.trim();
    if (!prompt) return;

    const text = prompt.toLowerCase();
    const nextNodes = buildTemplate(chooseAgentNodes(prompt)).map((node) => {
      if (node.templateId === 'manual-trigger') {
        return {
          ...node,
          title: 'User Data',
          description: 'Starts with the data the user provides',
          config: { event: 'user_submits_data' },
          requiredInputs: ['agent prompt', 'user submitted data'],
        };
      }
      if (node.templateId === 'ai-extract') {
        return {
          ...node,
          config: {
            schema: text.includes('lead')
              ? 'name,email,phone,company,intent,team_size,priority'
              : 'summary,key_details,dates,people,next_action',
          },
          requiredInputs: ['sample data', 'schema fields'],
        };
      }
      if (node.templateId === 'ai-classify') {
        return {
          ...node,
          config: { instruction: `Classify this request for routing and urgency: ${prompt}` },
          requiredInputs: ['incoming request', 'routing labels'],
        };
      }
      if (node.templateId === 'ai-generate') {
        return {
          ...node,
          title: 'Special Agent',
          description: 'Follows the user prompt and prepares the final action',
          config: {
            prompt: `You are the Nexora special agent. Goal: ${prompt}. Use the provided user data, keep the output practical, and include the next action.`,
          },
          requiredInputs: ['agent prompt', 'previous node output', 'approval rules'],
        };
      }
      if (node.templateId === 'filter') {
        return {
          ...node,
          config: { condition: text.includes('urgent') || text.includes('priority') ? 'priority is high or urgent' : 'request matches the goal' },
        };
      }
      if (node.templateId === 'github-action') {
        return { ...node, config: { repository: 'owner/repo', action: 'create_issue', title: '{{summary}}', githubToken: '' } };
      }
      if (node.templateId === 'email-send') {
        return {
          ...node,
          config: {
            to: text.includes('customer') ? '{{contact.email}}' : 'team@company.com',
            subject: `Nexora agent: ${guessWorkflowName(prompt)}`,
            body: '{{ai.text}}',
          },
        };
      }
      if (node.templateId === 'http-request') {
        return { ...node, config: { method: 'POST', url: 'https://api.example.com/your-endpoint' } };
      }
      if (node.templateId === 'save-table') {
        return { ...node, config: { table: text.includes('lead') ? 'leads' : 'agent_records', fields: 'summary,status,next_action,source' } };
      }
      return node;
    });

    setWorkflowName(guessWorkflowName(prompt));
    setNodes(nextNodes);
    setSelectedNodeId(nextNodes.find((node) => node.templateId === 'ai-generate')?.id ?? nextNodes[0]?.id ?? null);
    setRunLogs([]);
    setLatestOutput(null);
  };

  const handleRunWorkflow = async () => {
    setIsRunning(true);
    try {
      const result = await databaseService.executeAgentWorkflow(workflowName, nodes, {
        message: sampleData.trim(),
        agentGoal: agentPrompt.trim(),
      });
      const mappedLogs: RunLog[] = (result.logs ?? []).map((message: string, index: number) => ({
        id: makeId('log'),
        nodeId: nodes[index]?.id ?? 'backend',
        title: nodes[index]?.title ?? 'Backend workflow',
        status: message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') ? 'error' : message.toLowerCase().includes('warning') || message.toLowerCase().includes('skipped') || message.toLowerCase().includes('draft') ? 'warning' : 'success',
        message,
        timestamp: new Date().toLocaleTimeString(),
      }));
      const output: RunOutput = {
        id: makeId('run'),
        workflowName,
        status: mappedLogs.some((log) => log.status === 'error') ? 'error' : mappedLogs.some((log) => log.status === 'warning') ? 'warning' : 'success',
        createdAt: result.createdAt ?? new Date().toISOString(),
        context: result.context ?? {},
      };
      await databaseService.setItem(COLLECTIONS.AGENTS, `automation-run-${output.id}`, output);
      setRunLogs(mappedLogs);
      setLatestOutput(output);
      setIsRunning(false);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('API required')) {
        const message = error instanceof Error ? error.message : 'Backend workflow execution failed.';
        setRunLogs([
          {
            id: makeId('log'),
            nodeId: 'backend',
            title: 'Backend workflow',
            status: 'warning',
            message: `${message} Falling back to local preview run.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    }

    const logs: RunLog[] = [];
    const providedData = sampleData.trim();
    const context: Record<string, unknown> = {
      payload: {
        message: providedData || 'User submitted a request to the Nexora agent.',
        contact: {
          name: providedData.match(/\b([A-Z][a-z]+)\b/)?.[1] ?? 'Test user',
          phone: providedData.match(/(\+?\d[\d\s-]{7,}\d)/)?.[1] ?? '+15550101101',
          email: providedData.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? 'user@example.com',
        },
        agentGoal: agentPrompt.trim(),
        source: 'user_preview',
      },
    };

    const pushLog = (node: WorkflowNode, status: RunLog['status'], message: string) => {
      const log: RunLog = {
        id: makeId('log'),
        nodeId: node.id,
        title: node.title,
        status,
        message,
        timestamp: new Date().toLocaleTimeString(),
      };
      logs.push(log);
      setRunLogs([...logs]);
    };

    for (const node of nodes) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      try {
        if (node.type === 'trigger') {
          context.trigger = {
            type: node.templateId,
            config: node.config,
            receivedAt: new Date().toISOString(),
          };
          pushLog(node, 'success', 'Trigger produced a test payload for this run.');
          continue;
        }

        if (node.templateId === 'ai-extract') {
          const message = String((context.payload as { message?: string }).message ?? '');
          context.extracted = {
            name: message.match(/\b([A-Z][a-z]+)\b/)?.[1] ?? 'Test user',
            email: message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? 'user@example.com',
            company: message.match(/(?:from|at)\s+([A-Z][A-Za-z0-9 -]+)/)?.[1]?.trim() ?? 'Unknown company',
            intent: /price|pricing|cost|plan/i.test(message) ? 'pricing' : 'general_request',
            seats: Number(message.match(/team of (\d+)|(\d+)\s+(?:people|users|members|seats)/i)?.[1] ?? message.match(/team of (\d+)|(\d+)\s+(?:people|users|members|seats)/i)?.[2] ?? 1),
          };
          pushLog(node, 'success', 'Extracted structured data from the user input.');
          continue;
        }

        if (node.templateId === 'ai-classify') {
          context.classification = { label: 'sales', priority: 'high', confidence: 0.91 };
          pushLog(node, 'success', 'Classified the message as sales with high priority.');
          continue;
        }

        if (node.templateId === 'ai-generate') {
          context.generatedText = `Agent goal: ${agentPrompt.trim() || String(node.config.prompt || 'Complete this automation.')}\n\nSuggested action: Review the provided data, use extracted fields where available, and complete the configured next step.\n\nDraft output: Thanks for the details. I captured the request and prepared the next action for this workflow.`;
          pushLog(node, 'success', 'Generated a ready-to-use agent output.');
          continue;
        }

        if (node.templateId === 'filter' || node.templateId === 'if-else') {
          context.branch = { passed: true, condition: node.config.condition };
          pushLog(node, 'success', `Condition passed: ${node.config.condition}`);
          continue;
        }

        if (node.templateId === 'save-table') {
          const record = {
            id: makeId('record'),
            table: node.config.table,
            fields: node.config.fields,
            data: context.extracted ?? context.payload,
            createdAt: new Date().toISOString(),
          };
          await databaseService.setItem(COLLECTIONS.AGENTS, `automation-record-${record.id}`, record);
          context.savedRecord = record;
          pushLog(node, 'success', `Saved a real local record: ${record.id}`);
          continue;
        }

        if (node.templateId === 'http-request') {
          const url = String(node.config.url || '');
          if (!url || url.includes('example.com')) {
            context.httpRequest = { skipped: true, reason: 'Replace the example URL with a real endpoint.' };
            pushLog(node, 'warning', 'HTTP call skipped because the node still uses the example URL.');
            continue;
          }
          const response = await fetch(url, {
            method: String(node.config.method || 'POST'),
            headers: { 'Content-Type': 'application/json' },
            body: String(node.config.method || 'POST').toUpperCase() === 'GET' ? undefined : JSON.stringify(context),
          });
          const text = await response.text();
          context.httpResponse = { status: response.status, body: text.slice(0, 2000) };
          pushLog(node, response.ok ? 'success' : 'warning', `HTTP request finished with status ${response.status}.`);
          continue;
        }

        if (node.templateId === 'github-action') {
          const repository = String(node.config.repository || '');
          const token = String(node.config.githubToken || '');
          const title = String(node.config.title || 'Nexora automation task').replace('{{summary}}', 'New lead: pricing request');
          const body = JSON.stringify(context, null, 2);
          if (token && repository.includes('/')) {
            const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
              method: 'POST',
              headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ title, body }),
            });
            const payload = await response.json();
            context.github = response.ok ? { issueUrl: payload.html_url } : { error: payload.message ?? 'GitHub failed' };
            pushLog(node, response.ok ? 'success' : 'error', response.ok ? `Created GitHub issue: ${payload.html_url}` : `GitHub error: ${payload.message}`);
            continue;
          }
          context.githubDraft = { repository, title, body };
          pushLog(node, 'warning', 'Created a GitHub issue draft. Add githubToken in this node config to create it for real.');
          continue;
        }

        if (node.templateId === 'whatsapp-send') {
          context.whatsappDraft = {
            to: node.config.to,
            message: String(node.config.message || '').replace('{{ai.text}}', String(context.generatedText ?? '')),
          };
          pushLog(node, 'warning', 'Prepared WhatsApp payload. Real sending needs WhatsApp Business credentials.');
          continue;
        }

        if (node.templateId === 'linkedin-post') {
          context.linkedinDraft = {
            action: node.config.action,
            content: String(node.config.content || '').replace('{{ai.text}}', String(context.generatedText ?? '')),
          };
          pushLog(node, 'warning', 'Prepared LinkedIn post draft. Real publishing needs LinkedIn OAuth approval.');
          continue;
        }

        if (node.templateId === 'email-send') {
          context.emailDraft = {
            to: node.config.to,
            subject: node.config.subject,
            body: String(node.config.body || '').replace('{{ai.text}}', String(context.generatedText ?? '')),
          };
          pushLog(node, 'warning', 'Prepared email draft. Connect SMTP/provider credentials for real sending.');
          continue;
        }

        pushLog(node, 'success', `${node.title} completed.`);
      } catch (error) {
        pushLog(node, 'error', error instanceof Error ? error.message : 'Node failed.');
        const failedOutput: RunOutput = {
          id: makeId('run'),
          workflowName,
          status: 'error',
          createdAt: new Date().toISOString(),
          context,
        };
        setLatestOutput(failedOutput);
        setIsRunning(false);
        return;
      }
    }

    const output: RunOutput = {
      id: makeId('run'),
      workflowName,
      status: logs.some((log) => log.status === 'warning') ? 'warning' : 'success',
      createdAt: new Date().toISOString(),
      context,
    };
    await databaseService.setItem(COLLECTIONS.AGENTS, `automation-run-${output.id}`, output);
    setLatestOutput(output);
    setIsRunning(false);
  };

  const handleSaveWorkflow = async () => {
    try {
      await databaseService.saveAgentWorkflow('default-workflow', {
        id: 'default-workflow',
        name: workflowName.trim() || 'Nexora Automation MVP',
        updatedAt: new Date().toISOString(),
        nodes,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch (error) {
      console.error('Failed to save workflow:', error);
      setSaveStatus('error');
    }
  };

  const handleExportCode = () => {
    const workflow = {
      name: workflowName,
      nodes: nodes.map(({ position, ...node }) => node),
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nexora-agent-workflow.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (Boolean('private-beta')) return (
    <div className="flex h-full items-center justify-center bg-[#f8fafc] p-6 text-slate-900">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock size={22} />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Beta locked</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">AI Agents are not available yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This feature is in private beta and is locked for all users across every subscription plan. We will open it
          later after the agent builder is ready for real customer workflows.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/app/chat"
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to AI Chat
          </Link>
          <Link
            to="/app/billing"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View plans
          </Link>
        </div>
      </div>
    </div>
  );

  const connectionLines = nodes.slice(0, -1).map((node, index) => ({
    from: node,
    to: nodes[index + 1],
  }));
  const selectedCredentialCount = selectedNode?.credentials.length ?? 0;
  const selectedInputCount = selectedNode?.requiredInputs.length ?? 0;

  return (
    <div className="flex h-full min-w-0 bg-[#f8fafc] text-slate-900">
      {leftOpen && <NodesPanel onNodeSelect={handleAddNode} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setLeftOpen((open) => !open)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
            aria-label={leftOpen ? 'Close node library' : 'Open node library'}
          >
            {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              className="w-full bg-transparent text-base font-semibold text-slate-950 outline-none"
            />
            <p className="hidden text-xs text-slate-400 sm:block">Prompt, edit steps, run, then inspect output.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 md:flex">
            <Database size={14} />
            {nodes.length} nodes
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleExportCode}
          >
            <FileCode size={16} />
            Export
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={handleSaveWorkflow}
          >
            {saveStatus === 'saved' ? <Check size={16} /> : <Save size={16} />}
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry save' : 'Save'}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff6d5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#f45d49] disabled:opacity-60"
            onClick={handleRunWorkflow}
            disabled={isRunning || nodes.length === 0}
          >
            <Play size={16} />
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => setRightOpen((open) => !open)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
            aria-label={rightOpen ? 'Close details panel' : 'Open details panel'}
          >
            {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>

        <div className={`grid min-h-0 flex-1 ${rightOpen ? 'grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
          <div className="flex min-w-0 flex-col">
            <div className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
              <div className="mx-auto grid max-w-5xl gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)_auto] lg:items-stretch">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <Wand2 size={13} />
                    Describe
                  </span>
                  <textarea
                    value={agentPrompt}
                    onChange={(event) => setAgentPrompt(event.target.value)}
                    rows={3}
                    className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#ff6d5a] focus:bg-white"
                    placeholder="Example: When a lead asks pricing, extract details, save it, and email my team."
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Test input
                  </span>
                  <textarea
                    value={sampleData}
                    onChange={(event) => setSampleData(event.target.value)}
                    rows={3}
                    className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#ff6d5a] focus:bg-white"
                    placeholder="Paste a sample message, form data, request, or task details."
                  />
                </label>
                <button
                  type="button"
                  onClick={buildAgentFromPrompt}
                  className="inline-flex h-16 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 lg:self-end"
                  disabled={!agentPrompt.trim()}
                >
                  <Wand2 size={17} />
                  Create agent
                </button>
              </div>

              <div className="mx-auto mt-3 flex max-w-5xl gap-2 overflow-x-auto pb-1">
                {starterTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template.nodes)}
                    className="min-w-[210px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Wand2 size={15} className="text-[#ff6d5a]" />
                      {template.title}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="relative min-h-0 flex-1 overflow-auto bg-[#f8fafc]"
              onClick={() => setSelectedNodeId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleCanvasDrop}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.09) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              <svg className="absolute left-0 top-0 h-[1400px] w-[2200px] pointer-events-none">
                <defs>
                  <marker id="agent-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ff6d5a" />
                  </marker>
                </defs>
                {connectionLines.map(({ from, to }) => (
                  <line
                    key={`${from.id}-${to.id}`}
                    x1={from.position.x + 280}
                    y1={from.position.y + 54}
                    x2={to.position.x}
                    y2={to.position.y + 54}
                    stroke="#ff6d5a"
                    strokeWidth="2"
                    markerEnd="url(#agent-arrow)"
                  />
                ))}
              </svg>

              {nodes.map((node, index) => (
                <FlowNode
                  key={node.id}
                  node={node}
                  index={index}
                  position={node.position}
                  onPositionChange={(id, position) =>
                    setNodes((prev) => prev.map((item) => (item.id === id ? { ...item, position } : item)))
                  }
                  selected={selectedNodeId === node.id}
                  onSelect={setSelectedNodeId}
                />
              ))}

              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
                    onClick={() => applyTemplate(starterTemplates[0].nodes)}
                  >
                    <Plus size={16} />
                    Start with a WhatsApp automation
                  </button>
                </div>
              )}

              {isRunning && (
                <motion.div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg">
                    Running workflow...
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {rightOpen && <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white/95">
            <section className="border-b border-slate-100 p-4">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Settings2 size={15} />
                Configure
              </h2>
              {selectedNode ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-base font-semibold text-slate-950">{selectedNode.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{selectedNode.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Inputs</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedInputCount}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Credentials</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedCredentialCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Database size={13} />
                      Required data
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.requiredInputs.map((input) => (
                        <span key={input} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                          {input}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fff7ed] p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <Lock size={13} />
                      Credentials needed
                    </p>
                    {selectedNode.credentials.length > 0 ? (
                      <div className="space-y-2">
                        {selectedNode.credentials.map((credential) => (
                          <label key={credential} className="block">
                            <span className="mb-1 block text-[11px] font-medium text-amber-800">{credential}</span>
                            <input
                              type="password"
                              value={String(selectedNode.config[credentialConfigKey(credential)] ?? '')}
                              onChange={(event) => updateNodeConfig(credentialConfigKey(credential), event.target.value)}
                              placeholder="Paste credential or env key"
                              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#ff6d5a]"
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">This step runs inside Nexora and does not need external credentials.</p>
                    )}
                  </div>
                  {Object.entries(selectedNode.config).map(([key, value]) => {
                    const isLongField = /prompt|body|message|instruction|schema|condition|response|content/i.test(key);
                    return (
                      <label key={key} className="block space-y-1 text-xs font-semibold text-slate-500">
                        {key}
                        {isLongField ? (
                          <textarea
                            value={String(value)}
                            onChange={(event) => updateNodeConfig(key, event.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-[#ff6d5a] focus:bg-white"
                          />
                        ) : (
                          <input
                            value={String(value)}
                            onChange={(event) => updateNodeConfig(key, event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#ff6d5a] focus:bg-white"
                          />
                        )}
                      </label>
                    );
                  })}
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    onClick={deleteSelectedNode}
                  >
                    <Trash2 size={15} />
                    Delete node
                  </button>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Select a node to edit its data, credentials, API settings, action, prompt, or trigger details.</p>
              )}
            </section>

            <section className="border-b border-slate-100 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Connections</h2>
              <div className="mt-3 space-y-2">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{account.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{account.tokenHint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccounts((prev) =>
                            prev.map((item) => (item.id === account.id ? { ...item, connected: !item.connected } : item))
                          )
                        }
                        className={`rounded-md px-2.5 py-1.5 text-xs ${
                          account.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'
                        }`}
                      >
                        {account.connected ? 'Connected' : 'Connect'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Run Logs</h2>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                  onClick={() => navigator.clipboard.writeText(runLogs.map((log) => `${log.timestamp} ${log.title}: ${log.message}`).join('\n'))}
                  aria-label="Copy run logs"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {runLogs.length === 0 && (
                  <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Run the workflow to see trigger, AI, logic, credential, and integration results.
                  </div>
                )}
                {runLogs.map((log) => (
                  <div key={log.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          log.status === 'success' ? 'bg-emerald-400' : log.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                      />
                      <p className="text-sm font-medium text-slate-900">{log.title}</p>
                      <span className="ml-auto text-[11px] text-slate-400">{log.timestamp}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{log.message}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="border-t border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Output</h2>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                  onClick={() => latestOutput && navigator.clipboard.writeText(JSON.stringify(latestOutput, null, 2))}
                  aria-label="Copy latest output"
                >
                  <Copy size={14} />
                </button>
              </div>
              {latestOutput ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
                  {JSON.stringify(latestOutput.context, null, 2)}
                </pre>
              ) : (
                <p className="mt-3 rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Run a workflow to create a real saved output here.
                </p>
              )}
            </section>
          </aside>}
        </div>

        <div className="flex h-8 items-center border-t border-slate-200 bg-white px-4 text-xs text-slate-500">
          <span>{nodes.length} nodes</span>
          <span className="mx-2 h-3 w-px bg-slate-200" />
          <span>{Math.max(0, nodes.length - 1)} sequential links</span>
          <span className="mx-2 h-3 w-px bg-slate-200" />
          <KeyRound size={13} className="mr-1" />
          <span>{accounts.filter((account) => account.connected).length}/{accounts.length} integrations connected</span>
        </div>
      </div>
    </div>
  );
}
