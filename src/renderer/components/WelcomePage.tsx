import React, { useState } from 'react';
import { Modal, Card, Button } from 'antd';
import { ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useMode, AppMode } from '../context/ModeContext';
import { useLang } from '../context/LanguageContext';

const WelcomePage: React.FC = () => {
  const { setMode } = useMode();
  const { t } = useLang();
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
          <h2 style={{ margin: 0, fontSize: 22 }}>{t('welcome.t1')}</h2>
          <p style={{ margin: '24px 0 12px', fontSize: 16, color: 'var(--color-text-primary)', lineHeight: 2 }}>
            {t('welcome.t2')}
          </p>
          <p style={{ margin: '0 0 40px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            {t('welcome.t3')}
          </p>
          <Button type="primary" size="large" onClick={() => setStep('mode')}>
            {t('welcome.start')}
          </Button>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{t('welcome.t4')}</h2>
            <p style={{ margin: '12px 0 32px', color: 'var(--color-text-secondary)', fontSize: 14 }}>
              {t('welcome.t5')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            <Card hoverable onClick={() => handleSelect('simple')}
              style={{ width: 210, textAlign: 'center', cursor: 'pointer' }}
              styles={{ body: { padding: 24 } }}>
              <ThunderboltOutlined style={{ fontSize: 40, color: 'var(--color-accent)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px' }}>{t('welcome.simple')}</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>
                {t('welcome.simpleDesc')}
              </p>
            </Card>
            <Card hoverable onClick={() => handleSelect('full')}
              style={{ width: 210, textAlign: 'center', cursor: 'pointer' }}
              styles={{ body: { padding: 24 } }}>
              <AppstoreOutlined style={{ fontSize: 40, color: 'var(--color-accent)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px' }}>{t('welcome.full')}</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>
                {t('welcome.fullDesc')}
              </p>
            </Card>
          </div>
        </>
      )}
    </Modal>
  );
};

export default WelcomePage;
