import 'dotenv/config';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const getCurrentTime = tool(
  async () => {
    return new Date().toISOString();
  },
  {
    name: 'getCurrentTime',
    description: 'Returns the current server time. Use this if the user asks what time it is.',
    schema: z.object({}),
  }
);

const model = new ChatOllama({
  model: 'llama3.2',
  baseUrl: 'http://127.0.0.1:11434',
}).bindTools([getCurrentTime]);

const toolNode = new ToolNode([getCurrentTime]);

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
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
  .addNode('agent', callModel)
  .addNode('tools', toolNode)
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent')
  .compile();

const result = await graph.invoke({
  messages: [{ role: 'user', content: 'What time is it right now?' }],
});

console.log(result.messages.at(-1)?.content);