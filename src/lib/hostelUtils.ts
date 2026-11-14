import type {
  BookingStatus,
  Hostel,
  HostelSearchFilters,
  LatLngLiteral,
  PaymentPeriod,
  Room,
} from '../types/domain';
import { PAYMENT_PERIOD_LABELS } from '../types/domain';

export interface HostelWithMetrics extends Hostel {
  distanceKm: number | null;
  rooms: Room[];
}

export function formatMwk(amount: number, period?: PaymentPeriod): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const formatted = new Intl.NumberFormat('en-MW').format(safe);
  if (!period) return `MWK ${formatted}`;
  return `MWK ${formatted} ${PAYMENT_PERIOD_LABELS[period]}`;
}

export function haversineDistanceKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 100) / 100;
}

export function isAvailabilityStale(
  lastConfirmedMs: number,
  nowMs: number = Date.now(),
  maxDays: number = 14
): boolean {
  if (!lastConfirmedMs || lastConfirmedMs <= 0) return true;
  const ageMs = nowMs - lastConfirmedMs;
  return ageMs > maxDays * 24 * 60 * 60 * 1000;
}

export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  if (!timestampMs) return 'Not confirmed yet';
  const diffMs = Math.max(0, nowMs - timestampMs);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestampMs).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getPolygonCentroid(coords: LatLngLiteral[] | undefined): LatLngLiteral | null {
  if (!coords || coords.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  for (const pt of coords) {
    latSum += pt.lat;
    lngSum += pt.lng;
  }
  return {
    lat: latSum / coords.length,
    lng: lngSum / coords.length,
  };
}

export function validateBookingDates(
  checkInDate: string,
  checkOutDate: string
): { valid: boolean; error?: string } {
  const start = Date.parse(checkInDate);
  const end = Date.parse(checkOutDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { valid: false, error: 'Please select valid check-in and check-out dates.' };
  }
  if (end <= start) {
    return { valid: false, error: 'Check-out date must be after check-in date.' };
  }
  return { valid: true };
}

const TERMINAL_BOOKING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'declined',
  'cancelled',
  'completed',
]);

const STUDENT_CANCELLABLE_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'pending',
  'under_review',
  'viewing_requested',
  'viewing_confirmed',
]);

const OWNER_ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['under_review', 'viewing_requested', 'viewing_confirmed', 'accepted', 'declined'],
  under_review: ['viewing_requested', 'viewing_confirmed', 'accepted', 'declined'],
  viewing_requested: ['viewing_confirmed', 'accepted', 'declined'],
  viewing_confirmed: ['accepted', 'declined'],
  accepted: ['completed', 'declined', 'cancelled'],
  declined: [],
  cancelled: [],
  completed: [],
};

export function canTransitionBookingStatus(
  current: BookingStatus,
  next: BookingStatus,
  actor: 'student' | 'owner' | 'admin'
): boolean {
  if (actor === 'admin') return true;
  if (TERMINAL_BOOKING_STATUSES.has(current)) return false;
  if (current === next) return false;

  if (actor === 'student') {
    return next === 'cancelled' && STUDENT_CANCELLABLE_STATUSES.has(current);
  }

  if (actor === 'owner') {
    return OWNER_ALLOWED_TRANSITIONS[current].includes(next);
  }

  return false;
}

export function doDatesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const s1 = Date.parse(aStart);
  const e1 = Date.parse(aEnd);
  const s2 = Date.parse(bStart);
  const e2 = Date.parse(bEnd);
  if ([s1, e1, s2, e2].some((v) => Number.isNaN(v))) return false;
  return s1 < e2 && s2 < e1;
}

const ACTIVE_BOOKING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'pending',
  'under_review',
  'viewing_requested',
  'viewing_confirmed',
  'accepted',
]);

export function hasOverlappingActiveBooking(
  bookings: ReadonlyArray<{
    roomId: string;
    status: BookingStatus;
    checkInDate: string;
    checkOutDate: string;
  }>,
  roomId: string,
  checkInDate: string,
  checkOutDate: string
): boolean {
  return bookings.some(
    (b) =>
      b.roomId === roomId &&
      ACTIVE_BOOKING_STATUSES.has(b.status) &&
      doDatesOverlap(b.checkInDate, b.checkOutDate, checkInDate, checkOutDate)
  );
}

