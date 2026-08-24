import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.locale('zh-cn');

/**
 * Get the week number using the simple algorithm:
 * January 1st is always in Week 1.
 */
export function getSimpleWeekNumber(date: dayjs.Dayjs): number {
  const yearStart = dayjs(`${date.year()}-01-01`);
  const daysDiff = date.diff(yearStart, 'day');
  return Math.floor(daysDiff / 7) + 1;
}

/**
 * Format date as "YYYY年 第WW周 MM月DD日"（中文）或 "YYYY Week WW MM/DD"（英文）
 */
export function formatDateWithWeek(date: dayjs.Dayjs, lang?: 'zh' | 'en'): string {
  const year = date.year();
  const week = getSimpleWeekNumber(date);
  const month = String(date.month() + 1).padStart(2, '0');
  const day = String(date.date()).padStart(2, '0');
  if (lang === 'en') {
    return `${year} Week ${String(week).padStart(2, '0')} ${month}/${day}`;
  }
  return `${year}年 第${String(week).padStart(2, '0')}周 ${month}月${day}日`;
}

/**
 * Get the Monday of the week containing the given date.
 * (Chinese weekday: Monday = 1, Sunday = 7)
 */
export function getWeekStart(date: dayjs.Dayjs): dayjs.Dayjs {
  const dayOfWeek = date.day(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const monday = date.subtract(dayOfWeek === 0 ? 6 : dayOfWeek - 1, 'day');
  return monday.startOf('day');
}

/**
 * Get all 7 dates of the week containing the given date.
 */
export function getWeekDates(date: dayjs.Dayjs): dayjs.Dayjs[] {
  const monday = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'));
}

/**
 * Get today's date string YYYY-MM-DD
 */
export function getTodayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string): string {
  const d = dayjs(dateStr);
  return `${d.month() + 1}月${d.date()}日`;
}

/**
 * Format timestamp for progress reports
 */
export function formatTimestamp(date: Date): string {
  const d = dayjs(date);
  return d.format('YYYY-MM-DD HH:mm');
}

/**
 * Get Chinese weekday number from a dayjs date (1=Monday, 7=Sunday)
 */
export function getChineseWeekday(date: dayjs.Dayjs): number {
  const d = date.day();
  return d === 0 ? 7 : d;
}

/**
 * Get Chinese weekday label
 */
export function getChineseWeekdayLabel(weekday: number): string {
  const labels = ['', '一', '二', '三', '四', '五', '六', '日'];
  return labels[weekday] || '';
}
