import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import { AppProvider, useApp } from './context/AppContext';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import WeeklyPlanner from './pages/WeeklyPlanner';
import Today from './pages/Today';
import WeeklyReport from './pages/WeeklyReport';
import History from './pages/History';
import Settings from './pages/Settings';

function Shell() {
  const { loaded } = useApp();
  if (!loaded) {
    return (
      <div className="shell">
        <div className="main"><p>Loading your data…</p></div>
      </div>
    );
  }
  return (
    <div className="shell">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/planner" element={<WeeklyPlanner />} />
          <Route path="/today" element={<Today />} />
          <Route path="/report" element={<WeeklyReport />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}