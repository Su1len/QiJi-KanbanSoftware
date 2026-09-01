import React, { useState, useEffect, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import { api } from '../../utils/api-client';
import { useLang } from '../../context/LanguageContext';
import { statusText } from '../../i18n';
import type { MainTask, SubTask } from '../../App';

interface TimelineRow {
  rowType: 'main' | 'sub';
  mainId: number;
  mainName: string;
  projectName: string | null;
  taskId: number;
  taskName: string;
  status: string;
  startDate: string;
  endDate: string;
}

const DAY_COUNT = 30;
const DAY_WIDTH = 42;
const LABEL_WIDTH = 220;
const ROW_HEIGHT = 42;
const DRAG_DEAD_ZONE = 5;

const STATUS_COLORS: Record<string, string> = {
  '进行中': '#1677ff',
  '暂搁置': '#fa8c16',
  '已取消': '#8c8c8c',
  '已完成': '#52c41a',
};

const WEEK_KEYS = ['week.sun', 'week.mon', 'week.tue', 'week.wed', 'week.thu', 'week.fri', 'week.sat'];

const TimelineView: React.FC<{
  selectedTask: MainTask | null;
  selectedSubTask: SubTask | null;
  onSelectRow: (mainId: number, subId: number | null) => void;
  onEditTask: (task: MainTask) => void;
  onDataChanged: () => void;
  refreshKey?: number;
}> = ({ selectedTask, selectedSubTask, onSelectRow, onEditTask, onDataChanged, refreshKey }) => {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const [draggingRow, setDraggingRow] = useState<TimelineRow | null>(null);
  const dragRef = useRef<{ x: number; row: TimelineRow; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const axisStart = dayjs().startOf('day');
  const todayStr = axisStart.format('YYYY-MM-DD');
  const axisDays = Array.from({ length: DAY_COUNT }, (_, i) => axisStart.add(i, 'day'));

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTimeline();
      setRows(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRows(); }, [loadRows, refreshKey]);

  const commitShift = async (row: TimelineRow, deltaDays: number) => {
    if (!deltaDays) return;
    const startDate = dayjs(row.startDate).add(deltaDays, 'day').format('YYYY-MM-DD');
    const endDate = dayjs(row.endDate).add(deltaDays, 'day').format('YYYY-MM-DD');
    try {
      await api.updateTimelineTask({ taskType: row.rowType, taskId: row.taskId, startDate, endDate });
      await loadRows();
      onDataChanged();
    } catch (e) { console.error(e); }
  };

  const onBarPointerDown = (e: React.PointerEvent, row: TimelineRow) => {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { x: e.clientX, row, dragging: false };
    setDraggingRow(row);
    setDragDx(0);
  };
  const onBarPointerMove = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st) return;
    const dist = e.clientX - st.x;
    if (!st.dragging) {
      if (Math.abs(dist) < DRAG_DEAD_ZONE) return;
      st.dragging = true;
    }
    setDragDx(dist);
  };
  const onBarPointerUp = async (e: React.PointerEvent) => {
    const st = dragRef.current;
    dragRef.current = null;
    if (!st) return;
    if (st.dragging) {
      const deltaDays = Math.round((e.clientX - st.x) / DAY_WIDTH);
      suppressClickRef.current = true;
      await commitShift(st.row, deltaDays);
    } else {
      // 单击：选中该行任务（底部面板按钮可直接操作）
      onSelectRow(st.row.mainId, st.row.rowType === 'sub' ? st.row.taskId : null);
    }
    setDraggingRow(null);
    setDragDx(0);
  };
  const handleTrackClick = (row: TimelineRow) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    onSelectRow(row.mainId, row.rowType === 'sub' ? row.taskId : null);
  };
  const onBarDoubleClick = async (row: TimelineRow) => {
    try {
      const task = await api.getMainTaskWithSubs(row.mainId);
      if (task) onEditTask(task);
    } catch (e) { console.error(e); }
  };

  const dayDiff = (d1: string, d2: string) => dayjs(d2).startOf('day').diff(dayjs(d1).startOf('day'), 'day');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', paddingTop: 4 }}>
      <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, paddingLeft: LABEL_WIDTH + 8 }}>
        {t('timeline.hint')}
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40, fontSize: 13 }}>
            {t('timeline.empty')}
          </div>
        ) : (
          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg-primary)', zIndex: 2 }}>
              <div style={{ width: LABEL_WIDTH, flexShrink: 0, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {t('timeline.task')}
              </div>
              {axisDays.map(d => {
                const isToday = d.format('YYYY-MM-DD') === todayStr;
                return (
                  <div key={d.format('YYYY-MM-DD')} style={{
                    width: DAY_WIDTH, flexShrink: 0, textAlign: 'center', fontSize: 11, padding: '6px 0',
                    color: isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: isToday ? 700 : 400,
                    background: isToday ? 'var(--color-bg-hover)' : undefined,
                    borderRadius: 4,
                  }}>
                    <div>{d.format('M/D')}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>
                      {isToday ? t('timeline.today') : t(WEEK_KEYS[d.day()])}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Rows */}
            {rows.map(row => {
              const selected = row.rowType === 'sub'
                ? selectedSubTask?.id === row.taskId
                : (!selectedSubTask && selectedTask?.id === row.taskId);
              const barStart = row.startDate > todayStr ? row.startDate : todayStr;
              const endIsAfterAxis = row.endDate >= todayStr;
              const leftDays = dayDiff(todayStr, barStart);
              const spanDays = dayDiff(barStart, row.endDate) + 1;
              return (
                <div key={`${row.rowType}-${row.taskId}`} style={{
                  display: 'flex', borderBottom: '1px solid var(--color-border)',
                  background: selected ? 'var(--color-bg-hover)' : undefined,
                }}>
                  {/* Label */}
                  <div style={{
                    width: LABEL_WIDTH, flexShrink: 0, padding: '4px 8px', display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', cursor: 'pointer',
                  }} onClick={() => handleTrackClick(row)}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.rowType === 'sub' ? `${row.mainName} / ${row.taskName}` : row.mainName}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: STATUS_COLORS[row.status] || '#8c8c8c', marginRight: 4,
                      }} />
                      {statusText(row.status, lang)}
                    </div>
                  </div>
                  {/* Track */}
                  <div style={{
                    position: 'relative', width: DAY_COUNT * DAY_WIDTH, flexShrink: 0, cursor: 'pointer',
                  }} onClick={() => handleTrackClick(row)}>
                    {endIsAfterAxis && (
                      <div
                        onPointerDown={(e) => onBarPointerDown(e, row)}
                        onPointerMove={onBarPointerMove}
                        onPointerUp={onBarPointerUp}
                        onDoubleClick={() => onBarDoubleClick(row)}
                        title={`${row.startDate} → ${row.endDate}`}
                        style={{
                          position: 'absolute', top: 7, height: ROW_HEIGHT - 14,
                          left: leftDays * DAY_WIDTH,
                          width: Math.max(spanDays * DAY_WIDTH - 4, 8),
                          background: STATUS_COLORS[row.status] || '#8c8c8c',
                          borderRadius: 4, cursor: 'grab', opacity: 0.9,
                          boxShadow: draggingRow && draggingRow.taskId === row.taskId && draggingRow.rowType === row.rowType ? '0 2px 8px rgba(0,0,0,0.4)' : undefined,
                          transform: draggingRow && draggingRow.taskId === row.taskId && draggingRow.rowType === row.rowType ? `translateX(${dragDx}px)` : undefined,
                          zIndex: draggingRow && draggingRow.taskId === row.taskId && draggingRow.rowType === row.rowType ? 3 : 1,
                          display: 'flex', alignItems: 'center', paddingLeft: 6, overflow: 'hidden',
                        }}
                      >
                        <span style={{ fontSize: 11, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.taskName}
                        </span>
                      </div>
                    )}
                    {/* Today line */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: DAY_WIDTH, borderLeft: '2px solid var(--color-accent)', opacity: 0.35 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineView;
