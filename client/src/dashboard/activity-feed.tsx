import React from 'react';
import { formatDateTime } from '../shared/utils/format-date';

export interface ActivityItem {
  id: string;
  message: string;
  type: string;
  created_at: string;
  is_read: boolean;
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

const typeIcons: Record<string, string> = {
  task_assigned: '📋',
  task_updated: '✏️',
  task_commented: '💬',
  task_due_soon: '⏰',
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
        <p className="text-sm text-gray-400">No recent activity.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className="text-lg shrink-0">{typeIcons[item.type] ?? '🔔'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{item.message}</p>
              <p className="text-xs text-gray-400">{formatDateTime(item.created_at)}</p>
            </div>
            {!item.is_read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
