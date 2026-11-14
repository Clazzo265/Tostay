import React from 'react';
import { Search } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 md:p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
        {icon || <Search className="w-6 h-6" />}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 font-display">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
};
