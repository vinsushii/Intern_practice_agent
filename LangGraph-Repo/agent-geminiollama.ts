import 'dotenv/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const getCurrentTime = tool(
  async () => new Date().toISOString(),
  {
    name: 'getCurrentTime',
    description: 'Returns the current server time. Use this if the user asks what time it is.',
    schema: z.object({}),
  }
);

const geminiModel = new ChatGoogleGenerativeAI({ model: 'gemini-2.5-flash' }).bindTools([getCurrentTime]);
const ollamaModel = new ChatOllama({ model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434' });

const toolNode = new ToolNode([getCurrentTime]);

// Gemini node: handles tool-requiring reasoning
async function callGemini(state: typeof MessagesAnnotation.State) {
  console.log('-> calling: Gemini');
  const response = await geminiModel.invoke(state.messages);
  return { messages: [response] };
}

// Ollama node: handles plain explanation, no tools
async function callOllama(state: typeof MessagesAnnotation.State) {
  console.log('-> calling: Ollama (local)');
  const response = await ollamaModel.invoke(state.messages);
  return { messages: [response] };
}

// Router: decide which model handles the request at all
function routeModel(state: typeof MessagesAnnotation.State) {
  const userMessage = state.messages[0].content as string;
  if (userMessage.toLowerCase().includes('time')) {
    return 'gemini';
  }
  return 'ollama';
}

function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages.at(-1) as any;
  if (lastMessage.tool_calls?.length) {
    console.log('-> routing to: tools');
    return 'tools';
  }
  console.log('-> routing to: end');
  return '__end__';
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode('gemini', callGemini)
  .addNode('ollama', callOllama)
  .addNode('tools', toolNode)
  .addConditionalEdges('__start__', routeModel)
  .addConditionalEdges('gemini', shouldContinue)
  .addEdge('tools', 'gemini')
  .addEdge('ollama', '__end__')
  .compile();

async function run(prompt: string) {
  const result = await graph.invoke({
    messages: [{ role: 'user', content: prompt }],
  });
  console.log(result.messages.at(-1)?.content);
  console.log('---');
}

await run('What time is it right now?');
await run('Explain rubiks cube in two sentences.');