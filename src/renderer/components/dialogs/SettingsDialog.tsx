import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Button, DatePicker, Input, message, Select, TimePicker, Switch, Upload } from 'antd';
import { api } from '../../utils/api-client';
import { useTheme } from '../../context/ThemeContext';
import { useMode } from '../../context/ModeContext';
import { useLang } from '../../context/LanguageContext';
import type { Lang } from '../../i18n';
import type { MainTask } from '../../App';
import AboutTab from '../settings/AboutTab';
import RetroHistoryTab from '../settings/RetroHistoryTab';
import HelpTab from '../settings/HelpTab';
import RepeatTab from '../settings/RepeatTab';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const SettingsDialog: React.FC<{
  onClose: () => void; initialTab?: string; onOpenTask?: (task: MainTask) => void;
  timerMode?: 'auto' | 'manual';
  onTimerModeChange?: (v: 'auto' | 'manual') => void;
}> = ({ onClose, initialTab, onOpenTask, timerMode = 'auto', onTimerModeChange }) => {
  const { themeName, setTheme, availableThemes, theme, setDynamicEnabled } = useTheme();
  const { mode, setMode } = useMode();
  const { lang, setLang, t } = useLang();
  const [activeTab, setActiveTab] = useState(initialTab || 'skin');
  const [selectedTheme, setSelectedTheme] = useState(themeName);
  const [exportRange, setExportRange] = useState<[any, any] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [decryptedKey, setDecryptedKey] = useState('');
  const [summaryTime, setSummaryTime] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    api.hasApiKey().then(has => { if (has) setDecryptedKey(t('set.api.set')); });
    api.getSetting('summary_time').then(v => { if (v) setSummaryTime(dayjs(v, 'HH:mm')); });
  }, []);

  useEffect(() => { setSelectedTheme(themeName); }, [themeName]);

  const handleSummaryTimeChange = async (time: dayjs.Dayjs | null) => {
    setSummaryTime(time);
    if (time) await api.setSetting('summary_time', time.format('HH:mm'));
  };

  // 切换主题：检查目标主题是否支持当前语言
  const handleThemeChange = async (themeKey: string) => {
    try {
      const r = await fetch(`/themes/${themeKey}/theme.json`);
      const d = await r.json();
      const languages: string[] = Array.isArray(d.languages) ? d.languages : [];
      if (languages.length > 0 && !languages.includes(lang)) {
        Modal.confirm({
          title: t('lang.themeNoSupport'),
          content: null,
          okText: t('common.save'),
          cancelText: t('common.cancel'),
          onOk: () => {},
        });
        return;
      }
      setSelectedTheme(themeKey);
      await setTheme(themeKey);
      message.success(t('set.skin.switched') + (d.themeName || themeKey));
    } catch {
      setSelectedTheme(themeKey);
      await setTheme(themeKey);
    }
  };

  // 切换语言：检查当前主题是否支持目标语言
  const handleLangChange = async (value: string) => {
    const target = value as Lang;
    if (target === lang) return;
    const languages = theme.languages || [];
    if (languages.length > 0 && !languages.includes(target)) {
      Modal.confirm({
        title: target === 'en' ? 'The current theme does not support this language. Switch back to the default theme?' : '当前皮肤不支持该语言，是否切换回默认皮肤？',
        okText: target === 'en' ? 'Yes' : '是',
        cancelText: target === 'en' ? 'No' : '否',
        onOk: async () => {
          await setTheme('light-gray');
          await setLang(target);
          message.success(target === 'en' ? 'Language switched' : '已切换语言');
        },
        onCancel: () => {},
      });
      return;
    }
    await setLang(target);
    message.success(target === 'en' ? 'Language switched' : '已切换语言');
  };

  const handleExport = () => {
    if (!exportRange || !exportRange[0] || !exportRange[1]) {
      message.warning(t('set.exportRangeWarn'));
      return;
    }
    const start = exportRange[0].format('YYYY-MM-DD');
    const end = exportRange[1].format('YYYY-MM-DD');
    api.downloadCSV(start, end);
  };

  const handleDeleteAll = async () => {
    if (deleteConfirm !== t('set.data.confirmWord')) {
      message.warning(t('set.data.confirmPh'));
      return;
    }
    await api.deleteAllTasks();
    message.success(t('set.data.deleted'));
    setDeleteConfirm('');
  };

  const handleSaveApiKey = async () => {
    if (!apiKey || !password) { message.warning(t('set.api.fillBoth')); return; }
    await api.encryptApiKey(apiKey, password);
    message.success(t('set.api.saved'));
    setApiKey('');
    setPassword('');
    setDecryptedKey(t('set.api.set'));
  };

  const handleDecryptKey = async () => {
    if (!password) { message.warning(t('set.api.pwRequired')); return; }
    try {
      const val = await api.decryptApiKey(password);
      setDecryptedKey(val);
    } catch (e: any) {
      message.error(e.message || '解密失败');
    }
  };

  const tabs = [
    {
      key: 'skin',
      label: t('set.tab.skin'),
      children: (
        <div>
          <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>
            {t('set.skin.desc')}
          </p>
          <Select
            value={selectedTheme}
            onChange={handleThemeChange}
            style={{ width: 200 }}
            options={availableThemes.map(t => ({ value: t.key, label: t.name }))}
          />
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {t('set.lang')}
            </p>
            <Select
              value={lang}
              onChange={handleLangChange}
              style={{ width: 200 }}
              options={[
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          {theme.dynamicBackground && (
            <div style={{ marginTop: 16 }}>
              <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>
                {t('set.dynamicEffect')}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Switch
                  checked={theme.dynamicBackgroundEnabled === true}
                  onChange={(checked) => setDynamicEnabled(checked)}
                />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  {theme.dynamicBackgroundEnabled === true ? t('set.dynamicOn') : t('set.dynamicOff')}
                </span>
              </div>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {t('timer.mode')}
            </p>
            <Select
              value={timerMode}
              onChange={(v) => onTimerModeChange && onTimerModeChange(v)}
              style={{ width: 200 }}
              options={[
                { value: 'auto', label: `${t('timer.mode.auto')}（${t('timer.mode.autoDesc')}）` },
                { value: 'manual', label: `${t('timer.mode.manual')}（${t('timer.mode.manualDesc')}）` },
              ]}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {t('set.mode')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={mode === 'full'}
                onChange={(checked) => setMode(checked ? 'full' : 'simple')}
                checkedChildren={t('set.mode.full')} unCheckedChildren={t('set.mode.simple')}
              />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                {mode === 'full' ? t('set.mode.fullDesc') : t('set.mode.simpleDesc')}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'export',
      label: t('set.tab.export'),
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <RangePicker value={exportRange} onChange={(v) => setExportRange(v as any)} />
          </div>
          <Button type="primary" onClick={handleExport} style={{ marginRight: 8 }}>{t('set.exportCsv')}</Button>
          <Button onClick={() => { api.downloadBackup(); }}>{t('set.exportDb')}</Button>
        </div>
      ),
    },
    {
      key: 'data',
      label: t('set.tab.data'),
      children: (
        <div>
          <p style={{ color: '#ff4d4f', marginBottom: 12 }}>
            {t('set.data.warn')}
          </p>
          <Input
            placeholder={t('set.data.confirmPh')}
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            style={{ width: 240, marginRight: 8 }}
          />
          <Button danger onClick={handleDeleteAll}>{t('set.data.deleteAll')}</Button>

          <div style={{ marginTop: 24, padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ marginBottom: 8, fontWeight: 500 }}>{t('set.data.importTitle')}</p>
            <p style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 8 }}>
              {t('set.data.importWarn')}
            </p>
            <Upload
              accept=".db"
              showUploadList={false}
              beforeUpload={async (file) => {
                if (!confirm(t('set.data.importWarn'))) return Upload.LIST_IGNORE;
                try {
                  const result = await api.uploadBackup(file as File);
                  if (result.success) {
                    message.success(t('set.data.imported'));
                  } else {
                    message.error(result.error || t('data.importFail'));
                  }
                } catch (err: any) { message.error(err.message || t('data.importFail')); }
                return Upload.LIST_IGNORE;
              }}
            >
              <Button>{t('set.data.importBtn')}</Button>
            </Upload>
          </div>
        </div>
      ),
    },
    {
      key: 'api',
      label: t('set.tab.api'),
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>{t('set.api.key')}</label>
            <Input.Password
              placeholder={t('set.api.keyPh')}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ width: 300, marginBottom: 8 }}
            />
            <label style={{ display: 'block', marginBottom: 4 }}>{t('set.api.pw')}</label>
            <Input.Password
              placeholder={t('set.api.pwPh')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: 300 }}
            />
            <Button onClick={handleSaveApiKey} style={{ marginTop: 8, marginRight: 8 }}>
              {t('set.api.save')}
            </Button>
            <Button onClick={handleDecryptKey} style={{ marginTop: 8 }}>
              {t('set.api.view')}
            </Button>
          </div>
          {decryptedKey && (
            <div style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
              {t('set.api.current')}{decryptedKey}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'retro',
      label: t('set.tab.retro'),
      children: <RetroHistoryTab />,
    },
    {
      key: 'repeat',
      label: t('set.tab.repeat'),
      children: <RepeatTab onOpenTask={onOpenTask || (() => {})} />,
    },
    {
      key: 'help',
      label: t('set.tab.help'),
      children: <HelpTab />,
    },
    {
      key: 'about',
      label: t('set.tab.about'),
      children: <AboutTab />,
    },
  ];

  return (
    <Modal open onCancel={onClose} footer={null} width={750} title={t('set.title')}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
    </Modal>
  );
};

export default SettingsDialog;
