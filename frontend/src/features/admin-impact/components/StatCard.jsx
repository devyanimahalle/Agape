import { useState } from 'react';

const COLOR_MAP = {
  blue: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100',
  },
  green: {
    border: 'border-l-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    iconBg: 'bg-green-100',
  },
  yellow: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    iconBg: 'bg-yellow-100',
  },
  red: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    iconBg: 'bg-red-100',
  },
  purple: {
    border: 'border-l-purple-500',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    iconBg: 'bg-purple-100',
  },
  teal: {
    border: 'border-l-teal-500',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    iconBg: 'bg-teal-100',
  },
  orange: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    iconBg: 'bg-orange-100',
  },
};

export default function StatCard({ title, value, subtitle, icon, color = 'blue' }) {
  const palette = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div
      className={`rounded-xl shadow-md p-6 border-l-4 ${palette.border} bg-white hover:shadow-lg transition-shadow duration-200`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-3xl font-bold ${palette.text}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-sm font-medium text-gray-600 mt-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={`w-12 h-12 rounded-lg ${palette.iconBg} flex items-center justify-center text-2xl flex-shrink-0`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
