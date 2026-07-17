import React, { useState } from 'react';
import { Modal, Input, Button, Form, message, Card, Tag, Space } from 'antd';
import { RobotOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../../utils/api-client';
import TaskFormDialog from './TaskFormDialog';
import { useMode } from '../../context/ModeContext';

const { TextArea } = Input;

const AIDialog: React.FC<{
  onClose: () => void;
  onResult: (data: any) => void;
  existingTasks: any[];
  selectedDate: string;
}> = ({ onClose, existingTasks, selectedDate }) => {
  const { mode } = useMode();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [taskIndex, setTaskIndex] = useState(0); // for sequential creation
  const [creating, setCreating] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  const doParse = async (text: string, history?: any[]) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await api.aiParse(text, history);
      if (result.tasks && result.tasks.length > 0) {
        setTasks(result.tasks);
      } else {
        message.warning('未能解析出有效任务，请尝试更详细的描述');
      }
    } catch (e: any) {
      message.error(e.message || 'AI 解析失败，请检查 API 密钥配置');
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
      message.success(`已创建 ${tasks?.length || 0} 个任务`);
      onClose();
    }
  };

  // If in creation mode, show sequential TaskFormDialogs
  if (creating && tasks && taskIndex < tasks.length) {
    const t = tasks[taskIndex];
    return (
      <TaskFormDialog
        mode={mode}
        task={null}
        selectedDate={selectedDate}
        initialData={{
          name: t.name, content: t.content || '',
          purpose: t.purpose || '', resources: t.resources || '',
          duration: t.duration || '', effect: t.effect || '',
          hints: t.hints || '', approach: t.approach || '',
          relevants: t.relevants || '', priority: t.priority || 0,
          status: t.status || '进行中',
          sub_tasks: t.sub_tasks || [],
        }}
        onSubmit={async (data) => {
          try {
            await api.createMainTask({ ...data, task_date: selectedDate });
            handleTaskCreated();
          } catch (e: any) { message.error(e.message); }
        }}
        onCancel={() => { setCreating(false); setTasks(null); }}
        titleExtra={`AI 助理 — 第 ${taskIndex + 1}/${tasks.length} 个任务`}
      />
    );
  }

  return (
    <Modal
      title={<span><RobotOutlined /> AI 助理创建/修改任务</span>}
      open
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {!tasks ? (
        <div>
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'请用自然语言描述任务，例如：\n"今天下午三点前完成竞品分析报告，对比A公司和B公司财报，数据找王姐要，做完先给李经理过目"\n\n也可以同时描述多个任务：\n"今天要搞三件事：1.提交报销单 2.约王总讨论预算 3.清理测试数据库"'}
            rows={6}
            style={{ marginBottom: 12 }}
          />
          <Button type="primary" loading={loading} onClick={handleSend} icon={<RobotOutlined />}>
            发送
          </Button>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>
            AI 解析出 {tasks.length} 个任务，请确认后点击"逐个创建"逐一填写详情
          </div>
          {tasks.map((t, i) => (
            <Card key={i} size="small" style={{ marginBottom: 8 }}
              title={<span style={{ fontWeight: 600 }}>{t.name}</span>}
            >
              <Space wrap size={4}>
                {t.purpose && <Tag color="blue">目标: {t.purpose}</Tag>}
                {t.priority > 0 && <Tag color="orange">优先级: {t.priority}</Tag>}
                {t.duration && <Tag>工期: {t.duration}天</Tag>}
                {t.relevants && <Tag color="purple">{t.relevants}</Tag>}
                {t.hints && <Tag color="cyan">{t.hints}</Tag>}
                {t.sub_tasks?.length > 0 && <Tag color="green">{t.sub_tasks.length} 个子任务</Tag>}
              </Space>
              {t.content && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{t.content}</div>}
            </Card>
          ))}
          {/* Follow-up section */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              还有哪些要素没想起来？你可以直接补充。（例如："注意预算不能超过五万"）
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
                placeholder="补充信息（可选）" style={{ flex: 1 }}
                onPressEnter={handleFollowUp} />
              <Button size="small" onClick={handleFollowUp} loading={loading}>补充</Button>
              <Button size="small" onClick={startCreate} type="primary">跳过追问</Button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Button onClick={() => { setTasks(null); setChatHistory([]); }}>重新输入</Button>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>
              逐个创建（{tasks.length}个）
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default AIDialog;
