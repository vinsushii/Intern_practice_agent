import 'dotenv/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
}).bindTools([getCurrentTime]);

const toolNode = new ToolNode([getCurrentTime]);

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages.at(-1) as any;
  if (lastMessage.tool_calls?.length) {
    console.log('→ routing to: tools');
    return 'tools';
  }
  console.log('→ routing to: end');
  return '__end__';
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools', toolNode)
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent')
  .compile();

const positive_case = await graph.invoke({
  messages: [{ role: 'user', content: 'What time is it right now?' }],
});

const negative_case = await graph.invoke({
  messages: [{ role: 'user', content: 'Explain recursion in two sentences.' }],
});

console.log(positive_case.messages.at(-1)?.content);
console.log(negative_case.messages.at(-1)?.content);