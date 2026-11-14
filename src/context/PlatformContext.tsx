import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CAMPUS_REFERENCES,
  DEFAULT_SYSTEM_SETTINGS,
} from '../data/platformDefaults';
import {
  subscribeApprovedHostels,
  subscribePublicCampuses,
  subscribePublishedRooms,
  subscribeSystemSettings,
  subscribeUserFavorites,
  subscribeUserNotifications,
  toggleFavoriteHostel,
} from '../services/firestoreService';
import type {
  AppNotification,
  Campus,
  Favorite,
  Hostel,
  Room,
  SystemSettings,
} from '../types/domain';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'info' | 'success' | 'error';
}

interface PlatformContextValue {
  campuses: Campus[];
  hasLiveCampuses: boolean;
  hostels: Hostel[];
  rooms: Room[];
  favorites: Favorite[];
  favoriteHostelIds: Set<string>;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  compareIds: string[];
  recentlyViewedIds: string[];
  systemSettings: SystemSettings;
  isCatalogLoading: boolean;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  toggleFavorite: (hostelId: string) => Promise<void>;
  toggleCompare: (hostelId: string) => void;
  clearCompare: () => void;
  recordRecentView: (hostelId: string) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

const RECENT_STORAGE_KEY = 'tostay_recent_hostels_v1';
const COMPARE_STORAGE_KEY = 'tostay_compare_hostels_v1';

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAuthReady } = useAuth();

  const [liveCampuses, setLiveCampuses] = useState<Campus[]>([]);
  const [liveHostels, setLiveHostels] = useState<Hostel[]>([]);
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COMPARE_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]).slice(0, 3) : [];
    } catch {
      return [];
    }
  });

  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]).slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubCampuses = subscribePublicCampuses((list) => setLiveCampuses(list));
    const unsubHostels = subscribeApprovedHostels((list) => {
      setLiveHostels(list);
      setIsCatalogLoading(false);
    });
    const unsubRooms = subscribePublishedRooms((list) => setLiveRooms(list));
    const unsubSettings = subscribeSystemSettings((s) => setSystemSettings(s));

    const timer = setTimeout(() => setIsCatalogLoading(false), 1200);

    return () => {
      clearTimeout(timer);
      unsubCampuses();
      unsubHostels();
      unsubRooms();
      unsubSettings();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady || !firebaseUser) {
      setFavorites([]);
      setNotifications([]);
      return;
    }
    const unsubFavs = subscribeUserFavorites(firebaseUser.uid, setFavorites);
    const unsubNotifs = subscribeUserNotifications(firebaseUser.uid, setNotifications);
    return () => {
      unsubFavs();
      unsubNotifs();
    };
  }, [firebaseUser, isAuthReady]);

  const hasLiveCampuses = liveCampuses.length > 0;
  const campuses = useMemo(
    () => (liveCampuses.length > 0 ? liveCampuses : DEFAULT_CAMPUS_REFERENCES),
    [liveCampuses]
  );

  const hostels = liveHostels;
  const rooms = liveRooms;

  const favoriteHostelIds = useMemo(
    () => new Set(favorites.map((f) => f.hostelId)),
    [favorites]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const toggleFavorite = useCallback(
    async (hostelId: string) => {
      if (!firebaseUser) {
        pushToast({
          title: 'Sign in to save hostels',
          description: 'Create or sign into your student account to bookmark properties.',
          variant: 'info',
        });
        return;
      }
      const saved = favoriteHostelIds.has(hostelId);
      await toggleFavoriteHostel(firebaseUser.uid, hostelId, saved);
      pushToast({
        title: saved ? 'Removed from saved hostels' : 'Saved to your shortlist',
        variant: 'success',
      });
    },
    [firebaseUser, favoriteHostelIds, pushToast]
  );

  const toggleCompare = useCallback(
    (hostelId: string) => {
      setCompareIds((prev) => {
        let next: string[];
        if (prev.includes(hostelId)) {
          next = prev.filter((id) => id !== hostelId);
        } else if (prev.length >= 3) {
          pushToast({
            title: 'Compare limit reached',
            description: 'You can compare up to 3 hostels side-by-side at a time.',
            variant: 'info',
          });
          return prev;
        } else {
          next = [...prev, hostelId];
        }
        try {
          localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    },
    [pushToast]
  );

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    try {
      localStorage.removeItem(COMPARE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const recordRecentView = useCallback((hostelId: string) => {
    setRecentlyViewedIds((prev) => {
      const next = [hostelId, ...prev.filter((id) => id !== hostelId)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <PlatformContext.Provider
      value={{
        campuses,
        hasLiveCampuses,
        hostels,
        rooms,
        favorites,
        favoriteHostelIds,
        notifications,
        unreadNotificationsCount,
        compareIds,
        recentlyViewedIds,
        systemSettings,
        isCatalogLoading,
        toasts,
        pushToast,
        dismissToast,
        toggleFavorite,
        toggleCompare,
        clearCompare,
        recordRecentView,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside PlatformProvider');
  return ctx;
}
