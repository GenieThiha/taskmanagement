import React from 'react';

interface KpiCardProps {
  label: string;
  count: number;
  color?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, count, color = 'text-primary-600', icon }: KpiCardProps) {
  return (
    <div className="card flex items-center gap-4">
      {icon && (
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gray-50 ${color}`}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`text-3xl font-bold ${color}`}>{count}</p>
      </div>
    </div>
  );
}
