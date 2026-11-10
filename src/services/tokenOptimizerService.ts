/**
 * Token Optimizer & OOC Detection Service
 * Prevents token bloat, calculates exact costs, and processes OOC mode.
 */

export function isOocMessage(text?: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (/^(?:\[{1,2}|\({1,2}|\{)\s*ooc\b/i.test(trimmed)) return true;
  if (/^ooc\s*[:\-\]]/i.test(trimmed)) return true;
  if (/^\[ooc\]/i.test(trimmed)) return true;
  if (/^\[\s*ooc[\s\S]*\]$/i.test(trimmed)) return true;
  if (/(?:^|\n)\s*\[\s*ooc\s*\]/i.test(trimmed)) return true;
  return false;
}

export function cleanOocContent(text?: string): string {
  if (!text) return '';
  return text
    .replace(/^(?:\[{1,2}|\({1,2}|\{)?\s*ooc(?:\s*[:\-\]]|\s*\])?/i, '')
    .replace(/\]\s*$/, '')
    .replace(/^\[ooc\]/i, '')
    .trim();
}

/**
 * Fast BPE token approximation (~3.8 chars per token for English RP)
 */
export function estimateTokens(text?: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Calculates approximate cost in USD & IDR (based on Gemini Flash / DeepSeek V3 rates)
 * ~ $0.15 per 1M tokens ($0.00000015 per token)
 * 1 USD = 16,300 IDR
 */
export function calculateCost(tokens: number, currency: 'USD' | 'IDR' = 'IDR'): string {
  const ratePerTokenUsd = 0.00000015;
  const usdCost = tokens * ratePerTokenUsd;

  if (currency === 'USD') {
    if (usdCost < 0.0001) return '< $0.0001';
    return `$${usdCost.toFixed(4)}`;
  } else {
    const idrCost = usdCost * 16300;
    if (idrCost < 0.5) return '< Rp 1';
    return `Rp ${Math.round(idrCost).toLocaleString('id-ID')}`;
  }
}

