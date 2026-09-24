import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMinutes } from '../utils/dates';

function TaskForm({ onClose }) {
  const {
    activeWeek,
    folders,
    tasks,
    addTask,
    addFolder,
  } = useApp();

  const [name, setName] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [folderId, setFolderId] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [dependsOn, setDependsOn] = useState('');
  const [miniTasksText, setMiniTasksText] = useState('');
  const [addToWeek, setAddToWeek] = useState(Boolean(activeWeek));
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const estimatedMinutes =
      (Number(hours) || 0) * 60 +
      (Number(minutes) || 0);

    if (!name.trim()) {
      setError('Task name is required.');
      return;
    }

    if (estimatedMinutes <= 0) {
      setError('Estimated duration must be greater than 0.');
      return;
    }

    let finalFolderId = folderId || null;

    if (newFolder.trim()) {
      const folder = await addFolder(newFolder.trim());
      finalFolderId = folder.id;
    }

    const miniTasks = miniTasksText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((miniTaskName) => ({
        id: crypto.randomUUID(),
        name: miniTaskName,
        estimatedMinutes: 0,
      }));

    await addTask({
      name: name.trim(),
      estimatedMinutes,
      deadline: deadline || null,
      folderId: finalFolderId,
      dependsOn: dependsOn || null,
      miniTasks,
      weekId: addToWeek && activeWeek ? activeWeek.id : null,
    });

    onClose();
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="row-between">
        <h2>New task</h2>

        <button
          className="btn btn-ghost"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Task name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Complete CS50P problem set"
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Hours</label>
            <input
              type="number"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Minutes</label>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Deadline (optional)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Folder</label>

            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">No folder</option>

              {folders.map((folder) => (
                <option
                  key={folder.id}
                  value={folder.id}
                >
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>New folder (optional)</label>

            <input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Create a new folder"
            />
          </div>
        </div>

        <div className="field">
          <label>Depends on (optional)</label>

          <select
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
          >
            <option value="">No dependency</option>

            {tasks
              .filter((task) => task.id !== undefined)
              .map((task) => (
                <option
                  key={task.id}
                  value={task.id}
                >
                  {task.name}
                </option>
              ))}
          </select>
        </div>

        <div className="field">
          <label>Mini-tasks (optional)</label>

          <textarea
            value={miniTasksText}
            onChange={(e) => setMiniTasksText(e.target.value)}
            placeholder={
              'One mini-task per line\nRead chapter\nTake notes\nSolve exercises'
            }
            rows={5}
          />

          <small style={{ color: 'var(--text-muted)' }}>
            Each line becomes an actionable mini-task.
          </small>
        </div>

        {activeWeek && (
          <label
            className="row"
            style={{
              marginBottom: 16,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={addToWeek}
              onChange={(e) => setAddToWeek(e.target.checked)}
            />

            <span>
              Add this task to the current week
            </span>
          </label>
        )}

        {error && (
          <p style={{ color: 'var(--coral)' }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary"
          type="submit"
        >
          Create task
        </button>
      </form>
    </div>
  );
}

function TaskRow({ task }) {
  const {
    activeWeek,
    weeks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskDone,
  } = useApp();

  const [editing, setEditing] = useState(false);

  const hasMiniTasks =
    Array.isArray(task.miniTasks) &&
    task.miniTasks.length > 0;

  async function handleAddToWeek() {
    if (!activeWeek) return;

    await updateTask(task.id, {
      weekId: activeWeek.id,
      status: 'active',
    });
  }

  /*
   * If this task is scheduled into a specific day of its week,
   * route completion through toggleTaskDone() so the day's
   * dailyRecord (and therefore streaks / Today / Weekly Report)
   * stays in sync with the task's own status. Only tasks with
   * no scheduled day (not yet planned into a week) fall back to
   * flipping task.status directly, since there's no daily record
   * to reconcile.
   */
  function findScheduledDay() {
    const week = weeks.find((w) => w.id === task.weekId);
    if (!week?.schedule) return null;

    const day = Object.keys(week.schedule.days).find((d) =>
      (week.schedule.days[d] || []).some(
        (entry) => entry.taskId === task.id
      )
    );

    return day ? { week, day } : null;
  }

  async function handleMarkDone() {
    /*
     * Tasks with mini-tasks are completed through their
     * mini-tasks on the Today page.
     */
    if (hasMiniTasks) return;

    const scheduled = findScheduledDay();

    if (scheduled) {
      await toggleTaskDone(scheduled.week.id, scheduled.day, task.id);
    } else {
      await updateTask(task.id, { status: 'done' });
    }
  }

  async function handleReopen() {
    const scheduled = findScheduledDay();

    if (scheduled) {
      await toggleTaskDone(scheduled.week.id, scheduled.day, task.id);
    } else {
      await updateTask(task.id, { status: 'active' });
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${task.name}"?`
    );

    if (!confirmed) return;

    await deleteTask(task.id);
  }

  return (
    <div
      className="card"
      style={{ marginBottom: 12 }}
    >
      <div className="row-between">
        <div>
          <h3>{task.name}</h3>

          <div
            className="row"
            style={{
              marginTop: 6,
              flexWrap: 'wrap',
            }}
          >
            <span className="badge">
              {formatMinutes(task.estimatedMinutes)}
            </span>

            {task.deadline && (
              <span className="badge">
                Due {task.deadline}
              </span>
            )}

            {hasMiniTasks && (
              <span className="badge">
                {task.miniTasks.length} mini-tasks
              </span>
            )}

            {task.dependsOn && (
              <span className="badge">
                Has dependency
              </span>
            )}

            {task.carriedFrom && (
              <span className="badge">
                Carried forward
              </span>
            )}
          </div>
        </div>

        <span
          className={`badge ${
            task.status === 'done'
              ? 'badge-teal'
              : 'badge-gold'
          }`}
        >
          {task.status === 'done'
            ? 'Done'
            : 'Active'}
        </span>
      </div>

      {hasMiniTasks && (
        <p
          style={{
            color: 'var(--text-muted)',
            marginTop: 12,
          }}
        >
          Completion is tracked through the mini-tasks
          on the Today page.
        </p>
      )}

      <div
        className="row"
        style={{
          marginTop: 14,
          flexWrap: 'wrap',
        }}
      >
        {task.status === 'done' ? (
          <button
            className="btn btn-ghost"
            onClick={handleReopen}
          >
            Reopen
          </button>
        ) : (
          !hasMiniTasks && (
            <button
              className="btn btn-primary"
              onClick={handleMarkDone}
            >
              Mark complete
            </button>
          )
        )}

        {activeWeek && task.weekId !== activeWeek.id && (
          <button
            className="btn btn-ghost"
            onClick={handleAddToWeek}
          >
            Add to this week
          </button>
        )}

        <button
          className="btn btn-ghost"
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Close' : 'Details'}
        </button>

        <button
          className="btn btn-danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>

      {editing && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
          }}
        >
          <p>
            <strong>Estimated:</strong>{' '}
            {formatMinutes(task.estimatedMinutes)}
          </p>

          <p>
            <strong>Deadline:</strong>{' '}
            {task.deadline || 'None'}
          </p>

          <p>
            <strong>Mini-tasks:</strong>{' '}
            {hasMiniTasks
              ? task.miniTasks.map((mt) => mt.name).join(', ')
              : 'None'}
          </p>

          <p>
            <strong>Status:</strong>{' '}
            {task.status}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { tasks, folders } = useApp();
  const [showForm, setShowForm] = useState(false);

  const folderMap = Object.fromEntries(
    folders.map((folder) => [
      folder.id,
      folder,
    ])
  );

  const grouped = {};

  for (const task of tasks) {
    const key = task.folderId || 'unfiled';

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(task);
  }

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p>
            Manage the work that can be scheduled into
            your weeks.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close' : '+ New task'}
        </button>
      </div>

      {showForm && (
        <TaskForm
          onClose={() => setShowForm(false)}
        />
      )}

      {tasks.length === 0 ? (
        <div className="empty-state">
          <p>
            No tasks yet. Create your first task to begin.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(
          ([folderId, folderTasks]) => (
            <section
              key={folderId}
              style={{ marginBottom: 28 }}
            >
              <h2>
                {folderId === 'unfiled'
                  ? 'Unfiled'
                  : folderMap[folderId]?.name ||
                    'Unknown folder'}
              </h2>

              {folderTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                />
              ))}
            </section>
          )
        )
      )}
    </div>
  );
}