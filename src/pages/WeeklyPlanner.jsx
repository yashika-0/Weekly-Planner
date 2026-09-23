import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DAYS, DAY_LABELS, formatMinutes, formatShort, isoDate, mondayOf } from '../utils/dates';

function CreateWeekForm() {
  const { createWeek } = useApp();
  const [startDate, setStartDate] = useState(isoDate(mondayOf()));
  const [capacities, setCapacities] = useState({ mon: 4, tue: 4, wed: 4, thu: 4, fri: 4, sat: 7, sun: 7 });

  const submit = async (e) => {
    e.preventDefault();
    await createWeek({ startDate, capacities, fixedCommitments: [] });
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3>Set up this week</h3>
      <div className="field">
        <label>Week starts (Monday)</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Available hours per day</label>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{DAY_LABELS[d]}</span>
              <input
                type="number" min="0" max="24" step="0.5"
                value={capacities[d]}
                onChange={(e) => setCapacities((c) => ({ ...c, [d]: Number(e.target.value) }))}
                style={{ width: 70 }}
              />
            </div>
          ))}
        </div>
      </div>
      <button type="submit" className="btn btn-primary">Create week</button>
    </form>
  );
}

function CommitmentsEditor({ week }) {
  const { updateWeek } = useApp();
  const [name, setName] = useState('');
  const [day, setDay] = useState('mon');
  const [hours, setHours] = useState('');

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || !hours) return;
    const commitment = { id: `${Date.now()}`, day, name: name.trim(), hours: Number(hours) };
    await updateWeek(week.id, { fixedCommitments: [...(week.fixedCommitments || []), commitment] });
    setName(''); setHours('');
  };

  const remove = async (id) => {
    await updateWeek(week.id, { fixedCommitments: week.fixedCommitments.filter((c) => c.id !== id) });
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>Fixed commitments</h3>
      <p style={{ marginTop: -6 }}>These consume capacity before tasks are scheduled — a contest, a class, anything already fixed.</p>
      {week.fixedCommitments?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {week.fixedCommitments.map((c) => (
            <div key={c.id} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{c.name} — {DAY_LABELS[c.day]} · {formatMinutes(c.hours * 60)}</span>
              <button className="btn btn-ghost" onClick={() => remove(c.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <form className="row" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="CodeChef contest" style={{ flex: 1 }} />
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
        </select>
        <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="hours" style={{ width: 80 }} />
        <button type="submit" className="btn">Add</button>
      </form>
    </div>
  );
}

function ScheduleView({ week, tasksById }) {
  const schedule = week.schedule;

  if (!schedule) {
    return (
      <div className="card">
        <h3>Plan not generated yet</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Add your fixed commitments and tasks, then generate the weekly plan.
        </p>
      </div>
    );
  }

  const { stats, unscheduled } = schedule;
  const over = stats.overCapacityMinutes > 0;
  const commitments = week.fixedCommitments || [];

  return (
    <div>
      {over && (
        <div
          className="card"
          style={{
            borderColor: 'var(--coral-dim)',
            marginBottom: 20,
          }}
        >
          <h3 style={{ color: 'var(--coral)' }}>
            Your weekly workload exceeds your available capacity.
          </h3>

          <p className="mono">
            Available: {formatMinutes(stats.availableMinutes)} · Required:{' '}
            {formatMinutes(stats.requiredMinutes)} · Over by{' '}
            {formatMinutes(stats.overCapacityMinutes)}
          </p>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div
          className="card"
          style={{
            borderColor: 'var(--coral-dim)',
            marginBottom: 20,
          }}
        >
          <h3>Unscheduled</h3>

          {unscheduled.map((u) => {
            const task = tasksById[u.taskId];

            if (!task) return null;

            const reason = {
              'insufficient-capacity':
                "didn't fit before its deadline / in remaining capacity",
              'insufficient-capacity-partial':
                'only partially fit — remainder left unscheduled',
              'prerequisite-unscheduled':
                "its prerequisite couldn't be scheduled either",
              'circular-dependency':
                'part of a circular dependency',
            }[u.reason] || u.reason;

            return (
              <p
                key={u.taskId}
                style={{ margin: '4px 0' }}
              >
                · <strong>{task.name}</strong> — {reason}
              </p>
            );
          })}
        </div>
      )}

      {DAYS.map((d) => {
        const entries = schedule.days[d] || [];

        const dayCommitments = commitments.filter(
          (c) => c.day === d
        );

        const commitmentMinutes = dayCommitments.reduce(
          (sum, c) =>
            sum +
            (Number(c.minutes) ||
              Number(c.hours) * 60 ||
              0),
          0
        );

        const plannedTaskMinutes = entries.reduce(
          (sum, entry) => sum + entry.minutes,
          0
        );

        const totalPlannedMinutes =
          commitmentMinutes + plannedTaskMinutes;

        return (
          <div
            className="card"
            key={d}
            style={{ marginBottom: 14 }}
          >
            <div className="row-between">
              <h3 style={{ marginBottom: 4 }}>
                {DAY_LABELS[d]}
              </h3>

              <span
                className="mono"
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                Total workload: {formatMinutes(totalPlannedMinutes)}
              </span>
            </div>

            {/* Fixed commitments */}
            {dayCommitments.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Fixed commitments
                </div>

                {dayCommitments.map((commitment) => {
                  const minutes =
                    Number(commitment.minutes) ||
                    Number(commitment.hours) * 60 ||
                    0;

                  return (
                    <div
                      key={commitment.id}
                      className="row-between"
                      style={{
                        padding: '5px 0',
                      }}
                    >
                      <span>
                        {commitment.name}
                      </span>

                      <span
                        className="mono"
                        style={{
                          color: 'var(--text-muted)',
                        }}
                      >
                        {formatMinutes(minutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scheduled tasks */}
            {entries.length === 0 && dayCommitments.length === 0 && (
              <p
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                Nothing scheduled.
              </p>
            )}

            {entries.length > 0 && (
              <div
                style={{
                  marginTop:
                    dayCommitments.length > 0 ? 10 : 0,
                }}
              >
                {entries.map((entry, i) => {
                  const task = tasksById[entry.taskId];

                  if (!task) return null;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '6px 0',
                        borderTop:
                          i > 0
                            ? '1px solid var(--border)'
                            : 'none',
                      }}
                    >
                      <div className="row-between">
                        <span>
                          {i + 1}. {task.name}
                        </span>

                        <span
                          className="mono"
                          style={{
                            color: 'var(--text-muted)',
                          }}
                        >
                          {formatMinutes(entry.minutes)}
                        </span>
                      </div>

                      {entry.miniTaskIds &&
                        entry.miniTaskIds.length > 0 && (
                          <div
                            style={{
                              paddingLeft: 18,
                              color: 'var(--text-muted)',
                              fontSize: '0.85rem',
                            }}
                          >
                            Partial:{' '}
                            {task.miniTasks
                              .filter((mt) =>
                                entry.miniTaskIds.includes(
                                  mt.id
                                )
                              )
                              .map((mt) => mt.name)
                              .join(', ')}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WeeklyPlanner() {
  const { activeWeek, tasks, tasksById, regenerateSchedule, updateWeek } = useApp();
  const [editingCapacity, setEditingCapacity] = useState(false);

  if (!activeWeek) {
    return (
      <div className="planner-page">
        <div className="page-header"><h1>Weekly Planner</h1></div>
        <CreateWeekForm />
      </div>
    );
  }

  const weekTasks = tasks.filter((t) => t.weekId === activeWeek.id && t.status !== 'done');

  return (
    <div className="planner-page">
      <div className="page-header">
        <div>
          <h1>Weekly Planner</h1>
          <p>Week of {formatShort(activeWeek.startDate)} · {weekTasks.length} tasks in this week's pool</p>
        </div>
        <button className="btn btn-primary" onClick={() => regenerateSchedule(activeWeek.id)}>
          {activeWeek.schedule ? 'Regenerate plan' : 'Generate weekly plan'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="row-between">
          <h3>Daily capacity</h3>
          <button className="btn btn-ghost" onClick={() => setEditingCapacity((v) => !v)}>
            {editingCapacity ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{DAY_LABELS[d]}</span>
              {editingCapacity ? (
                <input
                  type="number" min="0" max="24" step="0.5"
                  value={activeWeek.capacities[d]}
                  onChange={(e) => updateWeek(activeWeek.id, { capacities: { ...activeWeek.capacities, [d]: Number(e.target.value) } })}
                  style={{ width: 70 }}
                />
              ) : (
                <span className="mono">{activeWeek.capacities[d]}h</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <CommitmentsEditor week={activeWeek} />

      {weekTasks.length === 0 ? (
        <div className="empty-state">
          <p>No tasks assigned to this week yet. Add tasks from the Tasks page, or add existing ones there.</p>
        </div>
      ) : (
        <ScheduleView week={activeWeek} tasksById={tasksById} />
      )}
    </div>
  );
}
