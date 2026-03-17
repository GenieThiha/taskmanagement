import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../modules/auth/auth-store';
import { getTasks } from '../api/task-api';
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // All 6 requests fire in parallel — one round trip instead of two sequential waves.
      const [todoRes, inProgressRes, reviewRes, doneRes, myTasksRes, notifsRes] =
        await Promise.all([
          getTasks({ status: 'todo', limit: 1 }),
          getTasks({ status: 'in_progress', limit: 1 }),
          getTasks({ status: 'review', limit: 1 }),
          getTasks({ status: 'done', limit: 1 }),
          user?.id
            ? getTasks({ assignee_id: user.id, limit: 1 })
            : Promise.resolve({ meta: { total: 0 } }),
          getNotifications(),
        ]);

      const counts: StatusCount[] = [
        { status: 'todo', count: todoRes.meta?.total ?? 0 },
        { status: 'in_progress', count: inProgressRes.meta?.total ?? 0 },
        { status: 'review', count: reviewRes.meta?.total ?? 0 },
        { status: 'done', count: doneRes.meta?.total ?? 0 },
      ];

      setStatusCounts(counts);
      setTotalTasks(counts.reduce((sum, c) => sum + c.count, 0));
      setMyTasksCount(myTasksRes.meta?.total ?? 0);
      setActivity(notifsRes.data?.slice(0, 10) ?? []);
    } catch {
      // Ignore errors on dashboard
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
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name ?? 'User'}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening today.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Tasks" count={totalTasks} color="text-gray-700" />
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
