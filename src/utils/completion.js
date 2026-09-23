// A task with mini-tasks contributes one actionable item per mini-task.
// A task without mini-tasks contributes one actionable item (the task itself).

export function taskActionableItems(task) {
  if (task.miniTasks && task.miniTasks.length > 0) return task.miniTasks.length;
  return 1;
}

export function taskCompletedItems(task, record) {
  if (task.miniTasks && task.miniTasks.length > 0) {
    const done = record?.completedMiniTaskIds || [];
    return task.miniTasks.filter((mt) => done.includes(mt.id)).length;
  }
  const doneTasks = record?.completedTaskIds || [];
  return doneTasks.includes(task.id) ? 1 : 0;
}

export function isTaskFullyComplete(task, record) {
  return taskCompletedItems(task, record) === taskActionableItems(task);
}

// scheduledEntries: array of { taskId, minutes } placed for a given day (from the schedule)
// tasksById: map of taskId -> task
export function dayCompletion(scheduledEntries, tasksById, record) {
  let totalItems = 0;
  let completedItems = 0;
  let plannedMinutes = 0;
  let completedMinutes = 0;

  for (const entry of scheduledEntries) {
    const task = tasksById[entry.taskId];

    if (!task) continue;

    plannedMinutes += Number(entry.minutes) || 0;

    // If this schedule entry contains specific mini-tasks,
    // only count those mini-tasks for this day.
    if (entry.miniTaskIds && entry.miniTaskIds.length > 0) {
      const doneIds = record?.completedMiniTaskIds || [];

      const scheduledMiniTasks = task.miniTasks.filter((mt) =>
        entry.miniTaskIds.includes(mt.id)
      );

      const items = scheduledMiniTasks.length;

      const done = scheduledMiniTasks.filter((mt) =>
        doneIds.includes(mt.id)
      ).length;

      totalItems += items;
      completedItems += done;

      completedMinutes +=
        items > 0 ? (done / items) * entry.minutes : 0;
    } else {
      // A normal task is one actionable item.
      const doneTasks = record?.completedTaskIds || [];
      const done = doneTasks.includes(task.id) ? 1 : 0;

      totalItems += 1;
      completedItems += done;

      completedMinutes += done > 0 ? entry.minutes : 0;
    }
  }

  const pct =
    totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : null;

  return {
    totalItems,
    completedItems,
    pct,
    plannedMinutes,
    completedMinutes,
  };
}

export function weekCompletion(days) {
  // days: array of { totalItems, completedItems, plannedMinutes, completedMinutes }
  let totalItems = 0, completedItems = 0, plannedMinutes = 0, completedMinutes = 0;
  for (const d of days) {
    totalItems += d.totalItems;
    completedItems += d.completedItems;
    plannedMinutes += d.plannedMinutes;
    completedMinutes += d.completedMinutes;
  }
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null;
  return { totalItems, completedItems, pct, plannedMinutes, completedMinutes };
}