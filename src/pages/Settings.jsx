import React from 'react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { refreshAll } = useApp();

  const handleRefresh = async () => {
    await refreshAll();
  };

  return (
    <section className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Local application settings.</p>
        </div>
      </div>

      <div className="card">
        <h2>Storage</h2>

        <p>
          This version of StudyPlanner stores its data locally in
          your browser using IndexedDB.
        </p>

        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
        >
          Refresh Local Data
        </button>
      </div>

      <div className="card">
        <h2>V1 scope</h2>

        <p>
          No account, cloud synchronization, hosting, or external
          database is used.
        </p>
      </div>
    </section>
  );
}