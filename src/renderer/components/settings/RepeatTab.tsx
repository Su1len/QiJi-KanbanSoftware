import React, { useState, useEffect } from 'react';
import { List, Button, Tag, message, Popconfirm } from 'antd';
import { api } from '../../utils/api-client';
import { useLang } from '../../context/LanguageContext';
import type { MainTask } from '../../App';

const RepeatTab: React.FC<{ onOpenTask: (task: MainTask) => void }> = ({ onOpenTask }) => {
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.getRepeatTasks()); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const freqLabel = (f: string) =>
    f === 'weekly' ? t('repeat.weekly') : f === 'monthly' ? t('repeat.monthly') : f;

  const handleOpen = async (id: number) => {
    try {
      const task = await api.getCurrentRepeatInstance(id);
      if (task) onOpenTask(task);
    } catch (e: any) { message.error(e.message || '打开失败'); }
  };

  const handleStop = async (id: number) => {
    try {
      await api.stopRepeat(id);
      message.success(t('repeat.stopped'));
      load();
    } catch (e: any) { message.error(e.message || '操作失败'); }
  };

  return (
    <div>
      {items.length === 0 && !loading ? (
        <div style={{ color: 'var(--color-text-muted)', padding: '16px 0', fontSize: 13 }}>
          {t('repeat.empty')}
        </div>
      ) : (
        <List
          size="small"
          loading={loading}
          dataSource={items}
          renderItem={(it) => (
            <List.Item
              style={{ cursor: 'pointer' }}
              onClick={() => handleOpen(it.id)}
              actions={[
                <Popconfirm
                  key="stop"
                  title={t('repeat.stopConfirm')}
                  onConfirm={() => handleStop(it.id)}
                  onPopupClick={(e) => e.stopPropagation()}
                >
                  <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                    {t('repeat.stop')}
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={<span style={{ fontSize: 13 }}>{it.name}</span>}
                description={
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <Tag style={{ marginRight: 6 }}>{freqLabel(it.repeat_frequency)}</Tag>
                    {t('repeat.baseDate')}: {it.repeat_base_date}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default RepeatTab;
