import React from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const SearchBox: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
}> = ({ value, onChange, onSearch }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
    <Input
      placeholder="搜索任务..."
      prefix={<SearchOutlined />}
      value={value}
      onChange={e => onChange(e.target.value)}
      onPressEnter={onSearch}
      style={{ width: 360, borderRadius: 20 }}
      allowClear
    />
  </div>
);

export default SearchBox;
