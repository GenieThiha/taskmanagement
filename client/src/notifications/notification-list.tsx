import React from 'react';
import { markAsRead } from '../api/notification-api';
import { formatDateTime } from '../shared/utils/format-date';

export interface Notification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reference_id: string;
  reference_type: string;
}

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}

export function NotificationList({ notifications, onMarkRead }: NotificationListProps) {
  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      onMarkRead(id);
    } catch {
      // Silently ignore
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No notifications yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
            n.is_read ? 'opacity-60' : ''
          }`}
        >
          <div
            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
              n.is_read ? 'bg-gray-300' : 'bg-blue-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{n.message}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(n.created_at)}</p>
          </div>
          {!n.is_read && (
            <button
              onClick={() => handleMarkRead(n.id)}
              className="text-xs text-primary-600 hover:text-primary-800 shrink-0"
            >
              Mark read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
