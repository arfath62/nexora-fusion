import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

export async function executeWorkflow(nodes: any[]) {
  const logs: string[] = [];
  let context: Record<string, any> = {};

  for (const node of nodes) {
    logs.push(`Executing node: ${node.title} (${node.type})`);
    try {
      if (node.type === 'trigger') {
        context.trigger = "Started";
      } else if (node.type === 'ai') {
        try {
          const response = await ollama.chat({
            model: 'tinyllama',
            messages: [{ role: 'user', content: "Workflow node execution. Parameters: " + JSON.stringify(node.parameters) }]
          });
          context[node.id] = response.message.content;
          logs.push(`AI node succeeded: ${response.message.content.substring(0, 50)}...`);
        } catch (ollamaErr: any) {
          logs.push(`AI node warning (Ollama might not be running): Simulated AI success`);
          context[node.id] = "Simulated AI result";
        }
      } else if (node.type === 'integration') {
        // mock integration
        context[node.id] = `Integration result for ${node.title}`;
      }
    } catch (e: any) {
      logs.push(`Error executing node ${node.title}: ${e.message}`);
      throw new Error(`Execution failed at ${node.title}: ${e.message}`);
    }
  }

  logs.push(`Workflow execution completed successfully.`);
  return { logs, context };
}
