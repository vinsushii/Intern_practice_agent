import 'dotenv/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { StateGraph, Annotation } from '@langchain/langgraph';

// Fake source pool — pretend this came from scraping. Some deliberately low-quality.
const FAKE_SOURCE_POOL = [
  { url: 'reuters.com/tesla-earnings', text: 'Tesla reported Q2 earnings beating analyst estimates on margin improvement.' },
  { url: 'randomblog.net/tesla-moon', text: 'Tesla stock is going to the moon, my cousin works there and says so.' },
  { url: 'sec.gov/filings/tsla-10q', text: 'Tesla 10-Q filing shows automotive gross margin of 18.5%, up from 17.2% prior quarter.' },
  { url: 'forum.reddit.com/r/stocks/tesla', text: 'idk man tesla earnings seem fine i guess, elon tweeted something weird again' },
  { url: 'bloomberg.com/tesla-q2-2026', text: 'Tesla guided down full-year delivery estimates citing softer EV demand in China.' },
];

let sourceIndex = 0;

// Custom state: messages aren't enough here, we need to track sources/scores across the loop
const ResearchState = Annotation.Root({
  topic: Annotation<string>(),
  gatheredSources: Annotation<{ url: string; text: string; score?: number }[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  passedSources: Annotation<{ url: string; text: string; score: number }[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  report: Annotation<string>({ reducer: (_, update) => update, default: () => '' }),
});

const geminiModel = new ChatGoogleGenerativeAI({ model: 'gemini-2.5-flash' });
const ollamaModel = new ChatOllama({ model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434' });

// Node 1: gather sources (faked — just pulls next batch from the pool)
async function gatherSources(state: typeof ResearchState.State) {
  console.log('-> gather_sources');
  const batch = FAKE_SOURCE_POOL.slice(sourceIndex, sourceIndex + 2);
  sourceIndex += 2;
  console.log(`   pulled ${batch.length} sources (pool position ${sourceIndex})`);
  return { gatheredSources: batch };
}

// Node 2: evaluate credibility using Gemini/Ollama, score 0-100
async function evaluateCredibility(state: typeof ResearchState.State) {
  console.log('-> evaluate_credibility');
  const alreadyScoredUrls = new Set(state.passedSources.map(s => s.url).concat(
    state.gatheredSources.filter(s => s.score !== undefined).map(s => s.url)
  ));
  const unscored = state.gatheredSources.filter(s => !alreadyScoredUrls.has(s.url) && s.score === undefined);

  const scored = [];
  for (const source of unscored) {
    const prompt = `Rate the credibility of this source from 0-100 based on its URL and content. Respond with ONLY a number, nothing else.\nURL: ${source.url}\nContent: ${source.text}`;
    const response = await ollamaModel.invoke(prompt);
    const score = parseInt((response.content as string).match(/\d+/)?.[0] ?? '0');
    console.log(`   ${source.url} -> score: ${score}`);
    scored.push({ ...source, score });
  }

  const passed = scored.filter(s => s.score >= 75);
  return {
    gatheredSources: scored,
    passedSources: passed,
  };
}

// Conditional: do we have enough good sources, or do we need to gather more?
function checkEnoughSources(state: typeof ResearchState.State) {
  console.log(`   passed so far: ${state.passedSources.length}, pool exhausted: ${sourceIndex >= FAKE_SOURCE_POOL.length}`);
  if (state.passedSources.length >= 2) {
    return 'extract_facts';
  }
  if (sourceIndex >= FAKE_SOURCE_POOL.length) {
    console.log('   pool exhausted, proceeding with what we have');
    return 'extract_facts';
  }
  return 'gather_sources';
}

// Node 3: extract facts from passed sources using Ollama
async function extractFacts(state: typeof ResearchState.State) {
  console.log('-> extract_facts (Ollama)');
  const combinedText = state.passedSources.map(s => `Source (${s.url}): ${s.text}`).join('\n');
  const prompt = `Extract the key factual points from these sources as a short bulleted list:\n${combinedText}`;
  const response = await ollamaModel.invoke(prompt);
  return { report: response.content as string };
}

// Node 4: generate final report using Ollama
async function generateReport(state: typeof ResearchState.State) {
  console.log('-> generate_report (Ollama)');
  const prompt = `Write a short, 3-sentence summary report on "${state.topic}" based on these extracted facts:\n${state.report}`;
  const response = await ollamaModel.invoke(prompt);
  return { report: response.content as string };
}

const graph = new StateGraph(ResearchState)
  .addNode('gather_sources', gatherSources)
  .addNode('evaluate_credibility', evaluateCredibility)
  .addNode('extract_facts', extractFacts)
  .addNode('generate_report', generateReport)
  .addEdge('__start__', 'gather_sources')
  .addEdge('gather_sources', 'evaluate_credibility')
  .addConditionalEdges('evaluate_credibility', checkEnoughSources)
  .addEdge('extract_facts', 'generate_report')
  .addEdge('generate_report', '__end__')
  .compile();

const result = await graph.invoke({ topic: "Tesla's earnings call" });
console.log('\n=== FINAL REPORT ===');
console.log(result.report);
console.log('\n=== SOURCES USED ===');
console.log(result.passedSources.map(s => `${s.url} (score: ${s.score})`).join('\n'));