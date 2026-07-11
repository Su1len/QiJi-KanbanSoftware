import React from 'react';
import { SettingOutlined, CalendarOutlined, FolderOutlined } from '@ant-design/icons';

const Sidebar: React.FC<{
  viewMode: 'date' | 'project';
  onChangeView: (v: 'date' | 'project') => void;
  onOpenSettings: () => void;
}> = ({ viewMode, onChangeView, onOpenSettings }) => (
  <div style={{
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16, gap: 16,
  }}>
    <CalendarOutlined
      onClick={() => onChangeView('date')}
      style={{ fontSize: 18, cursor: 'pointer',
        color: viewMode === 'date' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
      title="日期视图"
    />
    <FolderOutlined
      onClick={() => onChangeView('project')}
      style={{ fontSize: 18, cursor: 'pointer',
        color: viewMode === 'project' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
      title="项目视图"
    />
    <SettingOutlined
      style={{ fontSize: 20, color: 'var(--color-text-secondary)', cursor: 'pointer' }}
      onClick={onOpenSettings}
      title="设置"
    />
  </div>
);

export default Sidebar;
