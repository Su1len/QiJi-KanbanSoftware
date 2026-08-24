import React from 'react';
import { Button } from 'antd';
import dayjs from 'dayjs';
import { useLang } from '../../context/LanguageContext';

const WeekdaySelector: React.FC<{
  weekDates: dayjs.Dayjs[];
  selectedWeekday: number;
  selectedDate: string;
  onSelect: (date: string, weekday: number) => void;
}> = ({ weekDates, selectedWeekday, selectedDate, onSelect }) => {
  const { t, lang } = useLang();
  const labels = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['一', '二', '三', '四', '五', '六', '日'];
  return (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '4px 0 8px' }}>
    {weekDates.map((d, i) => {
      const dateStr = d.format('YYYY-MM-DD');
      const isToday = d.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
      const isSelected = dateStr === selectedDate;
      return (
        <Button
          key={i}
          size="small"
          type={isSelected ? 'primary' : 'default'}
          onClick={() => onSelect(dateStr, i + 1)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            fontWeight: isToday ? 700 : 400,
          }}
        >
          {labels[i]}
        </Button>
      );
    })}
  </div>
  );
};

export default WeekdaySelector;
