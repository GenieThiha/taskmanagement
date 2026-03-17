import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useThemeStore } from '../shared/stores/theme-store';

interface StatusCount {
  status: string;
  count: number;
}

interface CompletionChartProps {
  data: StatusCount[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#9ca3af',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export function CompletionChart({ data }: CompletionChartProps) {
  const { isDark } = useThemeStore();

  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] ?? '#6b7280',
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const doneCount = data.find((d) => d.status === 'done')?.count ?? 0;
  const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // Recharts renders Tooltip and Legend with hard-coded inline styles, so we
  // must pass dark-mode overrides via JS props rather than Tailwind classes.
  const tooltipStyle = isDark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
    : undefined;
  const legendStyle = isDark ? { color: '#d1d5db' } : undefined;
  const pieStroke = isDark ? '#1f2937' : '#fff';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Task Completion</h2>
        <span className="text-2xl font-bold text-green-600">{completionRate}%</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No tasks yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              strokeWidth={2}
              stroke={pieStroke}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value, 'Tasks']}
              contentStyle={tooltipStyle}
            />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