export function calculateHostelInventoryRollup(rooms: Room[]): {
  totalAvailableRooms: number;
  minPriceMwk: number | null;
  maxPriceMwk: number | null;
} {
  const published = rooms.filter((r) => r.isPublished);
  const source = published.length > 0 ? published : rooms;
  if (source.length === 0) {
    return { totalAvailableRooms: 0, minPriceMwk: null, maxPriceMwk: null };
  }
  const totalAvailableRooms = source.reduce(
    (sum, r) => sum + Math.max(0, Math.min(r.totalUnits, r.availableUnits)),
    0
  );
  const prices = source.map((r) => r.priceMwk).filter((p) => Number.isFinite(p) && p >= 0);
  return {
    totalAvailableRooms,
    minPriceMwk: prices.length > 0 ? Math.min(...prices) : null,
    maxPriceMwk: prices.length > 0 ? Math.max(...prices) : null,
  };
}

export function filterAndSortHostels(
  hostels: Hostel[],
  rooms: Room[],
  filters: HostelSearchFilters,
  campusCenter: LatLngLiteral | null
): HostelWithMetrics[] {
  const queryLower = filters.query.trim().toLowerCase();

  const enriched: HostelWithMetrics[] = hostels.map((h) => {
    const hostelRooms = rooms.filter((r) => r.hostelId === h.id && r.isPublished);
    const distanceKm =
      campusCenter && h.hasCoordinates && typeof h.lat === 'number' && typeof h.lng === 'number'
        ? haversineDistanceKm(campusCenter, { lat: h.lat, lng: h.lng })
        : null;
    return { ...h, distanceKm, rooms: hostelRooms };
  });

  const filtered = enriched.filter((h) => {
    if (filters.campusId && filters.campusId !== 'all' && h.campusId !== filters.campusId) {
      return false;
    }
    if (filters.area && filters.area !== 'all' && h.area.toLowerCase() !== filters.area.toLowerCase()) {
      return false;
    }
    if (filters.onlyVerified && h.verificationStatus !== 'verified') {
      return false;
    }
    if (filters.onlyAvailable && h.totalAvailableRooms <= 0) {
      return false;
    }
    if (filters.minPriceMwk !== null && h.maxPriceMwk < filters.minPriceMwk) {
      return false;
    }
    if (filters.maxPriceMwk !== null && h.minPriceMwk > filters.maxPriceMwk) {
      return false;
    }
    if (filters.maxDistanceKm !== null) {
      if (h.distanceKm === null || h.distanceKm > filters.maxDistanceKm) {
        return false;
      }
    }
    if (filters.roomCategory !== 'all') {
      const hasCategory = h.rooms.some((r) => r.category === filters.roomCategory);
      if (!hasCategory) return false;
    }
    if (filters.facilities.length > 0) {
      const lowerFacs = h.facilities.map((f) => f.toLowerCase());
      const matchesAll = filters.facilities.every((req) => lowerFacs.includes(req.toLowerCase()));
      if (!matchesAll) return false;
    }
    if (queryLower.length > 0) {
      const haystack = `${h.name} ${h.area} ${h.address} ${h.description} ${h.facilities.join(' ')}`.toLowerCase();
      if (!haystack.includes(queryLower)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'price_asc':
        return a.minPriceMwk - b.minPriceMwk;
      case 'price_desc':
        return b.minPriceMwk - a.minPriceMwk;
      case 'distance_asc': {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      }
      case 'newest':
        return b.createdAtMs - a.createdAtMs;
      case 'relevance':
      default: {
        // Verified & featured first, then available rooms, then distance
        const aScore = (a.verificationStatus === 'verified' ? 4 : 0) + (a.isFeatured ? 2 : 0) + (a.totalAvailableRooms > 0 ? 1 : 0);
        const bScore = (b.verificationStatus === 'verified' ? 4 : 0) + (b.isFeatured ? 2 : 0) + (b.totalAvailableRooms > 0 ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return a.minPriceMwk - b.minPriceMwk;
      }
    }
  });

  return filtered;
}
