// Shared OpenAI chat-completions client (JSON mode) for aiGameMaster + taskGenerator.
import { GAME_CONFIG } from '../config/gameConfig';
import { tlog } from '../utils/terminalLog';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const HINTS: Record<number, string> = {
  401: 'VITE_OPENAI_API_KEY in .env is invalid or revoked — fix it and RESTART the dev server.',
  429: 'Rate limited or out of quota — check billing at platform.openai.com.',
  404: `Model "${GAME_CONFIG.ai.model}" may not be available to this account.`,
};

const fail = (detail: string, status?: number): never => {
  const hint = status && HINTS[status];
  throw new Error(hint ? `${detail}\n   → ${hint}` : detail);
};

/** Throws on any failure, with an actionable message. Caller logs it. */
export async function chatJSON(apiKey: string, messages: ChatMessage[], temperature: number): Promise<ChatResult> {
  const { model, maxCompletionTokens } = GAME_CONFIG.ai;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_completion_tokens: maxCompletionTokens, // max_tokens is deprecated
      response_format: { type: 'json_object' },
    }),
  }).catch(e => fail(`network/CORS failure: ${errMsg(e)}`));

  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    fail(`non-JSON body (HTTP ${res.status}): ${raw.slice(0, 300)}`);
  }

  if (!res.ok) {
    const e = data?.error ?? {};
    fail(`HTTP ${res.status}${e.code ? ` [${e.code}]` : ''}: ${e.message ?? raw.slice(0, 300)}`, res.status);
  }

  const choice = data.choices?.[0];
  if (choice?.message?.refusal) fail(`model refused: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') {
    tlog.warn('⚠️ Response truncated — raise GAME_CONFIG.ai.maxCompletionTokens or shorten the prompt.');
  }
  const content = choice?.message?.content;
  if (!content) fail(`empty content (finish_reason=${choice?.finish_reason})`);

  tlog.debug(`✅ ${model} finish=${choice.finish_reason} tokens=${data.usage?.total_tokens ?? '?'}`);
  return { content, usage: data.usage };
}

/** Extracts the outermost {...} so fences or stray prose can't break parsing. */
export function parseJSON<T>(reply: string): T | null {
  try {
    // JSON forbids unary + on numbers, which models emit occasionally
    const body = reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
    return JSON.parse(body.replace(/:\s*\+(\d)/g, ': $1')) as T;
  } catch (e) {
    tlog.error(`❌ Bad JSON from model: ${errMsg(e)}\n   ${reply.slice(0, 400)}`);
    return null;
  }
}
