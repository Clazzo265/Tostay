import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-slate-200" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-5 bg-slate-200 rounded w-4/5" />
        <div className="h-3.5 bg-slate-100 rounded w-3/5" />
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-9 bg-slate-100 rounded-lg w-24" />
        </div>
      </div>
    </div>
  );
};
