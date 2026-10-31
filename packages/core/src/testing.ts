// Word lists for tests that scan copy, shared so every scan applies the same rules.

/**
 * Verdicts (hard rule 2): copy reports margins under assumptions instead. A bolt that passes
 * through wood, or passes without being driven, is described, not judged.
 */
export const VERDICT_WORDS =
  /\b(safe|safely|unsafe|fail|fails|failed|(pass|passes|passed)(?!\s+(all the way\s+through|through|without)\b))\b/i;

/**
 * Tool, hardware, and store brands (hard rule 11), including trademarks often used as generic
 * names. Words that are also ordinary English, such as "craftsman", are left out.
 */
export const BRAND_NAMES =
  /\b(dewalt|makita|milwaukee|ryobi|bosch|festool|skil|ridgid|porter-?cable|black (&|and) decker|metabo|hitachi|kreg|simpson|strong-?tie|speed square|sawzall|shop-?vac|dremel|irwin|rockler|titebond|quikrete|sakrete|spax|grk|fastenmaster|home depot|lowe'?s|menards)\b/i;

/**
 * Text that matches the brand list but names no product, removed before scanning. Each says
 * why it is allowed.
 */
export const BRAND_EXCEPTIONS: readonly { text: string; why: string }[] = [
  {
    text: 'William T. Simpson',
    why: 'the author of a cited Forest Products Laboratory report',
  },
];

/** The text with every named exception removed, ready to scan for brands. */
export function withoutBrandExceptions(text: string): string {
  return BRAND_EXCEPTIONS.reduce((t, e) => t.split(e.text).join(''), text);
}
