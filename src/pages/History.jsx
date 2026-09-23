import React from 'react';
import { useApp } from '../context/AppContext';

export default function History() {
  const { weeklyReports, streaks } = useApp();

  return (
    <section className="history-page">
      <div className="page-header">
        <div>
          <h1>History</h1>
          <p>Your previous weekly performance.</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="card stat">
          <span>Current streak</span>
          <strong>{streaks.currentStreak}</strong>
        </div>

        <div className="card stat">
          <span>Longest streak</span>
          <strong>{streaks.longestStreak}</strong>
        </div>

        <div className="card stat">
          <span>Consistent days</span>
          <strong>{streaks.totalConsistentDays}</strong>
        </div>
      </div>

      <div className="card">
        <h2>Weekly history</h2>

        {weeklyReports.length === 0 ? (
          <div className="empty-state">
            <h3>No history yet</h3>
            <p>
              Close your first week to create a historical report.
            </p>
          </div>
        ) : (
          <div>
            {weeklyReports.map((report) => (
              <div
                key={report.id}
                className="row-between"
                style={{
                  padding: '1rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <strong>
                    Week of {report.startDate}
                  </strong>

                  <p>
                    {report.overall.completedItems}/
                    {report.overall.totalItems} actionable items
                  </p>
                </div>

                <strong>
                  {report.overall.pct === null
                    ? '—'
                    : `${report.overall.pct}%`}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}