import { DAYS, dateForDay } from './dates';

function miniTaskMinutes(task) {
  if (!task.miniTasks || task.miniTasks.length === 0) {
    return [];
  }

  const explicitTotal = task.miniTasks.reduce(
    (sum, mt) => sum + (Number(mt.estimatedMinutes) || 0),
    0
  );

  const unspecified = task.miniTasks.filter(
    (mt) => !(Number(mt.estimatedMinutes) > 0)
  );

  const remaining = Math.max(
    0,
    (Number(task.estimatedMinutes) || 0) - explicitTotal
  );

  const fallback =
    unspecified.length > 0
      ? Math.floor(remaining / unspecified.length)
      : 0;

  return task.miniTasks.map((mt) => ({
    ...mt,
    minutes:
      Number(mt.estimatedMinutes) > 0
        ? Number(mt.estimatedMinutes)
        : fallback,
  }));
}

function orderTasks(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];
  const cyclic = new Set();

  function visit(task) {
    if (visited.has(task.id)) return true;

    if (visiting.has(task.id)) {
      cyclic.add(task.id);
      return false;
    }

    visiting.add(task.id);

    if (task.dependsOn) {
      const dependency = byId.get(task.dependsOn);

      if (dependency) {
        const ok = visit(dependency);

        if (!ok) {
          cyclic.add(task.id);
          visiting.delete(task.id);
          return false;
        }
      }
    }

    visiting.delete(task.id);
    visited.add(task.id);
    ordered.push(task);

    return true;
  }

  for (const task of tasks) {
    visit(task);
  }

  return {
    ordered,
    cyclic,
  };
}

export function generateSchedule(week, tasks) {
  const capacities = {};
  const remaining = {};

  for (const day of DAYS) {
    const capacityHours = Number(week.capacities?.[day]) || 0;
    const capacityMinutes = Math.max(0, capacityHours * 60);

    capacities[day] = capacityMinutes;

    const commitments = (week.fixedCommitments || [])
      .filter((commitment) => commitment.day === day)
      .reduce(
      (sum, commitment) =>
        sum +
        (Number(commitment.minutes) ||
          Number(commitment.hours) * 60 ||
          0),
      0
    );

    remaining[day] = Math.max(0, capacityMinutes - commitments);
  }

  const {
    ordered,
    cyclic,
  } = orderTasks(tasks);

  const days = {};
  for (const day of DAYS) {
    days[day] = [];
  }

  const taskDay = new Map();
  const unscheduled = [];

  const weekStart = week.startDate;

  function deadlineIndex(task) {
    if (!task.deadline) return DAYS.length - 1;

    const deadline = new Date(`${task.deadline}T00:00:00`);
    const deadlineDate = dateForDay(weekStart, 'mon');

    if (!deadlineDate) return DAYS.length - 1;

    const start = new Date(`${weekStart}T00:00:00`);
    const diff =
      Math.floor(
        (deadline.getTime() - start.getTime()) /
          (1000 * 60 * 60 * 24)
      );

    return Math.max(0, Math.min(DAYS.length - 1, diff));
  }

  function dayIndex(day) {
    return DAYS.indexOf(day);
  }

  function dependencyDay(task) {
    if (!task.dependsOn) return -1;
    return taskDay.has(task.dependsOn)
      ? taskDay.get(task.dependsOn)
      : -1;
  }

  for (const task of ordered) {
    if (cyclic.has(task.id)) {
      unscheduled.push({
        taskId: task.id,
        reason: 'circular-dependency',
      });
      continue;
    }

    if (
      task.dependsOn &&
      tasks.some((t) => t.id === task.dependsOn) &&
      !taskDay.has(task.dependsOn)
    ) {
      unscheduled.push({
        taskId: task.id,
        reason: 'prerequisite-unscheduled',
      });
      continue;
    }

    const totalMinutes = Math.max(
      0,
      Number(task.estimatedMinutes) || 0
    );

    if (totalMinutes <= 0) {
      continue;
    }

    const deadline = deadlineIndex(task);
    const dependency = dependencyDay(task);

    const earliestDay = Math.max(0, dependency);
    const latestDay = deadline;

    const miniTasks = miniTaskMinutes(task);

    let scheduled = false;

    // First try to place the entire task on one day.
    for (
      let i = earliestDay;
      i <= latestDay;
      i++
    ) {
      const day = DAYS[i];

      if (remaining[day] >= totalMinutes) {
        days[day].push({
          taskId: task.id,
          minutes: totalMinutes,
          miniTaskIds:
            miniTasks.length > 0
              ? miniTasks.map((mt) => mt.id)
              : undefined,
        });

        remaining[day] -= totalMinutes;
        taskDay.set(task.id, i);

        scheduled = true;
        break;
      }
    }

    if (scheduled) continue;

    // If the task has mini-tasks, allow it to be split
    // at mini-task boundaries.
    if (miniTasks.length > 1) {
      let remainingTaskMinutes = totalMinutes;
      let firstScheduledDay = null;

      for (const miniTask of miniTasks) {
        const minutes = Math.max(
          0,
          Number(miniTask.minutes) || 0
        );

        if (minutes <= 0) continue;

        let placed = false;

        for (
          let i = earliestDay;
          i <= latestDay;
          i++
        ) {
          const day = DAYS[i];

          if (remaining[day] >= minutes) {
            days[day].push({
              taskId: task.id,
              minutes,
              miniTaskIds: [miniTask.id],
            });

            remaining[day] -= minutes;

            if (firstScheduledDay === null) {
              firstScheduledDay = i;
            }

            remainingTaskMinutes -= minutes;
            placed = true;
            break;
          }
        }

        if (!placed) {
          unscheduled.push({
            taskId: task.id,
            reason: 'insufficient-capacity-partial',
          });

          break;
        }
      }

      if (
        remainingTaskMinutes <= 0 &&
        firstScheduledDay !== null
      ) {
        taskDay.set(task.id, firstScheduledDay);
      }

      continue;
    }

    unscheduled.push({
      taskId: task.id,
      reason: 'insufficient-capacity',
    });
  }

  const totalCapacityMinutes = DAYS.reduce(
    (sum, day) => sum + capacities[day],
    0
  );

  const committedMinutes = DAYS.reduce(
    (sum, day) => {
      const commitmentMinutes = (week.fixedCommitments || [])
        .filter((commitment) => commitment.day === day)
        .reduce(
        (daySum, commitment) =>
          daySum +
          (Number(commitment.minutes) ||
            Number(commitment.hours) * 60 ||
            0),
        0
      );

      return sum + commitmentMinutes;
    },
    0
  );

  const availableMinutes = Math.max(
    0,
    totalCapacityMinutes - committedMinutes
  );

  const requiredMinutes = tasks.reduce(
    (sum, task) =>
      sum + Math.max(0, Number(task.estimatedMinutes) || 0),
    0
  );

  const scheduledMinutes = DAYS.reduce(
    (sum, day) =>
      sum +
      days[day].reduce(
        (daySum, entry) =>
          daySum + (Number(entry.minutes) || 0),
        0
      ),
    0
  );

  const overCapacityMinutes = Math.max(
    0,
    requiredMinutes - availableMinutes
  );

  return {
    days,

    stats: {
      totalCapacityMinutes,
      committedMinutes,
      availableMinutes,
      requiredMinutes,
      scheduledMinutes,

      // WeeklyPlanner.jsx expects this exact property.
      overCapacityMinutes,

      // Keep the old property as an alias so any
      // existing code using it will not immediately break.
      overCapacity: overCapacityMinutes,
    },

    unscheduled,
  };
}