import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DAY_LABELS, formatMinutes } from '../utils/dates';

export default function WeeklyReport() {
  const {
    activeWeek,
    weeks,
    tasksById,
    buildWeeklyReportData,
    closeWeek,
  } = useApp();

  const [selectedCarry, setSelectedCarry] = useState([]);
  const [closed, setClosed] = useState(false);

  const report = useMemo(
    () =>
      activeWeek
        ? buildWeeklyReportData(activeWeek)
        : null,
    [activeWeek, buildWeeklyReportData]
  );
if (closed) {
    return (
      <section className="weekly-report-page">
        <div className="page-header">
          <div>
            <h1>Weekly Report</h1>
            <p>Review your completed week.</p>
          </div>
        </div>

        <div className="card">
          <h3>Week closed</h3>
          <p>
            The report has been saved. Selected incomplete tasks were
            carried forward.
          </p>
        </div>
      </section>
    );
  }
  if (!activeWeek) {
    const latestReport = weeks.find(
      (week) => week.status === 'closed'
    );

    return (
      <section className="weekly-report-page">
        <div className="page-header">
          <div>
            <h1>Weekly Report</h1>
            <p>Review your completed week.</p>
          </div>
        </div>

        <div className="card empty-state">
          <h3>No active week</h3>
          <p>
            Create a week from the Weekly Planner to generate a report.
          </p>

          {latestReport && (
            <p>
              Your latest closed week started on{' '}
              {latestReport.startDate}.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="weekly-report-page">
        <div className="page-header">
          <div>
            <h1>Weekly Report</h1>
            <p>Generate a schedule first.</p>
          </div>
        </div>

        <div className="card empty-state">
          <h3>No report available</h3>
          <p>
            Generate the weekly plan before reviewing performance.
          </p>
        </div>
      </section>
    );
  }

  const toggleCarry = (taskId) => {
    setSelectedCarry((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    );
  };

  const handleCloseWeek = async () => {
    await closeWeek(activeWeek.id, selectedCarry);
    setClosed(true);
  };

  const { overall, dayStats, incompleteTaskIds } = report;

  return (
    <section className="weekly-report-page">
      <div className="page-header">
        <div>
          <h1>Weekly Report</h1>
          <p>
            Week starting {activeWeek.startDate}
          </p>
        </div>
      </div>

            <div className="grid-3">
            <div className="card stat">
              <span>Completion</span>
              <strong>
                {overall.pct === null ? '—' : `${overall.pct}%`}
              </strong>
            </div>

            <div className="card stat">
              <span>Actionable items</span>
              <strong>
                {overall.completedItems}/{overall.totalItems}
              </strong>
            </div>

            <div className="card stat">
              <span>Planned time</span>
              <strong>
                {formatMinutes(overall.plannedMinutes)}
              </strong>
            </div>
          </div>

          <div className="card">
            <h2>Daily performance</h2>

            <div className="grid-2">
              {dayStats.map((day) => (
                <div key={day.day} className="card">
                  <div className="row-between">
                    <strong>{DAY_LABELS[day.day]}</strong>
                    <span>
                      {day.pct === null
                        ? '—'
                        : `${day.pct}%`}
                    </span>
                  </div>

                  <p>
                    {day.completedItems}/{day.totalItems} actionable
                    items completed
                  </p>

                  <p>
                    {formatMinutes(day.completedMinutes)} completed
                    {' · '}
                    {formatMinutes(day.plannedMinutes)} planned
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Incomplete items</h2>

            {incompleteTaskIds.length === 0 ? (
              <p>No incomplete scheduled tasks.</p>
            ) : (
              <>
                <p>
                  Select the tasks you want to carry into the next week.
                </p>

                {incompleteTaskIds.map((taskId) => {
                  const task = tasksById[taskId];

                  if (!task) return null;

                  return (
                    <label
                      key={taskId}
                      className="row"
                      style={{ marginBottom: '0.75rem' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCarry.includes(taskId)}
                        onChange={() => toggleCarry(taskId)}
                      />

                      <span>{task.name}</span>
                    </label>
                  );
                })}
              </>
            )}
          </div>

          <div className="card">
            <h2>Close week</h2>
            <p>
              Closing the week saves this report. Only the incomplete
              tasks you select above will be carried forward.
            </p>

            <button
              className="btn btn-primary"
              onClick={handleCloseWeek}
            >
              Close Week
              </button>
          </div>
    </section>
  );
}