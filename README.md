# StudyPlanner

A local-first weekly study planning and accountability web app designed to reduce decision fatigue by turning weekly tasks and available time into a realistic 7-day workload plan.

Instead of forcing strict time blocks, StudyPlanner answers a simpler question:

> **What do I need to get done today?**

## Features

* **Weekly planning**

  * Create a 7-day study week
  * Set different available capacities for weekdays and weekends
  * Add fixed commitments such as CodeChef/LeetCode contests
  * Generate a workload-aware weekly schedule

* **Task management**

  * Add tasks with estimated durations
  * Optional deadlines
  * Organize tasks into folders
  * Break tasks into actionable mini-tasks
  * Define task dependencies

* **Automatic scheduling**

  * Considers available daily capacity
  * Accounts for fixed commitments
  * Respects task dependencies
  * Considers deadlines
  * Reports when the week's workload exceeds available capacity

* **Daily execution**

  * Select any day of the week
  * View scheduled workload
  * Check off tasks and mini-tasks
  * Track planned vs completed time
  * Track fixed commitments separately

* **Accountability**

  * Daily completion percentage
  * Consistency tracking
  * Current streak
  * Longest streak
  * Total consistent days
  * Context-based motivational feedback

* **Weekly reports**

  * Overall completion percentage
  * Actionable items completed
  * Planned time
  * Daily performance breakdown
  * Manually select incomplete tasks to carry forward

* **History**

  * View previous weekly performance
  * Track consistency and streak statistics

* **Local-first**

  * Uses browser IndexedDB for persistence
  * No account required
  * No backend
  * No external database
  * No cloud synchronization

## Tech Stack

* **React**
* **Vite**
* **React Router**
* **JavaScript**
* **IndexedDB**
* **HTML / CSS**

## Project Structure

```text
Weekly tracker/
├── index.html
├── package.json
├── package-lock.json
├── .gitignore
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── db.js
    │
    ├── components/
    │   └── Nav.jsx
    │
    ├── context/
    │   └── AppContext.jsx
    │
    ├── pages/
    │   ├── Dashboard.jsx
    │   ├── Tasks.jsx
    │   ├── WeeklyPlanner.jsx
    │   ├── Today.jsx
    │   ├── WeeklyReport.jsx
    │   ├── History.jsx
    │   └── Settings.jsx
    │
    ├── styles/
    │   ├── layout.css
    │   └── tokens.css
    │
    └── utils/
        ├── completion.js
        ├── dates.js
        ├── motivation.js
        └── scheduler.js
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yashika-0/Weekly-Planner.git
cd Weekly-Planner
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Then open the local URL provided by Vite, usually:

```text
http://localhost:5173
```

## How It Works

The core workflow is:

```text
CREATE WEEK
     ↓
SET AVAILABLE HOURS
     ↓
ADD TASKS
     ↓
ADD DEADLINES / DEPENDENCIES
     ↓
ADD FIXED COMMITMENTS
     ↓
GENERATE WEEKLY PLAN
     ↓
EXECUTE DAILY WORKLOAD
     ↓
TRACK COMPLETION
     ↓
WEEKLY REPORT
     ↓
SELECT TASKS TO CARRY FORWARD
     ↓
NEXT WEEK
```

### Scheduling Model

StudyPlanner treats all tasks as equal in priority rather than requiring manual priority rankings.

The scheduler considers:

* Available daily capacity
* Fixed commitments
* Task duration
* Deadlines
* Dependencies
* Mini-task boundaries

If the requested workload cannot fit within the available weekly capacity, the application reports the **overcapacity** instead of silently removing work from the plan.

## Design Philosophy

StudyPlanner is intentionally built around **execution rather than complicated productivity systems**.

It does not attempt to:

* Automatically reschedule unfinished work
* Automatically carry tasks into the next week
* Generate AI schedules
* Force users into strict hourly time blocks
* Add unnecessary priority systems

The user remains responsible for deciding what to carry forward and when to execute the planned workload.

## V1 Scope

The current version intentionally excludes:

* User authentication
* Cloud synchronization
* Backend services
* External databases
* Mobile applications
* Notifications
* Calendar integrations
* Social features
* Collaboration
* Payments
* AI-generated schedules

## Status

**V1 — Functional local application**

The project is actively being developed, with the current focus on improving the UI, consistency, and overall user experience.

## License

This project is currently for personal/educational development.
