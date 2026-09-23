import React from 'react';
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tasks', label: 'Tasks' },
  { to: '/planner', label: 'Weekly Planner' },
  { to: '/today', label: 'Today' },
  { to: '/report', label: 'Weekly Report' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
];

export default function Nav() {
  return (
    <nav className="sidebar">
      <div className="brand">Study<span>Planner</span></div>
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          {l.label}
        </NavLink>
      ))}
      <div className="sidebar-footer">Local-only. Nothing leaves this browser.</div>
    </nav>
  );
}