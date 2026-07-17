import React, { useState } from 'react';
import { Modal, Card, Button } from 'antd';
import { ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useMode, AppMode } from '../context/ModeContext';

const WelcomePage: React.FC = () => {
  const { setMode } = useMode();
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState<'welcome' | 'mode'>('welcome');

  const handleSelect = async (m: AppMode) => {
    await setMode(m);
    setVisible(false);
  };

  return (
    <Modal open={visible} footer={null} closable={false} width={560} centered style={{ top: 20 }}>
      {step === 'welcome' ? (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>欢迎来到骐骥</h2>
          <p style={{ margin: '24px 0 12px', fontSize: 16, color: 'var(--color-text-primary)', lineHeight: 2 }}>
            你的 AI，只做参谋，不做监工。
          </p>
          <p style={{ margin: '0 0 40px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            所有数据均存储于本地，你的努力只有你自己知道。
          </p>
          <Button type="primary" size="large" onClick={() => setStep('mode')}>
            开始使用
          </Button>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>欢迎使用骐骥看板</h2>
            <p style={{ margin: '12px 0 32px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
              请选择你喜欢的操作模式（日后可在设置中随时切换）
            </p>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            <Card hoverable onClick={() => handleSelect('simple')}
              style={{ width: 210, textAlign: 'center', cursor: 'pointer' }}
              styles={{ body: { padding: 24 } }}>
              <ThunderboltOutlined style={{ fontSize: 40, color: 'var(--color-accent)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px' }}>简易模式</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>
                隐藏复杂字段，只显示任务名、状态、优先级。适合快速记录和勾选待办。
              </p>
            </Card>
            <Card hoverable onClick={() => handleSelect('full')}
              style={{ width: 210, textAlign: 'center', cursor: 'pointer' }}
              styles={{ body: { padding: 24 } }}>
              <AppstoreOutlined style={{ fontSize: 40, color: 'var(--color-accent)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px' }}>详细模式</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>
                完整展示 THEMRPR、子任务、事务内容。适合需要精细管理项目的场景。
              </p>
            </Card>
          </div>
        </>
      )}
    </Modal>
  );
};

export default WelcomePage;
