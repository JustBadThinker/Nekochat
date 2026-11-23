import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpenAiStream } from '../src/services/openAiStream.ts';
import { buildOpenAiChatPayload, buildTurns, resolveContextBudget } from '../src/services/promptBudget.ts';

function encode(str) {
  return new TextEncoder().encode(str);
}

test('buildOpenAiChatPayload sets stream: true for GLM, DeepSeek, and Mistral Nemo', () => {
  for (const model of ['z-ai/glm-4.5', 'deepseek/deepseek-chat', 'mistralai/mistral-nemo']) {
    const payload = buildOpenAiChatPayload({
      model,
      systemInstruction: 'You are a test character.',
      turns: [{ role: 'user', content: 'Hello' }],
      config: { temperature: 0.8, topP: 0.9 },
      maxOutputTokens: 512,
      stream: true,
    });
    assert.equal(payload.model, model);
    assert.equal(payload.stream, true);
  }
});

test('readOpenAiStream emits incremental SSE deltas immediately with lifecycle timestamps', async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
  ];

  let idx = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (idx < chunks.length) {
        const next = chunks[idx++];
        await new Promise(r => setTimeout(r, 15));
        controller.enqueue(encode(next));
      } else {
        controller.close();
      }
    },
  });

  const res = new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

  const emitted = [];
  const controller = new AbortController();
  const requestStartedAt = Date.now();
  const result = await readOpenAiStream(res, controller.signal, {
    requestStartedAt,
    model: 'mistralai/mistral-nemo',
    onDelta: chunk => emitted.push({ chunk, at: Date.now() }),
  });

  assert.equal(result.fullText, 'Hello world!');
  assert.deepEqual(
    emitted.map(e => e.chunk),
    ['Hello ', 'world', '!']
  );
  assert.equal(result.metrics.streamMode, 'sse-incremental');
  assert.equal(result.metrics.deltaCount, 3);
  assert.equal(result.metrics.aborted, false);
  assert.ok(result.metrics.firstByteAt >= requestStartedAt);
  assert.ok(result.metrics.firstDeltaAt >= result.metrics.firstByteAt);
  assert.ok(result.metrics.providerFinishAt >= result.metrics.firstDeltaAt);
  assert.ok(result.metrics.deltaTimestamps[2] > result.metrics.deltaTimestamps[0]);
});

test('readOpenAiStream reports non-stream-fallback when server ignores stream:true and returns JSON', async () => {
  const jsonBody = JSON.stringify({
    choices: [{ message: { content: 'Buffered complete reply.' } }],
  });
  const res = new Response(jsonBody, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const deltas = [];
  const result = await readOpenAiStream(res, new AbortController().signal, {
    model: 'mistralai/mistral-nemo',
    onDelta: chunk => deltas.push(chunk),
  });

  assert.equal(result.fullText, 'Buffered complete reply.');
  assert.deepEqual(deltas, ['Buffered complete reply.']);
  assert.equal(result.metrics.streamMode, 'non-stream-fallback');
  assert.equal(result.metrics.deltaCount, 1);
});

test('readOpenAiStream flushes trailing SSE line without final newline and marks single burst', async () => {
  const res = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encode('data: {"choices":[{"delta":{"content":"Only one chunk"}}]}'));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );

  const deltas = [];
  const result = await readOpenAiStream(res, new AbortController().signal, {
    model: 'mistralai/mistral-nemo',
    onDelta: chunk => deltas.push(chunk),
  });

  assert.equal(result.fullText, 'Only one chunk');
  assert.deepEqual(deltas, ['Only one chunk']);
  assert.equal(result.metrics.streamMode, 'sse-single-burst');
});

test('readOpenAiStream cancels reader immediately when AbortController aborts mid-read', async () => {
  let cancelled = false;
  let readCalls = 0;

  const mockRes = {
    headers: new Headers({ 'Content-Type': 'text/event-stream' }),
    text: async () => '',
    body: {
      getReader() {
        return {
          async read() {
            readCalls += 1;
            if (readCalls === 1) {
              return {
                done: false,
                value: encode('data: {"choices":[{"delta":{"content":"First "}}]}\n\n'),
              };
            }
            // Simulate waiting on network until cancel() is called
            return await new Promise(resolve => {
              const timer = setInterval(() => {
                if (cancelled) {
                  clearInterval(timer);
                  resolve({ done: true, value: undefined });
                }
              }, 5);
            });
          },
          async cancel() {
            cancelled = true;
          },
        };
      },
    },
  };

  const controller = new AbortController();
  const deltas = [];
  const promise = readOpenAiStream(mockRes, controller.signal, {
    model: 'mistralai/mistral-nemo',
    onDelta: chunk => {
      deltas.push(chunk);
      controller.abort();
    },
  });

  const result = await promise;
  assert.equal(cancelled, true);
  assert.equal(result.metrics.aborted, true);
  assert.equal(result.metrics.streamMode, 'aborted');
  assert.deepEqual(deltas, ['First ']);
});

test('buildTurns + buildOpenAiChatPayload preserve system prompt and avoid duplicate assistant turns across 3, 7, 12, 20 messages', () => {
  const systemPrompt = '[USER SYSTEM PROMPT]\nStay concise and avoid repetition.';
  const budget = resolveContextBudget({
    providerType: 'custom',
    baseUrl: 'https://anoman.example/v1',
    model: 'mistralai/mistral-nemo',
  });

  for (const count of [3, 7, 12, 20]) {
    const history = Array.from({ length: count }, (_, idx) => ({
      id: `m-${idx + 1}`,
      role: idx % 2 === 0 ? 'user' : 'assistant',
      content: `Turn ${idx + 1} content from ${idx % 2 === 0 ? 'user' : 'assistant'}.`,
    }));
    const nextUserMsg = `Turn ${count + 1} new user message.`;
    const turns = buildTurns(history, nextUserMsg, {
      contextLimit: budget.contextLimit,
      reservedTokens: 1500,
      charName: 'Hailey',
      userName: 'Rei',
    });

    const payload = buildOpenAiChatPayload({
      model: 'mistralai/mistral-nemo',
      systemInstruction: systemPrompt,
      turns,
      config: { temperature: 0.85, topP: 0.95 },
      maxOutputTokens: budget.maxOutputTokens,
      stream: true,
    });

    assert.equal(payload.messages[0].role, 'system');
    assert.equal(payload.messages[0].content, systemPrompt);
    assert.equal(payload.messages.length, 1 + count + 1);

    const assistantContents = payload.messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content);
    assert.equal(new Set(assistantContents).size, assistantContents.length);
    assert.equal(payload.messages[payload.messages.length - 1].content, nextUserMsg);
  }
});
