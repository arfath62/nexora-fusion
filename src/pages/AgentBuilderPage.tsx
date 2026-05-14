import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Copy,
  FileCode,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Save,
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
  { id: 'github', name: 'GitHub', connected: true, tokenHint: 'Connected for MVP mock runs' },
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
    color: template.color,
    iconKey: template.iconKey,
    config: { ...template.config },
    outputs: [...template.outputs],
    position: position ?? { x: 180 + index * 260, y: 160 + (index % 2) * 150 },
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

const initialNodes = buildTemplate(['manual-trigger', 'ai-generate', 'github-action', 'email-send']);

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
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const savedWorkflow = await databaseService.getAgentWorkflow('default-workflow');
        if (savedWorkflow?.nodes?.length) {
          setWorkflowName(savedWorkflow.name || 'Nexora Automation MVP');
          setNodes(savedWorkflow.nodes);
          setSelectedNodeId(savedWorkflow.nodes[0]?.id ?? null);
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

  const handleRunWorkflow = async () => {
    setIsRunning(true);
    const logs: RunLog[] = [];
    const context: Record<string, unknown> = {
      payload: {
        message: 'Hi, I want pricing for Nexora for my team of 5.',
        contact: { name: 'Aarav Sharma', phone: '+15550101101', email: 'aarav@example.com' },
        source: 'manual_test',
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
          context.extracted = {
            name: 'Aarav Sharma',
            email: 'aarav@example.com',
            company: 'Nexora prospect',
            intent: 'pricing',
            seats: 5,
          };
          pushLog(node, 'success', 'Extracted structured lead data from the incoming message.');
          continue;
        }

        if (node.templateId === 'ai-classify') {
          context.classification = { label: 'sales', priority: 'high', confidence: 0.91 };
          pushLog(node, 'success', 'Classified the message as sales with high priority.');
          continue;
        }

        if (node.templateId === 'ai-generate') {
          context.generatedText =
            'Thanks for reaching out. Nexora can support a 5-person team with AI chat, workflow agents, and video tools. I can help you compare plans and set up a workspace.';
          pushLog(node, 'success', 'Generated a ready-to-use response.');
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

  const connectionLines = nodes.slice(0, -1).map((node, index) => ({
    from: node,
    to: nodes[index + 1],
  }));

  return (
    <div className="flex h-full min-w-0">
      {leftOpen && <NodesPanel onNodeSelect={handleAddNode} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 bg-black/20 px-4">
          <button
            type="button"
            onClick={() => setLeftOpen((open) => !open)}
            className="rounded-md p-2 text-gray-300 hover:bg-white/10"
            aria-label={leftOpen ? 'Close node library' : 'Open node library'}
          >
            {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <input
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-white outline-none"
          />
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
            onClick={handleExportCode}
          >
            <FileCode size={16} />
            Export
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
            onClick={handleSaveWorkflow}
          >
            {saveStatus === 'saved' ? <Check size={16} /> : <Save size={16} />}
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry save' : 'Save'}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            onClick={handleRunWorkflow}
            disabled={isRunning || nodes.length === 0}
          >
            <Play size={16} />
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => setRightOpen((open) => !open)}
            className="rounded-md p-2 text-gray-300 hover:bg-white/10"
            aria-label={rightOpen ? 'Close details panel' : 'Open details panel'}
          >
            {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>

        <div className={`grid min-h-0 flex-1 ${rightOpen ? 'grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
          <div className="flex min-w-0 flex-col">
            <div className="border-b border-white/10 bg-black/10 p-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {starterTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template.nodes)}
                    className="min-w-[220px] rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Wand2 size={15} className="text-indigo-300" />
                      {template.title}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="relative min-h-0 flex-1 overflow-auto bg-[#080810]"
              onClick={() => setSelectedNodeId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleCanvasDrop}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              <svg className="absolute left-0 top-0 h-[1400px] w-[2200px] pointer-events-none">
                <defs>
                  <marker id="agent-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#818CF8" />
                  </marker>
                </defs>
                {connectionLines.map(({ from, to }) => (
                  <line
                    key={`${from.id}-${to.id}`}
                    x1={from.position.x + 288}
                    y1={from.position.y + 54}
                    x2={to.position.x}
                    y2={to.position.y + 54}
                    stroke="#818CF8"
                    strokeWidth="2"
                    strokeDasharray="5 5"
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
                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-gray-300"
                    onClick={() => applyTemplate(starterTemplates[0].nodes)}
                  >
                    <Plus size={16} />
                    Start with a WhatsApp automation
                  </button>
                </div>
              )}

              {isRunning && (
                <motion.div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="rounded-lg border border-white/10 bg-black/80 px-4 py-3 text-sm font-medium text-white">
                    Running workflow...
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {rightOpen && <aside className="min-h-0 overflow-y-auto border-l border-white/10 bg-black/30">
            <section className="border-b border-white/10 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Node Config</h2>
              {selectedNode ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-base font-semibold text-white">{selectedNode.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">{selectedNode.description}</p>
                  </div>
                  {Object.entries(selectedNode.config).map(([key, value]) => (
                    <label key={key} className="block space-y-1 text-xs font-medium text-gray-400">
                      {key}
                      <input
                        value={String(value)}
                        onChange={(event) => updateNodeConfig(key, event.target.value)}
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                      />
                    </label>
                  ))}
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-200 hover:bg-red-500/25"
                    onClick={deleteSelectedNode}
                  >
                    <Trash2 size={15} />
                    Delete node
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-400">Select a node to edit its app action, prompt, or trigger settings.</p>
              )}
            </section>

            <section className="border-b border-white/10 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Connections</h2>
              <div className="mt-3 space-y-2">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{account.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{account.tokenHint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAccounts((prev) =>
                            prev.map((item) => (item.id === account.id ? { ...item, connected: !item.connected } : item))
                          )
                        }
                        className={`rounded-md px-2.5 py-1.5 text-xs ${
                          account.connected ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-gray-300'
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
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Run Logs</h2>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-gray-400 hover:bg-white/10"
                  onClick={() => navigator.clipboard.writeText(runLogs.map((log) => `${log.timestamp} ${log.title}: ${log.message}`).join('\n'))}
                  aria-label="Copy run logs"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {runLogs.length === 0 && (
                  <div className="rounded-md border border-dashed border-white/10 p-4 text-sm text-gray-400">
                    Run the workflow to see each trigger, AI, logic, and integration step.
                  </div>
                )}
                {runLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          log.status === 'success' ? 'bg-emerald-400' : log.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                      />
                      <p className="text-sm font-medium text-white">{log.title}</p>
                      <span className="ml-auto text-[11px] text-gray-500">{log.timestamp}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">{log.message}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="border-t border-white/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Real Output</h2>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-gray-400 hover:bg-white/10"
                  onClick={() => latestOutput && navigator.clipboard.writeText(JSON.stringify(latestOutput, null, 2))}
                  aria-label="Copy latest output"
                >
                  <Copy size={14} />
                </button>
              </div>
              {latestOutput ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-gray-300">
                  {JSON.stringify(latestOutput.context, null, 2)}
                </pre>
              ) : (
                <p className="mt-3 rounded-md border border-dashed border-white/10 p-4 text-sm text-gray-400">
                  Run a workflow to create a real saved output here.
                </p>
              )}
            </section>
          </aside>}
        </div>

        <div className="flex h-8 items-center border-t border-white/10 bg-black/60 px-4 text-xs text-gray-400">
          <span>{nodes.length} nodes</span>
          <span className="mx-2 h-3 w-px bg-white/10" />
          <span>{Math.max(0, nodes.length - 1)} sequential links</span>
          <span className="mx-2 h-3 w-px bg-white/10" />
          <KeyRound size={13} className="mr-1" />
          <span>{accounts.filter((account) => account.connected).length}/{accounts.length} integrations connected</span>
        </div>
      </div>
    </div>
  );
}
