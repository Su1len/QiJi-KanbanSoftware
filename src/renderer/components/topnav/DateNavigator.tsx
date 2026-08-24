import React from 'react';
import { Button } from 'antd';
import { DoubleLeftOutlined, LeftOutlined, RightOutlined, DoubleRightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { formatDateWithWeek } from '../../utils/date-utils';
import { useLang } from '../../context/LanguageContext';

const DateNavigator: React.FC<{
  currentMonday: dayjs.Dayjs; selectedDate: string;
  onNavigateWeek: (d: number) => void; onNavigateMonth: (d: number) => void;
}> = ({ selectedDate, onNavigateWeek, onNavigateMonth }) => {
  const { lang } = useLang();
  const displayDate = dayjs(selectedDate);
  const dateLabel = formatDateWithWeek(displayDate, lang);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <Button type="text" icon={<DoubleLeftOutlined />} onClick={() => onNavigateMonth(-1)} />
      <Button type="text" icon={<LeftOutlined />} onClick={() => onNavigateWeek(-1)} />
      <span style={{ fontSize: 14, fontWeight: 500, minWidth: 220, textAlign: 'center', userSelect: 'none', color: 'var(--color-text-primary)' }}>
        {dateLabel}
      </span>
      <Button type="text" icon={<RightOutlined />} onClick={() => onNavigateWeek(1)} />
      <Button type="text" icon={<DoubleRightOutlined />} onClick={() => onNavigateMonth(1)} />
    </div>
  );
};

export default DateNavigator;
