import type { BaudotCodeEntry } from '../types';

const TABLE: BaudotCodeEntry[] = [
  { bits: [false, false, false, false, false], lettersChar: null, figuresChar: null },
  { bits: [false, false, false, false, true], lettersChar: 'E', figuresChar: '3' },
  { bits: [false, false, false, true, false], lettersChar: '\n', figuresChar: '\n' },
  { bits: [false, false, false, true, true], lettersChar: 'A', figuresChar: '-' },
  { bits: [false, false, true, false, false], lettersChar: ' ', figuresChar: ' ' },
  { bits: [false, false, true, false, true], lettersChar: 'S', figuresChar: "'" },
  { bits: [false, false, true, true, false], lettersChar: 'I', figuresChar: '8' },
  { bits: [false, false, true, true, true], lettersChar: 'U', figuresChar: '7' },
  { bits: [false, true, false, false, false], lettersChar: '\r', figuresChar: '\r' },
  { bits: [false, true, false, false, true], lettersChar: 'D', figuresChar: 'WRU' },
  { bits: [false, true, false, true, false], lettersChar: 'R', figuresChar: '4' },
  { bits: [false, true, false, true, true], lettersChar: 'J', figuresChar: 'BELL' },
  { bits: [false, true, true, false, false], lettersChar: 'N', figuresChar: ',' },
  { bits: [false, true, true, false, true], lettersChar: 'F', figuresChar: '!' },
  { bits: [false, true, true, true, false], lettersChar: 'C', figuresChar: ':' },
  { bits: [false, true, true, true, true], lettersChar: 'K', figuresChar: '(' },
  { bits: [true, false, false, false, false], lettersChar: 'T', figuresChar: '5' },
  { bits: [true, false, false, false, true], lettersChar: 'Z', figuresChar: '"' },
  { bits: [true, false, false, true, false], lettersChar: 'L', figuresChar: ')' },
  { bits: [true, false, false, true, true], lettersChar: 'W', figuresChar: '2' },
  { bits: [true, false, true, false, false], lettersChar: 'H', figuresChar: '#' },
  { bits: [true, false, true, false, true], lettersChar: 'Y', figuresChar: '6' },
  { bits: [true, false, true, true, false], lettersChar: 'P', figuresChar: '0' },
  { bits: [true, false, true, true, true], lettersChar: 'Q', figuresChar: '1' },
  { bits: [true, true, false, false, false], lettersChar: 'O', figuresChar: '9' },
  { bits: [true, true, false, false, true], lettersChar: 'B', figuresChar: '?' },
  { bits: [true, true, false, true, false], lettersChar: 'G', figuresChar: '&' },
  { bits: [true, true, false, true, true], lettersChar: 'FIGURES', figuresChar: 'FIGURES' },
  { bits: [true, true, true, false, false], lettersChar: 'M', figuresChar: '.' },
  { bits: [true, true, true, false, true], lettersChar: 'X', figuresChar: '/' },
  { bits: [true, true, true, true, false], lettersChar: 'V', figuresChar: ';' },
  { bits: [true, true, true, true, true], lettersChar: 'LETTERS', figuresChar: 'LETTERS' },
];

const LETTERS_SHIFT: [boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, true];
const FIGURES_SHIFT: [boolean, boolean, boolean, boolean, boolean] = [true, true, false, true, true];

const LETTERS_MAP = new Map<string, [boolean, boolean, boolean, boolean, boolean]>();
const FIGURES_MAP = new Map<string, [boolean, boolean, boolean, boolean, boolean]>();
const BITS_TO_LETTERS = new Map<string, string | null>();
const BITS_TO_FIGURES = new Map<string, string | null>();

for (const entry of TABLE) {
  const key = entry.bits.map(b => b ? '1' : '0').join('');
  if (entry.lettersChar && entry.lettersChar.length === 1) {
    LETTERS_MAP.set(entry.lettersChar, entry.bits);
  }
  if (entry.figuresChar && entry.figuresChar.length === 1) {
    FIGURES_MAP.set(entry.figuresChar, entry.bits);
  }
  BITS_TO_LETTERS.set(key, entry.lettersChar);
  BITS_TO_FIGURES.set(key, entry.figuresChar);
}

LETTERS_MAP.set(' ', [false, false, true, false, false]);
FIGURES_MAP.set(' ', [false, false, true, false, false]);
LETTERS_MAP.set('\n', [false, false, false, true, false]);
FIGURES_MAP.set('\n', [false, false, false, true, false]);
LETTERS_MAP.set('\r', [false, true, false, false, false]);
FIGURES_MAP.set('\r', [false, true, false, false, false]);

export function getSupportedChars(): Set<string> {
  const chars = new Set<string>();
  for (const entry of TABLE) {
    if (entry.lettersChar && entry.lettersChar.length === 1) chars.add(entry.lettersChar);
    if (entry.figuresChar && entry.figuresChar.length === 1) chars.add(entry.figuresChar);
  }
  return chars;
}

export function isLetterChar(ch: string): boolean {
  return /^[A-Z]$/.test(ch);
}

export function isFigureChar(ch: string): boolean {
  return FIGURES_MAP.has(ch) && !isLetterChar(ch);
}

export { LETTERS_MAP, FIGURES_MAP, BITS_TO_LETTERS, BITS_TO_FIGURES, LETTERS_SHIFT, FIGURES_SHIFT };
