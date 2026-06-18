import 'dotenv/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
});

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addEdge('__start__', 'agent')
  .addEdge('agent', '__end__')
  .compile();

const result = await graph.invoke({
  messages: [{ role: 'user', content: 'Explain what Valorant is in two sentences.' }],
});

console.log(result.messages.at(-1)?.content);