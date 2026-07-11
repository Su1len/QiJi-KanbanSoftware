import React, { useRef, useEffect } from 'react';
import type { ProgressReport as PR } from '../../App';

const ProgressReport: React.FC<{ reports: PR[] }> = ({ reports }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [reports]);

  return (
    <div ref={ref} style={{
      height: 110, overflow: 'auto',
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
      fontSize: 12,
      color: 'var(--color-text-secondary)',
      backgroundColor: 'var(--color-bg-primary)',
      borderRadius: 6, padding: 8,
      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      {reports.length === 0
        ? <span style={{ color: 'var(--color-text-muted)' }}>暂无进展记录</span>
        : reports.map(r => <div key={r.id}>{r.report_text}</div>)}
    </div>
  );
};

export default ProgressReport;
