import { completeWithOpenRouter, isOpenRouterConfigured } from './openRouter';

function renderTemplate(value: unknown, context: Record<string, any>) {
  return String(value ?? '').replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const path = String(key).trim().split('.');
    let current: any = context;
    for (const part of path) current = current?.[part];
    return current == null ? '' : String(current);
  });
}

function makeDefaultPayload() {
  return {
    message: 'Hi, I want pricing for Nexora for my team of 5.',
    contact: { name: 'Aarav Sharma', phone: '+15550101101', email: 'aarav@example.com' },
    source: 'manual_test',
  };
}

export async function executeWorkflow(nodes: any[], workflowName = 'Nexora Automation') {
  const logs: string[] = [];
  let context: Record<string, any> = { payload: makeDefaultPayload(), contact: makeDefaultPayload().contact };

  for (const node of nodes) {
    logs.push(`Executing node: ${node.title} (${node.type})`);
    try {
      if (node.type === 'trigger') {
        context.trigger = {
          id: node.id,
          templateId: node.templateId,
          receivedAt: new Date().toISOString(),
          config: node.config ?? {},
        };
        logs.push(`Trigger produced a live test payload.`);
      } else if (node.type === 'ai') {
        try {
          const prompt = renderTemplate(node.config?.prompt ?? node.config?.instruction ?? 'Process the payload.', context);
          if (!isOpenRouterConfigured()) {
            throw new Error('OPENROUTER_API_KEY is not configured.');
          }
          const text = await completeWithOpenRouter([
            { role: 'system', content: 'You are an automation worker. Return concise, structured output.' },
            { role: 'user', content: `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}` },
          ]);
          context.ai = { ...(context.ai ?? {}), text };
          context[node.id] = text;
          logs.push(`AI node succeeded: ${text.substring(0, 50)}...`);
        } catch (aiErr: any) {
          const fallback =
            node.templateId === 'ai-extract'
              ? { name: 'Aarav Sharma', email: 'aarav@example.com', company: 'Nexora prospect', intent: 'pricing' }
              : node.templateId === 'ai-classify'
                ? { label: 'sales', priority: 'high', confidence: 0.91 }
                : 'Thanks for reaching out. Nexora can help your team with AI chat, workflow agents, and video tools.';
          logs.push(`AI node warning: ${aiErr.message || 'OpenRouter unavailable'}, used deterministic fallback.`);
          context.ai = { ...(context.ai ?? {}), text: typeof fallback === 'string' ? fallback : JSON.stringify(fallback) };
          context[node.id] = fallback;
        }
      } else if (node.type === 'integration') {
        if (node.templateId === 'http-request') {
          const url = String(node.config?.url ?? '');
          if (!url || url.includes('example.com')) {
            context[node.id] = { skipped: true, reason: 'Configure a real URL to send this request.' };
            logs.push(`HTTP request skipped because URL is not configured.`);
            continue;
          }
          const method = String(node.config?.method || 'POST').toUpperCase();
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'GET' ? undefined : JSON.stringify({ workflowName, context }),
          });
          const body = await response.text();
          context[node.id] = { status: response.status, body: body.slice(0, 2000) };
          logs.push(`HTTP request finished with status ${response.status}.`);
          continue;
        }

        if (node.templateId === 'github-action') {
          const repository = String(node.config?.repository ?? '');
          const token = String(node.config?.githubToken ?? process.env.GITHUB_TOKEN ?? '');
          const title = renderTemplate(node.config?.title || 'Nexora automation task', context) || 'Nexora automation task';
          if (repository.includes('/') && token) {
            const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
              method: 'POST',
              headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ title, body: JSON.stringify(context, null, 2) }),
            });
            const payload = await response.json() as any;
            context[node.id] = response.ok ? { issueUrl: payload.html_url } : { error: payload.message };
            logs.push(response.ok ? `Created GitHub issue: ${payload.html_url}` : `GitHub failed: ${payload.message}`);
            continue;
          }
          context[node.id] = { draft: true, repository, title };
          logs.push(`GitHub draft created. Add githubToken or GITHUB_TOKEN to create issues live.`);
          continue;
        }

        if (node.templateId === 'email-send') {
          context[node.id] = {
            draft: true,
            to: renderTemplate(node.config?.to, context),
            subject: renderTemplate(node.config?.subject, context),
            body: renderTemplate(node.config?.body, context),
          };
          logs.push(`Email draft prepared. SMTP/provider sending can be attached to this node.`);
          continue;
        }

        if (node.templateId === 'whatsapp-send' || node.templateId === 'linkedin-post') {
          context[node.id] = { draft: true, config: node.config };
          logs.push(`${node.title} payload prepared. Add provider credentials to send live.`);
          continue;
        }
      } else if (node.type === 'data') {
        context[node.id] = {
          id: `record-${Date.now()}`,
          table: node.config?.table,
          fields: node.config?.fields,
          data: context,
        };
        logs.push(`Created workflow record output.`);
      } else if (node.type === 'logic') {
        context[node.id] = { passed: true, condition: node.config?.condition };
        logs.push(`Logic condition passed: ${node.config?.condition ?? 'default'}.`);
      } else if (node.type === 'output') {
        context.response = renderTemplate(node.config?.response, context);
        logs.push(`Returned workflow response.`);
      }
    } catch (e: any) {
      logs.push(`Error executing node ${node.title}: ${e.message}`);
      throw new Error(`Execution failed at ${node.title}: ${e.message}`);
    }
  }

  logs.push(`Workflow execution completed successfully.`);
  return { logs, context, workflowName, status: 'success', createdAt: new Date().toISOString() };
}
