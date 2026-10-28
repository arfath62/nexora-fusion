import { completeWithOpenRouter, isOpenRouterConfigured } from './openRouter';

type WorkflowContext = Record<string, any>;

function getPath(context: WorkflowContext, key: string) {
  const aliases: Record<string, string> = {
    json: 'json',
    summary: 'summary',
    text: 'ai.text',
  };
  const normalized = aliases[key.trim()] ?? key.trim();
  const path = normalized.split('.');
  let current: any = context;
  for (const part of path) current = current?.[part];
  return current;
}

function renderTemplate(value: unknown, context: WorkflowContext) {
  return String(value ?? '').replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const current = getPath(context, String(key));
    return current == null ? '' : typeof current === 'string' ? current : JSON.stringify(current);
  });
}

function makePayload(inputData?: any) {
  const inputRecord = inputData && typeof inputData === 'object' && !Array.isArray(inputData) ? inputData : {};
  const message =
    typeof inputData === 'string'
      ? inputData
      : inputRecord.message || 'Hi, I want pricing for Nexora for my team of 5.';
  const email = String(message).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? inputRecord.email ?? 'user@example.com';
  const phone = String(message).match(/(\+?\d[\d\s-]{7,}\d)/)?.[1] ?? inputRecord.phone ?? '+15550101101';
  return {
    ...inputRecord,
    message,
    contact: {
      name: inputRecord.name ?? String(message).match(/\b([A-Z][a-z]+)\b/)?.[1] ?? 'Test user',
      phone,
      email,
      ...(inputRecord.contact ?? {}),
    },
    source: inputRecord.source ?? 'agent_builder_live_run',
  };
}

function tryJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  const candidates = [trimmed, fenced, trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)?.[1]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function stringifyOutput(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

function parseRecordFields(value: unknown, context: WorkflowContext) {
  const rendered = renderTemplate(value, context);
  const parsed = tryJson(rendered);
  if (parsed && typeof parsed === 'object') return parsed;
  return { text: rendered };
}

async function runAiNode(node: any, context: WorkflowContext) {
  const basePrompt = renderTemplate(
    node.config?.prompt ?? node.config?.instruction ?? node.config?.schema ?? 'Process this automation payload.',
    context
  );
  const mode =
    node.templateId === 'ai-extract'
      ? 'Extract data as strict JSON only.'
      : node.templateId === 'ai-classify'
        ? 'Classify the input as strict JSON with label, priority, confidence, and reason.'
        : 'Generate the best practical automation output.';

  let text = '';
  if (!isOpenRouterConfigured()) {
    text =
      node.templateId === 'ai-extract'
        ? JSON.stringify({ summary: context.payload?.message ?? '', email: context.contact?.email, phone: context.contact?.phone })
        : node.templateId === 'ai-classify'
          ? JSON.stringify({ label: 'general', priority: 'normal', confidence: 0.5, reason: 'OpenRouter is not configured.' })
          : `Draft output for: ${context.payload?.message ?? context.agentGoal ?? 'automation request'}`;
  } else {
    try {
      text = await completeWithOpenRouter([
        {
          role: 'system',
          content:
            'You are the Nexora automation execution engine. Be precise. For extraction/classification return valid JSON when requested. Never invent credentials.',
        },
        {
          role: 'user',
          content: `${mode}\n\nNode goal:\n${basePrompt}\n\nWorkflow context:\n${JSON.stringify(context, null, 2)}`,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenRouter request failed.';
      text =
        node.templateId === 'ai-classify'
          ? JSON.stringify({ label: 'error', priority: 'normal', confidence: 0, reason: message })
          : node.templateId === 'ai-extract'
            ? JSON.stringify({ error: message, sourceText: context.payload?.message ?? '' })
            : `OpenRouter failed: ${message}`;
    }
  }

  const parsed = tryJson(text);
  if (node.templateId === 'ai-extract') {
    context.extracted = parsed ?? { text };
    context.json = context.extracted;
    context.summary = parsed?.summary ?? parsed?.intent ?? stringifyOutput(context.extracted).slice(0, 140);
  } else if (node.templateId === 'ai-classify') {
    context.classification = parsed ?? { label: text, priority: 'normal', confidence: 0.5 };
    context.summary = parsed?.reason ?? parsed?.label ?? text.slice(0, 140);
  } else {
    context.ai = { ...(context.ai ?? {}), text };
    context.summary = text.slice(0, 140);
  }
  context.ai = { ...(context.ai ?? {}), text: stringifyOutput(parsed ?? text), last: parsed ?? text };
  context[node.id] = parsed ?? text;
  return parsed ?? text;
}

async function postJson(url: string, body: any, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text.slice(0, 4000) };
}

export async function executeWorkflow(nodes: any[], workflowName = 'Nexora Automation', inputData?: any) {
  const logs: string[] = [];
  const payload = makePayload(inputData);
  const context: WorkflowContext = {
    workflowName,
    payload,
    contact: payload.contact,
    agentGoal: inputData?.agentGoal ?? '',
    ai: {},
  };

  for (const node of nodes) {
    logs.push(`Executing node: ${node.title} (${node.type})`);
    try {
      if (node.type === 'trigger') {
        context.trigger = { id: node.id, templateId: node.templateId, receivedAt: new Date().toISOString(), config: node.config ?? {} };
        context[node.id] = payload;
        logs.push(`Trigger received live input data.`);
        continue;
      }

      if (node.type === 'ai') {
        const output = await runAiNode(node, context);
        logs.push(`OpenRouter AI completed ${node.title}.`);
        logs.push(`Output preview: ${typeof output === 'string' ? output.slice(0, 120) : JSON.stringify(output).slice(0, 120)}`);
        continue;
      }

      if (node.type === 'logic') {
        const condition = renderTemplate(node.config?.condition ?? 'true', context);
        context[node.id] = { passed: true, condition };
        context.branch = context[node.id];
        logs.push(`Logic evaluated: ${condition}`);
        continue;
      }

      if (node.type === 'data') {
        const record = {
          id: `record-${Date.now()}`,
          table: node.config?.table ?? 'agent_records',
          fields: node.config?.fields,
          data: context.extracted ?? context.json ?? context.payload,
          createdAt: new Date().toISOString(),
        };
        context[node.id] = record;
        context.savedRecord = record;
        logs.push(`Created saved-record output ${record.id}.`);
        continue;
      }

      if (node.type === 'output') {
        context.response = renderTemplate(node.config?.response ?? '{{ai.text}}', context);
        context[node.id] = { response: context.response };
        logs.push(`Returned workflow response.`);
        continue;
      }

      if (node.type !== 'integration') {
        context[node.id] = { skipped: true, reason: 'Unknown node type.' };
        logs.push(`Skipped unknown node type.`);
        continue;
      }

      if (node.templateId === 'http-request') {
        const url = renderTemplate(node.config?.url, context);
        if (!url || url.includes('example.com')) {
          context[node.id] = { skipped: true, reason: 'Configure a real URL.' };
          logs.push(`HTTP request skipped because URL is not configured.`);
          continue;
        }
        const method = String(node.config?.method || 'POST').toUpperCase();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const bearer = node.config?.bearerToken || node.config?.apiKey;
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        const response = await fetch(url, {
          method,
          headers,
          body: method === 'GET' ? undefined : JSON.stringify({ workflowName, context }),
        });
        context[node.id] = { status: response.status, body: (await response.text()).slice(0, 4000) };
        logs.push(`HTTP request finished with status ${response.status}.`);
        continue;
      }

      if (node.templateId === 'slack-send' || node.templateId === 'discord-send') {
        const webhookUrl = renderTemplate(node.config?.webhookUrl, context);
        const text = renderTemplate(node.config?.text ?? node.config?.content ?? '{{ai.text}}', context);
        if (!webhookUrl) {
          context[node.id] = { draft: true, text, reason: 'Add webhookUrl to send live.' };
          logs.push(`${node.title} draft prepared. Add webhook URL to send live.`);
          continue;
        }
        const body = node.templateId === 'discord-send' ? { content: text } : { text, channel: node.config?.channel };
        context[node.id] = await postJson(webhookUrl, body);
        logs.push(`${node.title} webhook sent with status ${context[node.id].status}.`);
        continue;
      }

      if (node.templateId === 'github-action') {
        const repository = renderTemplate(node.config?.repository, context);
        const token = node.config?.githubToken || process.env.GITHUB_TOKEN;
        const title = renderTemplate(node.config?.title || '{{workflowName}} task', context) || `${workflowName} task`;
        if (repository.includes('/') && token) {
          const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
            method: 'POST',
            headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body: JSON.stringify(context, null, 2) }),
          });
          const result = (await response.json()) as any;
          context[node.id] = response.ok ? { issueUrl: result.html_url } : { error: result.message };
          logs.push(response.ok ? `Created GitHub issue: ${result.html_url}` : `GitHub failed: ${result.message}`);
          continue;
        }
        context[node.id] = { draft: true, repository, title, body: context };
        logs.push(`GitHub draft created. Add githubToken or GITHUB_TOKEN to create issues live.`);
        continue;
      }

      if (node.templateId === 'notion-create') {
        const token = node.config?.notionToken;
        const databaseId = renderTemplate(node.config?.databaseId, context);
        const title = renderTemplate(node.config?.title || workflowName, context);
        const content = renderTemplate(node.config?.content || '{{ai.text}}', context);
        if (!token || !databaseId) {
          context[node.id] = { draft: true, title, content, reason: 'Add notionToken and databaseId.' };
          logs.push(`Notion draft prepared. Add token and database id to create live page.`);
          continue;
        }
        const response = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: { Name: { title: [{ text: { content: title } }] } },
            children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: content.slice(0, 1900) } }] } }],
          }),
        });
        const result = (await response.json()) as any;
        context[node.id] = response.ok ? { pageUrl: result.url } : { error: result.message ?? result };
        logs.push(response.ok ? `Created Notion page.` : `Notion failed: ${result.message ?? response.status}`);
        continue;
      }

      if (node.templateId === 'airtable-create') {
        const token = node.config?.token;
        const baseId = renderTemplate(node.config?.baseId, context);
        const tableName = encodeURIComponent(renderTemplate(node.config?.tableName || 'Leads', context));
        if (!token || !baseId) {
          context[node.id] = { draft: true, fields: parseRecordFields(node.config?.fields, context), reason: 'Add token and baseId.' };
          logs.push(`Airtable draft prepared. Add token and base id to create live record.`);
          continue;
        }
        const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableName}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: parseRecordFields(node.config?.fields, context) }),
        });
        const result = (await response.json()) as any;
        context[node.id] = response.ok ? { recordId: result.id } : { error: result.error ?? result };
        logs.push(response.ok ? `Created Airtable record.` : `Airtable failed with status ${response.status}.`);
        continue;
      }

      if (node.templateId === 'google-sheets-append') {
        const apiKey = node.config?.apiKey;
        const spreadsheetId = renderTemplate(node.config?.spreadsheetId, context);
        const range = encodeURIComponent(renderTemplate(node.config?.range || 'Sheet1!A:D', context));
        const values = parseRecordFields(node.config?.values, context);
        if (!apiKey || !spreadsheetId) {
          context[node.id] = { draft: true, values, reason: 'Add apiKey and spreadsheetId.' };
          logs.push(`Google Sheets draft prepared. Add API key and spreadsheet id to append live.`);
          continue;
        }
        const row = Array.isArray(values) ? values : [Object.values(values)];
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&key=${apiKey}`;
        context[node.id] = await postJson(url, { values: row });
        logs.push(`Google Sheets append finished with status ${context[node.id].status}.`);
        continue;
      }

      if (node.templateId === 'whatsapp-send') {
        const accessToken = node.config?.accessToken;
        const phoneNumberId = node.config?.phoneNumberId;
        const to = renderTemplate(node.config?.to ?? '{{contact.phone}}', context);
        const message = renderTemplate(node.config?.message ?? '{{ai.text}}', context);
        if (!accessToken || !phoneNumberId) {
          context[node.id] = { draft: true, to, message, reason: 'Add WhatsApp accessToken and phoneNumberId.' };
          logs.push(`WhatsApp draft prepared. Add WhatsApp credentials to send live.`);
          continue;
        }
        const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
        context[node.id] = await postJson(
          url,
          { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
          { Authorization: `Bearer ${accessToken}` }
        );
        logs.push(`WhatsApp send finished with status ${context[node.id].status}.`);
        continue;
      }

      if (node.templateId === 'email-send') {
        context[node.id] = {
          draft: true,
          to: renderTemplate(node.config?.to, context),
          subject: renderTemplate(node.config?.subject, context),
          body: renderTemplate(node.config?.body, context),
          reason: 'SMTP sending needs a mail provider adapter. Draft is ready.',
        };
        logs.push(`Email draft prepared.`);
        continue;
      }

      if (node.templateId === 'linkedin-post') {
        context[node.id] = { draft: true, config: node.config, reason: 'LinkedIn live posting requires an approved OAuth app.' };
        logs.push(`LinkedIn post draft prepared.`);
        continue;
      }

      context[node.id] = { draft: true, config: node.config };
      logs.push(`${node.title} payload prepared.`);
    } catch (e: any) {
      logs.push(`Error executing node ${node.title}: ${e.message}`);
      throw new Error(`Execution failed at ${node.title}: ${e.message}`);
    }
  }

  logs.push(`Workflow execution completed successfully.`);
  return { logs, context, workflowName, status: 'success', createdAt: new Date().toISOString() };
}
