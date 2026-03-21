import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../modules/auth/auth-store';
import { getTasks, getTaskStats } from '../api/task-api';
import { getNotifications } from '../api/notification-api';
import { KpiCard } from './kpi-card';
import { CompletionChart } from './completion-chart';
import { ActivityFeed, ActivityItem } from './activity-feed';
import { useSocket } from '../notifications/use-socket';

interface StatusCount {
  status: string;
  count: number;
}

const STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;

export function DashboardPage() {
  const { user } = useAuthStore();
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [myTasksCount, setMyTasksCount] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // 3 requests in parallel: one aggregation query for all status counts
      // (replaces the previous 4 per-status calls), my-tasks count, notifications.
      const [statsRes, myTasksRes, notifsRes] = await Promise.all([
        getTaskStats(),
        user?.id
          ? getTasks({ assignee_id: user.id, limit: 1 })
          : Promise.resolve({ meta: { total: 0 } }),
        // limit=10 at the API level — no need to slice client-side.
        getNotifications({ limit: 10 }),
      ]);

      const counts: StatusCount[] = [
        { status: 'todo',        count: statsRes.todo },
        { status: 'in_progress', count: statsRes.in_progress },
        { status: 'review',      count: statsRes.review },
        { status: 'done',        count: statsRes.done },
      ];

      setStatusCounts(counts);
      setTotalTasks(counts.reduce((sum, c) => sum + c.count, 0));
      setMyTasksCount(myTasksRes.meta?.total ?? 0);
      setActivity(notifsRes.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time notifications
  useSocket((notification) => {
    setActivity((prev) => [notification as ActivityItem, ...prev.slice(0, 9)]);
  });

  const inProgressCount = statusCounts.find((c) => c.status === 'in_progress')?.count ?? 0;
  const doneCount = statusCounts.find((c) => c.status === 'done')?.count ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, {user?.full_name ?? 'User'}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's what's happening today.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load dashboard data. Please{' '}
          <button onClick={fetchData} className="underline font-medium">try again</button>.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Tasks" count={totalTasks} color="text-gray-700 dark:text-gray-300" />
            <KpiCard label="In Progress" count={inProgressCount} color="text-blue-600" />
            <KpiCard label="Completed" count={doneCount} color="text-green-600" />
            <KpiCard label="My Tasks" count={myTasksCount} color="text-purple-600" />
          </div>

          {/* Charts + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompletionChart data={statusCounts} />
            <ActivityFeed items={activity} />
          </div>
        </>
      )}
    </div>
  );
}
