/**
 * OpenAI-compatible SSE stream reader with lifecycle timing instrumentation,
 * explicit non-streaming fallback detection, and immediate AbortSignal reader cancellation.
 */

export type StreamMode = 'sse-incremental' | 'sse-single-burst' | 'non-stream-fallback' | 'aborted';

export interface StreamMetrics {
  model?: string;
  endpoint?: string;
  contentType: string;
  requestStartedAt: number;
  firstByteAt?: number;
  firstDeltaAt?: number;
  deltaTimestamps: number[];
  deltaCount: number;
  providerFinishAt?: number;
  finalCommittedAt?: number;
  streamMode: StreamMode;
  aborted: boolean;
  finishReason?: string;
}

export interface ReadOpenAiStreamOptions {
  requestStartedAt?: number;
  model?: string;
  endpoint?: string;
  onDelta: (chunk: string) => void;
  onMetrics?: (metrics: StreamMetrics) => void;
}

export interface ReadOpenAiStreamResult {
  fullText: string;
  metrics: StreamMetrics;
}

function extractDeltaContent(json: any): string {
  const choice = json?.choices?.[0];
  const delta = choice?.delta;
  if (typeof delta?.content === 'string') return delta.content;
  if (Array.isArray(delta?.content)) {
    return delta.content
      .map((part: any) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .join('');
  }
  if (typeof choice?.text === 'string') return choice.text;
  return '';
}

function parseBufferedResponseText(raw: string): { text: string; sawSseLines: boolean; finishReason?: string } {
  let fullText = '';
  let sawSseLines = false;
  let finishReason: string | undefined;
  try {
    const json = JSON.parse(raw);
    fullText = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
    finishReason = json.choices?.[0]?.finish_reason ? String(json.choices[0].finish_reason) : undefined;
    return { text: fullText, sawSseLines: false, finishReason };
  } catch {
    raw.split('\n').forEach(line => {
      const l = line.trim();
      if (!l.startsWith('data:')) return;
      sawSseLines = true;
      const data = l.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const j = JSON.parse(data);
        fullText += extractDeltaContent(j);
        if (j?.choices?.[0]?.finish_reason) {
          finishReason = String(j.choices[0].finish_reason);
        }
      } catch {}
    });
    return { text: fullText, sawSseLines, finishReason };
  }
}

export async function readOpenAiStream(
  res: Pick<Response, 'body' | 'headers' | 'text'>,
  signal: AbortSignal,
  options: ReadOpenAiStreamOptions
): Promise<ReadOpenAiStreamResult> {
  const requestStartedAt = options.requestStartedAt ?? Date.now();
  const contentType = res.headers?.get?.('content-type') || '';
  const body: any = res.body;
  const isJsonContentType =
    /\bapplication\/json\b/i.test(contentType) && !/text\/event-stream/i.test(contentType);

  let fullText = '';
  let firstByteAt: number | undefined;
  let firstDeltaAt: number | undefined;
  let providerFinishAt: number | undefined;
  let finishReason: string | undefined;
  const deltaTimestamps: number[] = [];

  if (!body || typeof body.getReader !== 'function' || isJsonContentType) {
    const raw = await res.text();
    firstByteAt = Date.now();
    if (!signal.aborted) {
      const parsed = parseBufferedResponseText(raw);
      fullText = parsed.text;
      finishReason = parsed.finishReason;
      if (fullText) {
        const now = Date.now();
        firstDeltaAt = now;
        deltaTimestamps.push(now);
        options.onDelta(fullText);
      }
    }
    providerFinishAt = Date.now();
    const metrics: StreamMetrics = {
      model: options.model,
      endpoint: options.endpoint,
      contentType,
      requestStartedAt,
      firstByteAt,
      firstDeltaAt,
      deltaTimestamps,
      deltaCount: deltaTimestamps.length,
      providerFinishAt,
      streamMode: signal.aborted ? 'aborted' : 'non-stream-fallback',
      aborted: signal.aborted,
      finishReason,
    };
    options.onMetrics?.(metrics);
    return { fullText, metrics };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inReasoning = false;

  const onAbort = () => {
    try {
      reader.cancel();
    } catch {}
  };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) {
    onAbort();
  }

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data) return;
    if (data === '[DONE]') {
      providerFinishAt = providerFinishAt ?? Date.now();
      return;
    }
    try {
      const json = JSON.parse(data);
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      const delta = json.choices?.[0]?.delta || {};
      const reasoning = delta.reasoning_content || delta.reasoning || '';
      const content = extractDeltaContent(json);
      let chunk = '';
      if (reasoning) {
        chunk = (inReasoning ? '' : '<think>') + reasoning;
        inReasoning = true;
      }
      if (content) {
        chunk += (inReasoning ? '</think>' : '') + content;
        inReasoning = false;
      }
      if (chunk) {
        const now = Date.now();
        if (firstDeltaAt === undefined) firstDeltaAt = now;
        deltaTimestamps.push(now);
        fullText += chunk;
        options.onDelta(chunk);
      }
      if (json.choices?.[0]?.finish_reason) {
        finishReason = String(json.choices[0].finish_reason);
        providerFinishAt = providerFinishAt ?? Date.now();
      }
    } catch (e: any) {
      if (e?.message && !/JSON/i.test(e.message)) throw e;
    }
  };

  try {
    while (true) {
      if (signal.aborted) {
        onAbort();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (firstByteAt === undefined && value && value.length > 0) {
        firstByteAt = Date.now();
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        if (signal.aborted) break;
        processLine(rawLine);
      }
    }

    if (!signal.aborted) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const rawLine of buffer.split('\n')) {
          processLine(rawLine);
        }
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
  }

  if (inReasoning) fullText += '</think>';
  providerFinishAt = providerFinishAt ?? Date.now();

  const streamMode: StreamMode = signal.aborted
    ? 'aborted'
    : deltaTimestamps.length <= 1
    ? 'sse-single-burst'
    : 'sse-incremental';

  const metrics: StreamMetrics = {
    model: options.model,
    endpoint: options.endpoint,
    contentType,
    requestStartedAt,
    firstByteAt,
    firstDeltaAt,
    deltaTimestamps,
    deltaCount: deltaTimestamps.length,
    providerFinishAt,
    streamMode,
    aborted: signal.aborted,
    finishReason,
  };
  options.onMetrics?.(metrics);
  return { fullText, metrics };
}
