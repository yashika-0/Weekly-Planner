import { DAYS } from './dates';

// Below this, a leftover sliver of capacity on a day is treated
// as unusable for an auto-split chunk rather than being handed
// a token amount of the task.
const AUTO_SPLIT_MIN_MINUTES = 15;

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

        // Either this task has no mini-tasks to split on, or only
    // one (which gives no useful boundary). Rather than dropping
    // the whole task when it can't fit in a single sitting,
    // automatically split it across whatever days between now
    // and its deadline still have room, one session per day.
    {
      let remainingTaskMinutes = totalMinutes;
      const chunks = [];

      for (
        let i = earliestDay;
        i <= latestDay && remainingTaskMinutes > 0;
        i++
      ) {
        const day = DAYS[i];
        const available = remaining[day];

        if (available < AUTO_SPLIT_MIN_MINUTES) continue;

        const chunkMinutes = Math.min(
          available,
          remainingTaskMinutes
        );

        chunks.push({ dayIndex: i, minutes: chunkMinutes });
        remaining[day] -= chunkMinutes;
        remainingTaskMinutes -= chunkMinutes;
      }

            if (chunks.length > 0) {
        chunks.forEach((chunk, idx) => {
          const day = DAYS[chunk.dayIndex];

          days[day].push({
            taskId: task.id,
            minutes: chunk.minutes,
            // Same as the whole-block case above: if this task
            // has any mini-tasks, each session stays completable
            // through them (toggleMiniTask), consistent with how
            // the task would behave if it had fit in one sitting.
            // Only a task with zero mini-tasks falls back to the
            // plain per-day completion checkbox.
            miniTaskIds:
              miniTasks.length > 0
                ? miniTasks.map((mt) => mt.id)
                : undefined,
            // Informational only - lets the UI show "Session 1
            // of 2" etc. so it's clear why the task appears on
            // more than one day.
            autoSplit: {
              part: idx + 1,
              total: chunks.length,
              final: idx === chunks.length - 1,
            },
          });
        });

        taskDay.set(task.id, chunks[0].dayIndex);

        if (remainingTaskMinutes > 0) {
          unscheduled.push({
            taskId: task.id,
            reason: 'insufficient-capacity-partial',
          });
        }

        continue;
      }
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