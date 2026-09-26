import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as db from '../db';
import {
  DAYS,
  dateForDay,
  isoDate,
  mondayOf,
} from '../utils/dates';
import { generateSchedule } from '../utils/scheduler';
import {
  dayCompletion,
  weekCompletion,
} from '../utils/completion';
import { pickMessage } from '../utils/motivation';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [weeks, setWeeks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [streaks, setStreaks] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalConsistentDays: 0,
  });
  const [usedMotivationIds, setUsedMotivationIds] = useState([]);

  const refreshAll = useCallback(async () => {
    const [
      w,
      t,
      f,
      dr,
      wr,
      streakMeta,
      usedMsgs,
    ] = await Promise.all([
      db.getAll('weeks'),
      db.getAll('tasks'),
      db.getAll('folders'),
      db.getAll('dailyRecords'),
      db.getAll('weeklyReports'),
      db.getMeta('streaks', {
        currentStreak: 0,
        longestStreak: 0,
        totalConsistentDays: 0,
      }),
      db.getMeta('usedMotivationIds', []),
    ]);

    setWeeks(
      w.sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      )
    );

    setTasks(t);
    setFolders(f);
    setDailyRecords(dr);

    setWeeklyReports(
      wr.sort((a, b) =>
        b.startDate.localeCompare(a.startDate)
      )
    );

    setStreaks(streakMeta);
    setUsedMotivationIds(usedMsgs);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const activeWeek = useMemo(
    () =>
      weeks.find((w) => w.status === 'active') || null,
    [weeks]
  );

  const tasksById = useMemo(
    () =>
      Object.fromEntries(
        tasks.map((t) => [t.id, t])
      ),
    [tasks]
  );

  // ---------- Weeks ----------

  const createWeek = useCallback(
    async ({
      startDate,
      capacities,
      fixedCommitments,
    }) => {
      const id = db.idGen();

      const week = {
        id,
        startDate:
          startDate || isoDate(mondayOf()),
        capacities,
        fixedCommitments:
          fixedCommitments || [],
        schedule: null,
        status: 'active',
        createdAt: Date.now(),
      };

      await db.put('weeks', week);

      const recs = DAYS.map((d) => ({
      id: `${id}_${d}`,
      weekId: id,
      day: d,
      date: dateForDay(week.startDate, d),
      completedMiniTaskIds: [],
      completedTaskIds: [],
      completedCommitmentIds: [],
    }));

      await db.putMany('dailyRecords', recs);
      await refreshAll();

      return week;
    },
    [refreshAll]
  );

  const updateWeek = useCallback(
    async (weekId, patch) => {
      const existing = await db.getOne(
        'weeks',
        weekId
      );

      if (!existing) {
        throw new Error(
          `Week ${weekId} was not found.`
        );
      }

      const updated = {
        ...existing,
        ...patch,
      };

      await db.put('weeks', updated);
      await refreshAll();

      return updated;
    },
    [refreshAll]
  );

  const regenerateSchedule = useCallback(
    async (weekId) => {
      const week = await db.getOne(
        'weeks',
        weekId
      );

      if (!week) {
        throw new Error(
          `Week ${weekId} was not found.`
        );
      }

      const weekTasks = tasks.filter(
        (t) =>
          t.weekId === weekId &&
          t.status !== 'done'
      );

      const schedule = generateSchedule(
        week,
        weekTasks
      );

      await db.put('weeks', {
        ...week,
        schedule,
      });

      await refreshAll();

      return schedule;
    },
    [tasks, refreshAll]
  );

  // ---------- Folders ----------

  const addFolder = useCallback(
    async (name) => {
      const folder = {
        id: db.idGen(),
        name,
      };

      await db.put('folders', folder);
      await refreshAll();

      return folder;
    },
    [refreshAll]
  );

  // ---------- Tasks ----------

  const addTask = useCallback(
    async (taskInput) => {
      const task = {
        id: db.idGen(),
        name: taskInput.name,
        estimatedMinutes:
          taskInput.estimatedMinutes,
        deadline:
          taskInput.deadline || null,
        folderId:
          taskInput.folderId || null,
        dependsOn:
          taskInput.dependsOn || null,

        miniTasks: (
          taskInput.miniTasks || []
        ).map((m) => ({
          id: db.idGen(),
          name: m.name,
          estimatedMinutes:
            m.estimatedMinutes || null,
        })),

        weekId:
          taskInput.weekId || null,

        carriedFrom: null,
        status: 'active',
        createdAt: Date.now(),
      };

      await db.put('tasks', task);
      await refreshAll();

      return task;
    },
    [refreshAll]
  );

  const updateTask = useCallback(
    async (taskId, patch) => {
      const existing = await db.getOne(
        'tasks',
        taskId
      );

      if (!existing) {
        throw new Error(
          `Task ${taskId} was not found.`
        );
      }

      const updated = {
        ...existing,
        ...patch,
      };

      /*
       * A task containing mini-tasks is completed
       * through those mini-tasks, not directly.
       */
      if (
        updated.miniTasks?.length > 0 &&
        patch.status === 'done'
      ) {
        updated.status = existing.status;
      }

      await db.put('tasks', updated);
      await refreshAll();

      return updated;
    },
    [refreshAll]
  );

  const deleteTask = useCallback(
    async (taskId) => {
      await db.remove('tasks', taskId);
      await refreshAll();
    },
    [refreshAll]
  );

  // ---------- Completion ----------

  const recomputeStreaks = useCallback(
    async () => {
      const allWeeks =
        await db.getAll('weeks');

      const allTasks =
        await db.getAll('tasks');

      const allRecords =
        await db.getAll('dailyRecords');

      const weeksById = Object.fromEntries(
        allWeeks.map((w) => [w.id, w])
      );

      const byId = Object.fromEntries(
        allTasks.map((t) => [t.id, t])
      );

      const consistentDates = new Set();
      let totalConsistent = 0;

      const sortedRecords = [
        ...allRecords,
      ].sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      for (const rec of sortedRecords) {
        const week =
          weeksById[rec.weekId];

        if (!week || !week.schedule) {
          continue;
        }

        const entries =
          week.schedule.days[rec.day] || [];

        const { completedItems } =
          dayCompletion(
            entries,
            byId,
            rec
          );

        if (completedItems > 0) {
          consistentDates.add(rec.date);
          totalConsistent += 1;
        }
      }

      // ---------- Longest streak ----------

      const sortedDates = [
        ...consistentDates,
      ].sort();

      let longest = 0;
      let run = 0;
      let prev = null;

      for (const d of sortedDates) {
        if (prev) {
          const prevDate =
            new Date(
              `${prev}T00:00:00`
            );

          const curDate =
            new Date(
              `${d}T00:00:00`
            );

          const diff = Math.round(
            (curDate - prevDate) /
              86400000
          );

          run =
            diff === 1
              ? run + 1
              : 1;
        } else {
          run = 1;
        }

        longest = Math.max(
          longest,
          run
        );

        prev = d;
      }

      // ---------- Current streak ----------

      let current = 0;

      const cursor = new Date();
      cursor.setHours(
        0,
        0,
        0,
        0
      );

      for (;;) {
        const iso = isoDate(cursor);

        if (consistentDates.has(iso)) {
          current += 1;

          cursor.setTime(
            cursor.getTime() -
              86400000
          );

          continue;
        }

        const hasRecordForDate =
          sortedRecords.some(
            (r) => r.date === iso
          );

        if (!hasRecordForDate) {
          cursor.setTime(
            cursor.getTime() -
              86400000
          );

          continue;
        }

        // A planned day with no completed
        // actionable item breaks the streak.
        break;
      }

      const streakData = {
        currentStreak: current,
        longestStreak: longest,
        totalConsistentDays:
          totalConsistent,
      };

      await db.setMeta(
        'streaks',
        streakData
      );

      setStreaks(streakData);
    },
    []
  );

  const toggleMiniTask = useCallback(
    async (
      weekId,
      day,
      taskId,
      miniTaskId
    ) => {
      const recId =
        `${weekId}_${day}`;

      const rec =
        await db.getOne(
          'dailyRecords',
          recId
        );

      if (!rec) {
        throw new Error(
          `Daily record ${recId} was not found.`
        );
      }

      const task =
        await db.getOne(
          'tasks',
          taskId
        );

      if (!task) {
        throw new Error(
          `Task ${taskId} was not found.`
        );
      }

      if (!task.miniTasks?.length) {
        return;
      }

      const currentIds =
        rec.completedMiniTaskIds || [];

      const has =
        currentIds.includes(
          miniTaskId
        );

      const completedMiniTaskIds =
        has
          ? currentIds.filter(
              (id) =>
                id !== miniTaskId
            )
          : [
              ...currentIds,
              miniTaskId,
            ];

      await db.put(
        'dailyRecords',
        {
          ...rec,
          completedMiniTaskIds,
        }
      );

      /*
       * Determine whether every mini-task belonging
       * to this task has now been completed somewhere
       * within the current week.
       */
      const weekRecords =
        await db.getAll(
          'dailyRecords'
        );

      const taskWeekRecords =
        weekRecords.filter(
          (r) => r.weekId === weekId
        );

      const completedIds =
        new Set();

      for (const record of taskWeekRecords) {
        for (const id of
          record.completedMiniTaskIds || []) {
          completedIds.add(id);
        }
      }

      const allMiniTasksComplete =
        task.miniTasks.every(
          (mt) =>
            completedIds.has(mt.id)
        );

      await db.put(
        'tasks',
        {
          ...task,
          status:
            allMiniTasksComplete
              ? 'done'
              : 'active',
        }
      );

      await recomputeStreaks();
      await refreshAll();
    },
    [
      recomputeStreaks,
      refreshAll,
    ]
  );

  const toggleTaskDone = useCallback(
    async (
      weekId,
      day,
      taskId
    ) => {
      const task =
        await db.getOne(
          'tasks',
          taskId
        );

      if (!task) {
        throw new Error(
          `Task ${taskId} was not found.`
        );
      }

      /*
       * Tasks with mini-tasks must be completed
       * through toggleMiniTask().
       */
      if (task.miniTasks?.length > 0) {
        return;
      }

      const recId =
        `${weekId}_${day}`;

      const rec =
        await db.getOne(
          'dailyRecords',
          recId
        );

      if (!rec) {
        throw new Error(
          `Daily record ${recId} was not found.`
        );
      }

      const currentIds =
        rec.completedTaskIds || [];

      const has =
        currentIds.includes(taskId);

      const completedTaskIds =
        has
          ? currentIds.filter(
              (id) =>
                id !== taskId
            )
          : [
              ...currentIds,
              taskId,
            ];

            await db.put(
        'dailyRecords',
        {
          ...rec,
          completedTaskIds,
        }
      );

      /*
       * A task can be scheduled across more than one day when
       * it didn't fit in a single sitting (see the scheduler's
       * auto-split). Each day's session gets its own checkbox,
       * but the task itself should only flip to "done" once
       * every session is checked off - otherwise regenerating
       * the plan would treat a partially-finished task as
       * complete and drop its remaining sessions.
       */
      const week = await db.getOne('weeks', weekId);

      let allSessionsComplete = !has;

      if (week?.schedule) {
        const scheduledDays = DAYS.filter((d) =>
          (week.schedule.days[d] || []).some(
            (entry) => entry.taskId === taskId
          )
        );

        if (scheduledDays.length > 1) {
          const allRecords = await db.getAll('dailyRecords');

          allSessionsComplete = scheduledDays.every((d) => {
            if (d === day) {
              // This is the toggle we just applied above.
              return !has;
            }

            const otherRec = allRecords.find(
              (r) => r.id === `${weekId}_${d}`
            );

            return (
              otherRec?.completedTaskIds || []
            ).includes(taskId);
          });
        }
      }

      await db.put(
        'tasks',
        {
          ...task,
          status: allSessionsComplete
            ? 'done'
            : 'active',
        }
      );

      await recomputeStreaks();
      await refreshAll();
    },
    [
      recomputeStreaks,
      refreshAll,
    ]
  );

  const toggleCommitmentDone = useCallback(
  async (weekId, day, commitmentId) => {
    const recId = `${weekId}_${day}`;

    const rec = await db.getOne(
      'dailyRecords',
      recId
    );

    if (!rec) {
      throw new Error(
        `Daily record ${recId} was not found.`
      );
    }

    const currentIds =
      rec.completedCommitmentIds || [];

    const has = currentIds.includes(
      commitmentId
    );

    const completedCommitmentIds = has
      ? currentIds.filter(
          (id) => id !== commitmentId
        )
      : [
          ...currentIds,
          commitmentId,
        ];

    await db.put(
      'dailyRecords',
      {
        ...rec,
        completedCommitmentIds,
      }
    );

    await refreshAll();
  },
  [refreshAll]
);
  // ---------- Motivation ----------

  const getMotivation = useCallback(
    async (pct) => {
      const used =
        await db.getMeta(
          'usedMotivationIds',
          []
        );

      const msg =
        pickMessage(
          pct,
          used
        );

      const updated = [
        ...used,
        msg.id,
      ].slice(-20);

      await db.setMeta(
        'usedMotivationIds',
        updated
      );

      setUsedMotivationIds(updated);

      return msg;
    },
    []
  );

  // ---------- Weekly report / carry forward / close ----------

  const buildWeeklyReportData =
    useCallback(
      (week) => {
        if (
          !week ||
          !week.schedule
        ) {
          return null;
        }

        const weekRecords =
          dailyRecords.filter(
            (r) =>
              r.weekId === week.id
          );

        const dayStats =
          DAYS.map((d) => {
            const rec =
              weekRecords.find(
                (r) => r.day === d
              );

            const entries =
              week.schedule.days[d] ||
              [];

            return {
              day: d,
              ...dayCompletion(
                entries,
                tasksById,
                rec
              ),
            };
          });

        const overall =
          weekCompletion(
            dayStats
          );

        const scheduledTaskIds =
          new Set(
            DAYS.flatMap((d) =>
              (
                week.schedule
                  .days[d] || []
              ).map(
                (e) => e.taskId
              )
            )
          );

        const completedTaskIds =
          new Set();

        const incompleteTaskIds =
          [];

                scheduledTaskIds.forEach(
          (taskId) => {
            const task =
              tasksById[taskId];

            if (!task) {
              return;
            }

            let items;
            let done;

            if (task.miniTasks?.length) {
              items = task.miniTasks.length;

              done = task.miniTasks.filter(
                (mt) =>
                  weekRecords.some(
                    (r) =>
                      (
                        r.completedMiniTaskIds ||
                        []
                      ).includes(mt.id)
                  )
              ).length;
            } else {
              /*
               * A plain task may be scheduled across more than
               * one day (auto-split, when it didn't fit in one
               * sitting). Each day's session is its own
               * actionable item, so this task only counts as
               * complete once every one of those days has been
               * checked off - matching dayCompletion() above.
               */
              const scheduledDays = DAYS.filter((d) =>
                (week.schedule.days[d] || []).some(
                  (e) => e.taskId === taskId
                )
              );

              items = scheduledDays.length;

              done = scheduledDays.filter((d) => {
                const rec = weekRecords.find(
                  (r) => r.day === d
                );

                return (
                  rec?.completedTaskIds || []
                ).includes(taskId);
              }).length;
            }

            if (items > 0 && done >= items) {
              completedTaskIds.add(
                taskId
              );
            } else {
              incompleteTaskIds.push(
                taskId
              );
            }
          }
        );
        const consistencyDays =
          dayStats.filter(
            (d) =>
              d.completedItems > 0
          ).length;

        return {
          dayStats,
          overall,
          completedTaskIds: [
            ...completedTaskIds,
          ],
          incompleteTaskIds,
          consistencyDays,
        };
      },
      [
        dailyRecords,
        tasksById,
      ]
    );

  const closeWeek = useCallback(
    async (
      weekId,
      carryTaskIds
    ) => {
      const week =
        await db.getOne(
          'weeks',
          weekId
        );

      if (!week) {
        throw new Error(
          `Week ${weekId} was not found.`
        );
      }

      const report =
        buildWeeklyReportData(
          week
        );

      if (report) {
        await db.put(
          'weeklyReports',
          {
            id: db.idGen(),
            weekId,
            startDate:
              week.startDate,
            ...report,
            closedAt: Date.now(),
          }
        );
      }

      await db.put(
        'weeks',
        {
          ...week,
          status: 'closed',
        }
      );

      for (
        const taskId of
        carryTaskIds || []
      ) {
        const task =
          await db.getOne(
            'tasks',
            taskId
          );

        if (!task) {
          continue;
        }

        await db.put(
          'tasks',
          {
            ...task,
            weekId: null,
            carriedFrom: weekId,
            status: 'active',
          }
        );
      }

      await refreshAll();
    },
    [
      buildWeeklyReportData,
      refreshAll,
    ]
  );

  const value = {
    loaded,
    weeks,
    tasks,
    folders,
    dailyRecords,
    weeklyReports,
    streaks,
    usedMotivationIds,

    activeWeek,
    tasksById,

    createWeek,
    updateWeek,
    regenerateSchedule,

    addFolder,
    addTask,
    updateTask,
    deleteTask,

    toggleMiniTask,
    toggleTaskDone,
    toggleCommitmentDone,
    recomputeStreaks,
    
    getMotivation,

    buildWeeklyReportData,
    closeWeek,

    refreshAll,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(
    AppContext
  );

  if (!ctx) {
    throw new Error(
      'useApp must be used within AppProvider'
    );
  }

  return ctx;
}

