import React from 'react';
import { Button } from 'antd';
import dayjs from 'dayjs';

const LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const WeekdaySelector: React.FC<{
  weekDates: dayjs.Dayjs[];
  selectedWeekday: number;
  selectedDate: string;
  onSelect: (date: string, weekday: number) => void;
}> = ({ weekDates, selectedWeekday, selectedDate, onSelect }) => (
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
          ghost={!isSelected}
          onClick={() => onSelect(dateStr, i + 1)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            fontWeight: isToday ? 700 : 400,
          }}
        >
          {LABELS[i]}
        </Button>
      );
    })}
  </div>
);

export default WeekdaySelector;
