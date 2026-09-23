import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DAYS, DAY_LABELS, formatMinutes, formatShort, todayDayKey } from '../utils/dates';
import { dayCompletion, weekCompletion } from '../utils/completion';

export default function Dashboard() {
  const { activeWeek, dailyRecords, tasksById, streaks } = useApp();

  if (!activeWeek) {
    return (
      <div  className="dashboard-page">
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="empty-state">
          <p>No active week yet.</p>
          <Link to="/planner" className="btn btn-primary">Set up this week</Link>
        </div>
      </div>
    );
  }

  const schedule = activeWeek.schedule;
  const todayKey = todayDayKey(activeWeek.startDate);

  const dayRows = DAYS.map((d) => {
    const rec = dailyRecords.find((r) => r.weekId === activeWeek.id && r.day === d);
    const entries = schedule?.days?.[d] || [];
    const comp = dayCompletion(entries, tasksById, rec);
    return { day: d, ...comp };
  });

  const overall = weekCompletion(dayRows);
  const totalTasksScheduled = new Set(
    DAYS.flatMap((d) => (schedule?.days?.[d] || []).map((e) => e.taskId))
  ).size;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Week of {formatShort(activeWeek.startDate)}</p>
        </div>
        {todayKey && (
          <Link to="/today" className="btn btn-primary">Open today's workload</Link>
        )}
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span className="value mono">{streaks.currentStreak}</span>
          <span className="label">Current streak (days)</span>
        </div>
        <div className="card stat">
          <span className="value mono">{streaks.longestStreak}</span>
          <span className="label">Longest streak</span>
        </div>
        <div className="card stat">
          <span className="value mono">{overall.pct ?? '—'}{overall.pct !== null && '%'}</span>
          <span className="label">Weekly completion</span>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span className="value mono">{formatMinutes(overall.completedMinutes)} / {formatMinutes(overall.plannedMinutes)}</span>
          <span className="label">Completed / planned time</span>
        </div>
        <div className="card stat">
          <span className="value mono">{overall.completedItems} / {overall.totalItems}</span>
          <span className="label">Actionable items done ({totalTasksScheduled} tasks scheduled)</span>
        </div>
      </div>

      {!schedule && (
        <div className="empty-state" style={{ marginBottom: 20 }}>
          <p>This week doesn't have a generated plan yet.</p>
          <Link to="/planner" className="btn btn-primary">Generate the weekly plan</Link>
        </div>
      )}

      {schedule && (
        <div className="card">
          <h3>Seven-day overview</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {dayRows.map((row) => (
              <div key={row.day} className="row-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ width: 110 }}>
                  {DAY_LABELS[row.day]}
                  {row.day === todayKey && <span className="badge badge-gold" style={{ marginLeft: 8 }}>Today</span>}
                </span>
                <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, margin: '0 14px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${row.pct ?? 0}%`,
                    height: '100%',
                    background: row.pct === null ? 'var(--border)' : row.pct >= 90 ? 'var(--teal)' : row.pct >= 80 ? 'var(--gold)' : 'var(--coral)',
                  }} />
                </div>
                <span className="mono" style={{ width: 50, textAlign: 'right', color: 'var(--text-muted)' }}>
                  {row.pct === null ? '—' : `${row.pct}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}