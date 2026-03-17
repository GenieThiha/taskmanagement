import React from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

const colors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
];

function getColor(name: string): string {
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface AvatarProps {
  fullName: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ fullName, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(fullName);
  const colorClass = getColor(fullName);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${sizeClasses[size]} ${colorClass} ${className}`}
      title={fullName}
      aria-label={fullName}
    >
      {initials}
    </span>
  );
}
