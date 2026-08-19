import React, { useState } from 'react';
import { Button, Collapse, Spin } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';

const VERSION = 'V1.0.1';

const AboutTab: React.FC = () => {
  const [changelog, setChangelog] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadChangelog = async () => {
    if (changelog) { setExpanded(!expanded); return; }
    setLoading(true);
    try {
      const resp = await fetch('/themes/changelog.json');
      const data = await resp.json();
      setChangelog(data);
      setExpanded(true);
    } catch {
      setChangelog([]);
    }
    setLoading(false);
  };

  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--color-text-primary)' }}>
        骐骥看板
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
        版本 {VERSION}
      </div>
      <div style={{ fontSize: 14, color: 'var(--color-text-primary)', margin: '12px 0' }}>
        骐骥看板 —— 一款简洁高效的桌面任务管理工具
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        开发者：桑尼之子 昭深
      </div>

      <div style={{
        background: 'var(--color-bg-hover)', borderRadius: 8, padding: '16px 20px',
        maxWidth: 480, margin: '0 auto 20px', fontStyle: 'italic', lineHeight: 1.8,
        color: 'var(--color-text-secondary)', fontSize: 14,
        borderLeft: '3px solid var(--color-accent)',
      }}>
        "教育是微光吸引微光、微光照亮微光、微光点燃微光、彼此温暖，彼此成全，同向同行，一起发光的过程。"
        <div style={{ marginTop: 8, fontStyle: 'normal', fontWeight: 500 }}>—— 孙海鸥老师</div>
      </div>

      <Button icon={<HistoryOutlined />} onClick={loadChangelog} loading={loading}>
        {expanded ? '收起更新日志' : '查看更新日志'}
      </Button>

      {loading && <div style={{ marginTop: 12 }}><Spin size="small" /></div>}

      {changelog && expanded && (
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          {changelog.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', fontSize: 13 }}>
              暂无更新记录
            </div>
          ) : (
            <Collapse
              size="small"
              items={changelog.map((entry: any, i: number) => ({
                key: String(i),
                label: <span style={{ fontWeight: 600 }}>v{entry.version} — {entry.date}</span>,
                children: (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {(entry.changes || []).map((c: string, j: number) => (
                      <li key={j} style={{ marginBottom: 4, fontSize: 13 }}>{c}</li>
                    ))}
                  </ul>
                ),
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AboutTab;
