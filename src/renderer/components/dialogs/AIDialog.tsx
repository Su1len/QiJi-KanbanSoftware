import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, Button, Form, message, Card, Tag, Space } from 'antd';
import { RobotOutlined, CheckCircleOutlined, PlusOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { api } from '../../utils/api-client';
import TaskFormDialog from './TaskFormDialog';
import { useMode } from '../../context/ModeContext';
import { useLang } from '../../context/LanguageContext';

const { TextArea } = Input;

const AIDialog: React.FC<{
  onClose: () => void;
  onResult: (data: any) => void;
  existingTasks: any[];
  selectedDate: string;
  onOpenSettings?: () => void;
}> = ({ onClose, onResult, existingTasks, selectedDate, onOpenSettings }) => {
  const { mode } = useMode();
  const { t, tf, lang } = useLang();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [taskIndex, setTaskIndex] = useState(0); // for sequential creation
  const [creating, setCreating] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; unlocked: boolean } | null>(null);

  // 打开时查询密钥状态，用于顶部状态提示
  useEffect(() => {
    api.getCryptoStatus().then(setKeyStatus).catch(() => {});
  }, []);

  // AI 解析结果的表单初始值：稳定引用（避免 TaskFormDialog 的初始化 effect 被重复触发覆盖用户编辑）
  const initialData = useMemo(() => {
    if (!creating || !tasks || !tasks[taskIndex]) return null;
    const task = tasks[taskIndex];
    return {
      name: task.name, content: task.content || '',
      purpose: task.purpose || '', resources: task.resources || '',
      duration: task.duration || '', effect: task.effect || '',
      hints: task.hints || '', approach: task.approach || '',
      relevants: task.relevants || '', priority: task.priority || 0,
      status: task.status || '进行中',
      project_name: task.project_name || '',
      sub_tasks: task.sub_tasks || [],
    };
  }, [creating, tasks, taskIndex]);

  const doParse = async (text: string, history?: any[]) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await api.aiParse(text, history);
      if (result.tasks && result.tasks.length > 0) {
        setTasks(result.tasks);
      } else {
        message.warning(t('ai.noResult'));
      }
    } catch (e: any) {
      message.error(e.message || (t('ai.parseFail')));
    }
    setLoading(false);
  };

  const handleSend = () => doParse(input);

  const handleFollowUp = async () => {
    if (!followUpInput.trim()) return;
    const newHistory = [
      ...chatHistory,
      { role: 'user', content: input },
      { role: 'assistant', content: JSON.stringify(tasks) },
    ];
    setChatHistory(newHistory);
    setInput(followUpInput);
    setFollowUpInput('');
    await doParse(followUpInput, newHistory);
  };

  const startCreate = () => {
    if (!tasks || tasks.length === 0) return;
    setCreating(true);
    setTaskIndex(0);
  };

  const handleTaskCreated = () => {
    const next = taskIndex + 1;
    if (tasks && next < tasks.length) {
      setTaskIndex(next);
    } else {
      message.success(tf('ai.created', { n: tasks?.length || 0 }));
      // 通知父组件刷新看板，让新任务即时显示，无需切换日期
      onResult({});
      onClose();
    }
  };

  // If in creation mode, show sequential TaskFormDialogs
  if (creating && tasks && taskIndex < tasks.length && initialData) {
    return (
      <TaskFormDialog
        mode={mode}
        task={null}
        selectedDate={selectedDate}
        initialData={initialData}
        onSubmit={async (data) => {
          try {
            await api.createMainTask({ ...data, task_date: selectedDate });
            handleTaskCreated();
          } catch (e: any) { message.error(e.message); }
        }}
        onCancel={() => { setCreating(false); setTasks(null); }}
        titleExtra={tf('ai.progress', { i: taskIndex + 1, n: tasks.length })}
      />
    );
  }

  return (
    <Modal
      title={<span><RobotOutlined /> {t('ai.title')}</span>}
      open
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {!tasks ? (
        <div>
          <div style={{ marginBottom: 8, fontSize: 13, lineHeight: '20px' }}>
            {keyStatus && keyStatus.hasKey && keyStatus.unlocked ? (
              <span style={{ color: 'var(--color-success)' }}>
                <UnlockOutlined /> {t('ai.unlocked')}
              </span>
            ) : (
              <span style={{ color: 'var(--color-warning)' }}>
                <LockOutlined /> {t('ai.locked1')}
                {onOpenSettings ? (
                  <a
                    onClick={() => { onClose(); onOpenSettings(); }}
                    style={{ margin: '0 2px', color: 'var(--color-accent)' }}
                  >
                    {t('ai.locked2')}
                  </a>
                ) : (
                  <span style={{ margin: '0 2px' }}>{t('ai.locked2')}</span>
                )}
                {t('ai.locked3')}
              </span>
            )}
          </div>
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('ai.placeholder')}
            rows={6}
            style={{ marginBottom: 12 }}
          />
          <Button type="primary" loading={loading} onClick={handleSend} icon={<RobotOutlined />}>
            {t('ai.send')}
          </Button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>
            {tf('ai.parsed', { n: tasks.length })}
          </div>
          {tasks.map((task, i) => (
            <Card key={i} size="small" style={{ marginBottom: 8 }}
              title={<span style={{ fontWeight: 600 }}>{task.name}</span>}
            >
              <Space wrap size={4}>
                {task.purpose && <Tag color="blue">{t('field.purpose')}: {task.purpose}</Tag>}
                {task.project_name && <Tag color="geekblue">{t('form.project')}: {task.project_name}</Tag>}
                {task.priority > 0 && <Tag color="orange">{t('field.priority')}: {task.priority}</Tag>}
                {task.duration && <Tag>{t('field.duration')}: {task.duration}{lang === 'en' ? ' days' : '天'}</Tag>}
                {task.relevants && <Tag color="purple">{task.relevants}</Tag>}
                {task.hints && <Tag color="cyan">{task.hints}</Tag>}
                {task.sub_tasks?.length > 0 && <Tag color="green">{tf('ai.subCount', { n: task.sub_tasks.length })}</Tag>}
              </Space>
              {task.content && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{task.content}</div>}
            </Card>
          ))}
          {/* Follow-up section */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              {t('ai.followUp')}
            </div>
            {chatHistory.length > 0 && (
              <div style={{ marginBottom: 8, maxHeight: 120, overflow: 'auto' }}>
                {chatHistory.filter((m: any) => m.role === 'user').map((m: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-accent)' }}>💬 </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{m.content?.slice(0, 80)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Input size="small" value={followUpInput} onChange={e => setFollowUpInput(e.target.value)}
                placeholder={t('ai.followUpPh')} style={{ flex: 1 }}
                onPressEnter={handleFollowUp} />
              <Button size="small" onClick={handleFollowUp} loading={loading}>{t('ai.followUpBtn')}</Button>
              <Button size="small" onClick={startCreate} type="primary">{t('ai.skip')}</Button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Button onClick={() => { setTasks(null); setChatHistory([]); }}>{t('ai.reinput')}</Button>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>
              {tf('ai.createAll', { n: tasks.length })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AIDialog;
