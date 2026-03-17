import React from 'react';

type BadgeType = 'status' | 'priority' | 'role';

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
};

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-700',
};

const labelMap: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
};

interface BadgeProps {
  type: BadgeType;
  value: string;
  className?: string;
}

export function Badge({ type, value, className = '' }: BadgeProps) {
  const colorMap =
    type === 'status' ? statusColors : type === 'priority' ? priorityColors : roleColors;
  const colorClass = colorMap[value] ?? 'bg-gray-100 text-gray-700';
  const label = labelMap[value] ?? value;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
