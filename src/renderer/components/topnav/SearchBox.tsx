import React, { useState } from 'react';
import { AutoComplete, Input, Modal } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const SearchBox: React.FC<{
  viewMode: 'date' | 'project';
  onNavigateToDate: (date: string) => void;
  onNavigateToProject: (projectName: string) => void;
}> = ({ viewMode, onNavigateToDate, onNavigateToProject }) => {
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const [value, setValue] = useState('');

  const handleSearch = async (keyword: string) => {
    setValue(keyword);
    if (!keyword.trim()) { setOptions([]); return; }
    try {
      const resp = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
      const results = await resp.json();
      setOptions((results || []).map((t: any) => ({
        value: `task-${t.id}`,
        taskId: t.id,
        taskDate: t.task_date,
        projectName: t.project_name,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{t.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
              {t.task_date} {t.project_name ? `· ${t.project_name}` : '· 无项目'}
            </span>
          </div>
        ),
      })));
    } catch { setOptions([]); }
  };

  const handleSelect = (val: string, option: any) => {
    const { taskDate, projectName } = option;
    setValue('');
    setOptions([]);
    if (viewMode === 'project') {
      if (projectName) {
        onNavigateToProject(projectName);
      } else {
        Modal.confirm({
          title: '切换视图',
          content: '该任务只存在于时间视图中，是否切换回时间视图？',
          onOk: () => onNavigateToDate(taskDate),
        });
      }
    } else {
      onNavigateToDate(taskDate);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
      <AutoComplete
        value={value}
        options={options}
        onSearch={handleSearch}
        onSelect={handleSelect as any}
        style={{ width: 360 }}
        notFoundContent={value.trim() ? '无匹配结果' : null}
      >
        <Input
          placeholder="搜索所有日期的任务..."
          prefix={<SearchOutlined />}
          style={{ borderRadius: 20 }}
          allowClear
        />
      </AutoComplete>
    </div>
  );
};

export default SearchBox;
