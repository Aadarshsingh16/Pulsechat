export interface TextModerationResult {
  isSafe: boolean;
  flagged: boolean;
  cleanText: string;
  reason?: string;
}

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '€': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
};

const BLOCKED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
  'pussy',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'slut',
  'whore',
  'kys',
];

const charPatterns: Record<string, string> = {
  a: '[a@4]',
  b: '[b8]',
  c: '[c(]',
  d: '[d]',
  e: '[e3€]',
  f: '[f]',
  g: '[g9]',
  h: '[h]',
  i: '[i1!|]',
  j: '[j]',
  k: '[k]',
  l: '[l1|]',
  m: '[m]',
  n: '[n]',
  o: '[o0]',
  p: '[p]',
  q: '[q]',
  r: '[r]',
  s: '[s$5]',
  t: '[t7+]',
  u: '[u]',
  v: '[v]',
  w: '[w]',
  x: '[x]',
  y: '[y]',
  z: '[z2]',
};

export function buildFuzzyWordRegex(word: string): RegExp {
  const sep = '[\\s\\W_]*';
  const parts = word.split('').map((char) => {
    const p = charPatterns[char.toLowerCase()] || char;
    return `${p}+`;
  });
  return new RegExp(parts.join(sep), 'gi');
}

export function normalizeText(input: string): string {
  if (!input) return '';
  let normalized = input.normalize('NFKD').toLowerCase();
  for (const [char, repl] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(char).join(repl);
  }
  return normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function moderateText(input: string): TextModerationResult {
  if (!input || typeof input !== 'string') {
    return { isSafe: true, flagged: false, cleanText: '' };
  }

  let cleanText = input;
  let flagged = false;
  const flaggedWords: string[] = [];

  for (const word of BLOCKED_WORDS) {
    const regex = buildFuzzyWordRegex(word);
    if (regex.test(cleanText)) {
      flagged = true;
      flaggedWords.push(word);
      // Reset lastIndex for subsequent operations
      regex.lastIndex = 0;
      cleanText = cleanText.replace(regex, '****');
    }
  }

  if (flagged) {
    return {
      isSafe: false,
      flagged: true,
      cleanText,
      reason: `Contains prohibited language: ${flaggedWords.join(', ')}`,
    };
  }

  return {
    isSafe: true,
    flagged: false,
    cleanText: input,
  };
}
