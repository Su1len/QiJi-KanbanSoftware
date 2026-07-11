/**
 * THEMRPR field definitions for display purposes.
 */
export const THEMRPR_FIELDS = [
  { key: 'purpose', label: '目标' },
  { key: 'resources', label: '资源' },
  { key: 'duration', label: '工期' },
  { key: 'effect', label: '预期效果' },
  { key: 'hints', label: '注意要点' },
  { key: 'approach', label: '实现路径' },
  { key: 'relevants', label: '相关方及接洽人' },
  { key: 'priority', label: '优先级' },
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
export function formatThemrprCell(data: ThemrprData): string {
  const parts: string[] = [];
  for (const field of THEMRPR_FIELDS) {
    const val = data[field.key];
    if (val !== null && val !== undefined && val !== '') {
      parts.push(`${field.label}:${val}`);
    }
  }
  return parts.join('; ') || '';
}

/**
 * Format the full THEMRPR data for Tooltip display.
 */
export function formatThemrprTooltip(data: ThemrprData): string {
  const lines: string[] = [];
  for (const field of THEMRPR_FIELDS) {
    const val = data[field.key];
    lines.push(`${field.label}：${val || '（未设置）'}`);
  }
  return lines.join('\n');
}
