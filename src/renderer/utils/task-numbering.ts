/**
 * Convert a number (0-based) to uppercase letter(s).
 * 0 -> A, 1 -> B, 25 -> Z, 26 -> AA, 27 -> AB, etc.
 */
export function numberToLetters(n: number): string {
  let result = '';
  n = Math.floor(n); // ensure integer
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

/**
 * Convert a letter string back to a number (0-based).
 * A -> 0, B -> 1, Z -> 25, AA -> 26, etc.
 */
export function lettersToNumber(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

/**
 * Compare two letter strings numerically.
 */
export function compareLetters(a: string, b: string): number {
  return lettersToNumber(a) - lettersToNumber(b);
}
