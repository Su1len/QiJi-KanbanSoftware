/**
 * THEMRPR field definitions for display purposes.
 */
import { tr, type Lang } from '../i18n';

export const THEMRPR_FIELDS = [
  { key: 'purpose', labelKey: 'field.purpose' },
  { key: 'resources', labelKey: 'field.resources' },
  { key: 'duration', labelKey: 'field.duration' },
  { key: 'effect', labelKey: 'field.effect' },
  { key: 'hints', labelKey: 'field.hints' },
  { key: 'approach', labelKey: 'field.approach' },
  { key: 'relevants', labelKey: 'field.relevants' },
  { key: 'priority', labelKey: 'field.priority' },
] as const;

export type ThemrprFieldKey = typeof THEMRPR_FIELDS[number]['key'];

export interface ThemrprData {
  purpose: string | null;
  resources: string | null;
  duration: string | null;
  effect: string | null;
  hints: string | null;
  approach: string | null;
  relevants: string | null;
  priority: number | null;
}

/**
 * Compare a sub-task's THEMRPR fields to its parent main task.
 * Returns:
 *   - "identical" if all fields match (or are null = inherit)
 *   - The differing fields as a ThemrprData
 */
export function compareThemrpr(
  main: ThemrprData,
  sub: ThemrprData
): 'identical' | ThemrprData {
  const diffs: ThemrprData = {
    purpose: null,
    resources: null,
    duration: null,
    effect: null,
    hints: null,
    approach: null,
    relevants: null,
    priority: null,
  };

  let hasDiff = false;

  for (const field of THEMRPR_FIELDS) {
    const key = field.key;
    const mainVal = main[key];
    const subVal = sub[key];

    // null in sub means "inherit from main"
    if (subVal === null || subVal === '' || subVal === undefined) {
      continue;
    }

    // If sub has a value different from main, it's a diff
    if (String(subVal) !== String(mainVal ?? '')) {
      (diffs as any)[key] = subVal;
      hasDiff = true;
    }
  }

  return hasDiff ? diffs : 'identical';
}

/**
 * Format a ThemrprData object for display in a cell.
 */
export function formatThemrprCell(data: ThemrprData, lang: Lang = 'zh'): string {
  const parts: string[] = [];
  for (const field of THEMRPR_FIELDS) {
    const val = data[field.key];
    if (val !== null && val !== undefined && val !== '') {
      parts.push(`${tr(field.labelKey, lang)}:${val}`);
    }
  }
  return parts.join('; ') || '';
}

/**
 * Format the full THEMRPR data for Tooltip display.
 */
export function formatThemrprTooltip(data: ThemrprData, lang: Lang = 'zh'): string {
  const lines: string[] = [];
  for (const field of THEMRPR_FIELDS) {
    const val = data[field.key];
    const label = tr(field.labelKey, lang);
    lines.push(`${label}：${val || (lang === 'en' ? '(Not set)' : '（未设置）')}`);
  }
  return lines.join('\n');
}
