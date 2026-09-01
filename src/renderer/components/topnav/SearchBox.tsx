import React, { useState } from 'react';
import { AutoComplete, Input, Modal } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useLang } from '../../context/LanguageContext';

const SearchBox: React.FC<{
  viewMode: 'date' | 'project' | 'timeline';
  onNavigateToDate: (date: string, switchView?: boolean) => void;
  onNavigateToProject: (projectName: string) => void;
}> = ({ viewMode, onNavigateToDate, onNavigateToProject }) => {
  const { lang } = useLang();
  const [options, setOptions] = useState<{ value: string; label: React.ReactNode }[]>([]);
  const [value, setValue] = useState('');
  const noProjectText = lang === 'en' ? '· No project' : '· 无项目';
  const notFoundText = lang === 'en' ? 'No results' : '无匹配结果';
  const ph = lang === 'en' ? 'Search tasks across all dates...' : '搜索所有日期的任务...';

  const handleSearch = async (keyword: string) => {
    setValue(keyword);
    if (!keyword.trim()) { setOptions([]); return; }
    try {
      const resp = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);
      const results = await resp.json();
      setOptions((results || []).map((t: any) => {
        const jumpDate = (['进行中', '暂搁置'].includes(t.status))
          ? new Date().toISOString().slice(0, 10)
          : (t.max_date || t.task_date);
        return {
          value: `task-${t.id}`,
          jumpDate,
          projectName: t.project_name,
          label: (<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{t.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
              {t.task_date} {t.project_name ? `· ${t.project_name}` : noProjectText}
            </span>
          </div>),
        };
      }));
    } catch { setOptions([]); }
  };

  const handleSelect = (val: string, option: any) => {
    const { jumpDate, projectName } = option;
    if (viewMode === 'project') {
      if (projectName) {
        setValue(''); setOptions([]);
        onNavigateToProject(projectName);
      } else {
        Modal.confirm({
          title: lang === 'en' ? 'Switch View' : '切换视图',
          content: lang === 'en' ? 'This task only exists in the date view. Switch back to the date view?' : '该任务只存在于时间视图中，是否切换回时间视图？',
          okText: lang === 'en' ? 'OK' : '确定',
          cancelText: lang === 'en' ? 'Cancel' : '取消',
          onOk: () => { setValue(''); setOptions([]); onNavigateToDate(jumpDate, true); },
          onCancel: () => { setValue(''); setOptions([]); },
        });
      }
    } else {
      setValue(''); setOptions([]);
      onNavigateToDate(jumpDate, false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
      <AutoComplete value={value} options={options} onSearch={handleSearch}
        onSelect={handleSelect as any} style={{ width: 360 }}
        notFoundContent={value.trim() ? notFoundText : null}
      >
        <Input placeholder={ph} prefix={<SearchOutlined />}
          style={{ borderRadius: 20 }} allowClear />
      </AutoComplete>
    </div>
  );
};

export default SearchBox;
