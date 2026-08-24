export interface SubTaskNode {
  id?: number;
  name: string;
  nextIndex?: number | null;
}

export function buildChainGraph(subTasks: SubTaskNode[], lang: 'zh' | 'en' = 'zh'): string {
  if (!subTasks || subTasks.length === 0) return '';
  const isoLabel = lang === 'en' ? ' (independent)' : '（独立子任务）';

  const indexed = subTasks.map((s, i) => ({ ...s, _idx: i }));
  // Find which indices are pointed to
  const pointedTo = new Set<number>();
  indexed.forEach(s => {
    if (s.nextIndex != null) pointedTo.add(s.nextIndex);
  });

  // Find start nodes (not pointed to, have nextIndex)
  const starts = indexed.filter(s => s.nextIndex != null && !pointedTo.has(s._idx));
  // Find isolated nodes (neither pointed to nor have nextIndex)
  const isolated = indexed.filter(s => s.nextIndex == null && !pointedTo.has(s._idx));

  const visited = new Set<number>();
  const lines: string[] = [];

  // Follow chains from each start node
  for (const start of starts) {
    if (visited.has(start._idx)) continue;
    const chain: string[] = [];
    let cursor: number | null = start._idx;
    while (cursor !== null) {
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const node = indexed.find(s => s._idx === cursor);
      if (!node) break;
      chain.push(node.name || `(${cursor})`);
      cursor = node.nextIndex ?? null;
    }
    if (chain.length > 0) lines.push(chain.join(' ──→ '));
  }

  // Add isolated nodes
  for (const iso of isolated) {
    if (!visited.has(iso._idx)) {
      lines.push(`${iso.name}${isoLabel}`);
      visited.add(iso._idx);
    }
  }

  return lines.join('\n');
}
