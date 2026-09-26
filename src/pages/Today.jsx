import React, { useEffect, useState } from 'react';

import { useApp } from '../context/AppContext';

import {
  DAYS,
  DAY_LABELS,
  formatMinutes,
  todayDayKey,
} from '../utils/dates';

import {
  dayCompletion,
} from '../utils/completion';

export default function Today() {
  const {
    activeWeek,
    tasksById,
    dailyRecords,
    toggleMiniTask,
    toggleTaskDone,
    toggleCommitmentDone,
    getMotivation,
  } = useApp();

  const defaultDay = activeWeek
    ? (todayDayKey(activeWeek.startDate) || 'mon')
    : 'mon';

  const [day, setDay] = useState(defaultDay);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setDay(defaultDay);
  }, [defaultDay]);

  if (!activeWeek || !activeWeek.schedule) {
    return (
      <div className="today-page">
        <div className="page-header">
          <h1>Today</h1>
        </div>

        <div className="empty-state">
          <p>
            Generate this week's plan first to see today's workload.
          </p>
        </div>
      </div>
    );
  }

  const record = dailyRecords.find(
    (r) =>
      r.weekId === activeWeek.id &&
      r.day === day
  );

  const entries =
    activeWeek.schedule.days[day] || [];

  const commitments =
    (activeWeek.fixedCommitments || []).filter(
      (c) => c.day === day
    );

  const commitmentMinutes =
    commitments.reduce(
      (sum, c) =>
        sum +
        (Number(c.minutes) ||
          Number(c.hours) * 60 ||
          0),
      0
    );

  const plannedTaskMinutes =
    entries.reduce(
      (sum, entry) =>
        sum + entry.minutes,
      0
    );

  const totalWorkloadMinutes =
    commitmentMinutes +
    plannedTaskMinutes;

  const comp = dayCompletion(
    entries,
    tasksById,
    record
  );

  const requestFeedback = async () => {
    if (comp.pct === null) return;

    const msg =
      await getMotivation(comp.pct);

    setMessage(msg);
  };

  return (
    <div className="today-page">
      <div className="page-header">
        <div>
          <h1>Today</h1>
          <p>What do I need to do?</p>
        </div>

        <select
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            setMessage(null);
          }}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {DAY_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      {/* Fixed commitments + total workload */}
      <div
        className="card"
        style={{ marginBottom: 20 }}
      >
        <div className="row-between">
          <h3>Today's workload</h3>

          <span
            className="mono"
            style={{
              color: 'var(--text-muted)',
            }}
          >
            {formatMinutes(
              totalWorkloadMinutes
            )}
          </span>
        </div>

        {commitments.length > 0 && (
          <div style={{ marginTop: 10 }}>
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

            {commitments.map((commitment) => {
              const minutes =
                Number(commitment.minutes) ||
                Number(commitment.hours) * 60 ||
                0;

              const checked =
                record?.completedCommitmentIds?.includes(
                  commitment.id
                ) || false;

              return (
                <label
                  key={commitment.id}
                  className="row-between"
                  style={{
                    padding: '7px 0',
                    borderBottom:
                      '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="row"
                    style={{
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleCommitmentDone(
                          activeWeek.id,
                          day,
                          commitment.id
                        )
                      }
                    />

                    <span
                      style={{
                        textDecoration: checked
                          ? 'line-through'
                          : 'none',
                        color: checked
                          ? 'var(--text-muted)'
                          : 'var(--text)',
                      }}
                    >
                      {commitment.name}
                    </span>
                  </span>

                  <span
                    className="mono"
                    style={{
                      color: 'var(--text-muted)',
                    }}
                  >
                    {formatMinutes(minutes)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Task completion stats */}
      <div
        className="grid-3"
        style={{ marginBottom: 20 }}
      >
        <div className="card stat">
          <span className="value mono">
            {comp.completedItems} /{' '}
            {comp.totalItems}
          </span>

          <span className="label">
            Actionable items
          </span>
        </div>

        <div className="card stat">
          <span className="value mono">
            {comp.pct === null
              ? '—'
              : `${comp.pct}%`}
          </span>

          <span className="label">
            Completion
          </span>
        </div>

        <div className="card stat">
          <span className="value mono">
            {formatMinutes(
              comp.completedMinutes
            )}{' '}
            /{' '}
            {formatMinutes(
              comp.plannedMinutes
            )}
          </span>

          <span className="label">
            Time completed / planned
          </span>
        </div>
      </div>

      {/* Scheduled tasks */}
      {entries.length === 0 && (
        <div className="empty-state">
          <p>
            {commitments.length > 0
              ? `No study tasks scheduled for ${DAY_LABELS[day]}.`
              : `Nothing scheduled for ${DAY_LABELS[day]}.`}
          </p>
        </div>
      )}

      {entries.map((entry, i) => {
        const task =
          tasksById[entry.taskId];

        if (!task) return null;

                const relevantMiniTasks =
          entry.miniTaskIds
            ? task.miniTasks.filter(
                (mt) =>
                  entry.miniTaskIds.includes(
                    mt.id
                  )
              )
            : entry.autoSplit
            ? []
            : task.miniTasks;

                      return (
          <div
            className="card"
            key={i}
            style={{ marginBottom: 14 }}
          >
            <div className="row-between">
              <h3
                style={{
                  marginBottom: 8,
                }}
              >
                {task.name}
                {entry.autoSplit && (
                  <span
                    className="badge"
                    style={{ marginLeft: 8 }}
                  >
                    Session {entry.autoSplit.part} of{' '}
                    {entry.autoSplit.total}
                  </span>
                )}
              </h3>

              <span
                className="mono"
                style={{
                  color: 'var(--text-muted)',
                }}
              >
                {formatMinutes(
                  entry.minutes
                )}
              </span>
            </div>

            {entry.autoSplit && (
              <p
                style={{
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                This task didn't fit in one sitting, so it's
                split across {entry.autoSplit.total} days.
                Mark each session complete as you finish it.
              </p>
            )}

            {relevantMiniTasks &&
            relevantMiniTasks.length > 0 ? (
              <div>
                {relevantMiniTasks.map(
                  (mt) => {
                    const checked =
                      record?.completedMiniTaskIds?.includes(
                        mt.id
                      ) || false;

                    return (
                      <label
                        key={mt.id}
                        className="row"
                        style={{
                          padding: '5px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleMiniTask(
                              activeWeek.id,
                              day,
                              task.id,
                              mt.id
                            )
                          }
                        />

                        <span
                          style={{
                            textDecoration:
                              checked
                                ? 'line-through'
                                : 'none',
                            color: checked
                              ? 'var(--text-muted)'
                              : 'var(--text)',
                          }}
                        >
                          {mt.name}
                        </span>
                      </label>
                    );
                  }
                )}
              </div>
              ) : (
              <label
                className="row"
                style={{
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    record?.completedTaskIds?.includes(
                      task.id
                    ) || false
                  }
                  onChange={() =>
                    toggleTaskDone(
                      activeWeek.id,
                      day,
                      task.id
                    )
                  }
                />

                <span>
                  Mark complete
                </span>
              </label>
            )}
          </div>
        );
      })}

      {/* Feedback */}
      {entries.length > 0 && (
        <div className="card">
          <button
            className="btn btn-primary"
            onClick={requestFeedback}
          >
            Get today's feedback
          </button>

          {message && (
            <p
              style={{
                marginTop: 14,
                fontStyle: 'italic',
                color:
                  message.tier === 'low'
                    ? 'var(--coral)'
                    : message.tier === 'mid'
                    ? 'var(--gold)'
                    : 'var(--teal)',
              }}
            >
              "{message.text}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}