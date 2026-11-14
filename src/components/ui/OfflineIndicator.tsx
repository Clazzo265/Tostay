import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="bg-amber-950 text-amber-100 border-b border-amber-800 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>
        You are currently offline. Cached listings remain viewable; bookings and live chat sync when reconnected.
      </span>
    </div>
  );
};
