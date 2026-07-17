import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Button, DatePicker, Input, message, Select, TimePicker, Switch } from 'antd';
import { api } from '../../utils/api-client';
import { useTheme } from '../../context/ThemeContext';
import { useMode } from '../../context/ModeContext';
import AboutTab from '../settings/AboutTab';
import RetroHistoryTab from '../settings/RetroHistoryTab';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const SettingsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { themeName, setTheme, availableThemes, theme } = useTheme();
  const { mode, setMode } = useMode();
  const [activeTab, setActiveTab] = useState('skin');
  const [selectedTheme, setSelectedTheme] = useState(themeName);
  const [exportRange, setExportRange] = useState<[any, any] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [decryptedKey, setDecryptedKey] = useState('');
  const [summaryTime, setSummaryTime] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    api.hasApiKey().then(has => { if (has) setDecryptedKey('（已设置）'); });
    api.getSetting('summary_time').then(v => { if (v) setSummaryTime(dayjs(v, 'HH:mm')); });
  }, []);

  useEffect(() => { setSelectedTheme(themeName); }, [themeName]);

  const handleSummaryTimeChange = async (time: dayjs.Dayjs | null) => {
    setSummaryTime(time);
    if (time) await api.setSetting('summary_time', time.format('HH:mm'));
  };

  const handleThemeChange = async (t: string) => {
    setSelectedTheme(t);
    await setTheme(t);
    // Fetch the theme JSON to get the actual display name (theme.themeName is stale after setTheme)
    try {
      const r = await fetch(`/themes/${t}/theme.json`);
      const d = await r.json();
      message.success(`已切换到"${d.themeName || t}"主题`);
    } catch {
      message.success(`已切换到"${t}"主题`);
    }
  };

  const handleExport = async () => {
    if (!exportRange || !exportRange[0] || !exportRange[1]) {
      message.warning('请选择日期范围');
      return;
    }
    const start = exportRange[0].format('YYYY-MM-DD');
    const end = exportRange[1].format('YYYY-MM-DD');
    window.open(`/api/export-excel?startDate=${start}&endDate=${end}`, '_blank');
  };

  const handleDeleteAll = async () => {
    if (deleteConfirm !== '确认删除') {
      message.warning('请输入"确认删除"');
      return;
    }
    await api.deleteAllTasks();
    message.success('所有任务已删除');
    setDeleteConfirm('');
  };

  const handleSaveApiKey = async () => {
    if (!apiKey || !password) { message.warning('请填写 API 密钥和密码'); return; }
    await api.setSetting('deepseek_api_key', apiKey);
    await api.encryptApiKey(apiKey, password);
    message.success('API 密钥已保存');
    setApiKey('');
    setPassword('');
  };

  const handleDecryptKey = async () => {
    if (!password) { message.warning('请输入密码'); return; }
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
      label: '换肤',
      children: (
        <div>
          <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>
            选择主题后立即生效，无需重启。
          </p>
          <Select
            value={selectedTheme}
            onChange={handleThemeChange}
            style={{ width: 200 }}
            options={availableThemes.map(t => ({ value: t.key, label: t.name }))}
          />
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              操作模式
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={mode === 'full'}
                onChange={(checked) => setMode(checked ? 'full' : 'simple')}
                checkedChildren="详细" unCheckedChildren="简易"
              />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                {mode === 'full' ? '详细模式：显示所有字段和子任务功能' : '简易模式：隐藏复杂字段，只关注核心任务'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              每日总结时间（到点自动生成战报）
            </p>
            <TimePicker
              value={summaryTime}
              onChange={handleSummaryTimeChange}
              format="HH:mm"
              placeholder="选择时间"
              style={{ width: 160 }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'export',
      label: '导出任务',
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <RangePicker value={exportRange} onChange={(v) => setExportRange(v as any)} />
          </div>
          <Button type="primary" onClick={handleExport} style={{ marginRight: 8 }}>导出为 Excel</Button>
          <Button onClick={() => { api.downloadBackup(); message.success('数据库备份下载已开始'); }}>
            导出完整数据库
          </Button>
        </div>
      ),
    },
    {
      key: 'data',
      label: '数据管理',
      children: (
        <div>
          <p style={{ color: '#ff4d4f', marginBottom: 12 }}>
            此操作将删除软件内所有历史任务数据，不可恢复。
          </p>
          <Input
            placeholder='请输入"确认删除"'
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            style={{ width: 240, marginRight: 8 }}
          />
          <Button danger onClick={handleDeleteAll}>一键删除所有任务</Button>

          <div style={{ marginTop: 24, padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ marginBottom: 8, fontWeight: 500 }}>导入备份</p>
            <p style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 8 }}>
              导入将覆盖当前所有数据，此操作不可撤销。
            </p>
            <input type="file" accept=".db" style={{ marginBottom: 8, display: 'block' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm('导入将覆盖当前所有数据，此操作不可撤销。确定继续？')) { e.target.value = ''; return; }
                try {
                  const result = await api.uploadBackup(file);
                  if (result.success) {
                    message.success('数据已恢复，请重启应用');
                  } else {
                    message.error(result.error || '导入失败');
                  }
                } catch (err: any) { message.error(err.message || '导入失败'); }
                e.target.value = '';
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'api',
      label: 'API 密钥管理',
      children: (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>DeepSeek API 密钥</label>
            <Input.Password
              placeholder="请输入 API 密钥"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ width: 300, marginBottom: 8 }}
            />
            <label style={{ display: 'block', marginBottom: 4 }}>设置访问密码</label>
            <Input.Password
              placeholder="请设置一个访问密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: 300 }}
            />
            <Button onClick={handleSaveApiKey} style={{ marginTop: 8, marginRight: 8 }}>
              保存
            </Button>
            <Button onClick={handleDecryptKey} style={{ marginTop: 8 }}>
              查看/修改
            </Button>
          </div>
          {decryptedKey && (
            <div style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
              当前密钥：{decryptedKey}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'retrohistory',
      label: '复盘记录',
      children: <RetroHistoryTab />,
    },
    {
      key: 'about',
      label: '关于骐骥',
      children: <AboutTab />,
    },
  ];

  return (
    <Modal open onCancel={onClose} footer={null} width={600} title="设置">
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
    </Modal>
  );
};

export default SettingsDialog;
