import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHostelInventoryRollup,
  canTransitionBookingStatus,
  doDatesOverlap,
  filterAndSortHostels,
  formatMwk,
  getPolygonCentroid,
  hasOverlappingActiveBooking,
  haversineDistanceKm,
  isAvailabilityStale,
  validateBookingDates,
} from './hostelUtils';
import type { Hostel, HostelSearchFilters, Room } from '../types/domain';

test('formatMwk formats currency and explicit payment period cleanly', () => {
  assert.equal(formatMwk(45000), 'MWK 45,000');
  assert.equal(formatMwk(45000, 'monthly'), 'MWK 45,000 per month');
  assert.equal(formatMwk(180000, 'semester'), 'MWK 180,000 per semester');
});

test('haversineDistanceKm computes realistic Rumphi corridor distance', () => {
  const campus = { lat: -11.0186, lng: 33.8574 };
  const nearby = { lat: -11.0120, lng: 33.8615 };
  const d = haversineDistanceKm(campus, nearby);
  assert.ok(d > 0.5 && d < 1.5, `Expected ~0.86km, got ${d}`);
});

test('isAvailabilityStale flags unconfirmed rooms older than 14 days', () => {
  const now = Date.UTC(2026, 10, 14);
  const recent = now - 3 * 24 * 60 * 60 * 1000;
  const old = now - 20 * 24 * 60 * 60 * 1000;
  assert.equal(isAvailabilityStale(recent, now), false);
  assert.equal(isAvailabilityStale(old, now), true);
  assert.equal(isAvailabilityStale(0, now), true);
});

test('validateBookingDates rejects inverted dates and invalid strings', () => {
  assert.equal(validateBookingDates('2026-11-20', '2026-12-20').valid, true);
  assert.equal(validateBookingDates('2026-12-20', '2026-11-20').valid, false);
  assert.equal(validateBookingDates('2026-11-20', '2026-11-20').valid, false);
  assert.equal(validateBookingDates('invalid', '2026-12-20').valid, false);
});

test('canTransitionBookingStatus enforces strict state graph and actor permissions', () => {
  assert.equal(canTransitionBookingStatus('pending', 'accepted', 'owner'), true);
  assert.equal(canTransitionBookingStatus('pending', 'completed', 'owner'), false);
  assert.equal(canTransitionBookingStatus('accepted', 'accepted', 'owner'), false);
  assert.equal(canTransitionBookingStatus('accepted', 'completed', 'owner'), true);
  assert.equal(canTransitionBookingStatus('accepted', 'declined', 'owner'), true);
  assert.equal(canTransitionBookingStatus('pending', 'accepted', 'student'), false);
  assert.equal(canTransitionBookingStatus('pending', 'cancelled', 'student'), true);
  assert.equal(canTransitionBookingStatus('accepted', 'cancelled', 'student'), false);
  assert.equal(canTransitionBookingStatus('completed', 'cancelled', 'student'), false);
  assert.equal(canTransitionBookingStatus('declined', 'accepted', 'owner'), false);
  assert.equal(canTransitionBookingStatus('completed', 'cancelled', 'admin'), true);
});

test('doDatesOverlap and hasOverlappingActiveBooking validate booking overlap and room rollups', () => {
  assert.equal(doDatesOverlap('2026-09-01', '2026-12-01', '2026-11-01', '2027-01-01'), true);
  assert.equal(doDatesOverlap('2026-09-01', '2026-10-01', '2026-10-01', '2026-12-01'), false);

  assert.equal(
    hasOverlappingActiveBooking(
      [
        {
          roomId: 'r1',
          status: 'pending',
          checkInDate: '2026-09-01',
          checkOutDate: '2026-12-01',
        },
        {
          roomId: 'r2',
          status: 'accepted',
          checkInDate: '2026-09-01',
          checkOutDate: '2026-12-01',
        },
        {
          roomId: 'r1',
          status: 'cancelled',
          checkInDate: '2026-09-01',
          checkOutDate: '2026-12-01',
        },
      ],
      'r1',
      '2026-10-01',
      '2026-12-15'
    ),
    true
  );

  assert.equal(
    hasOverlappingActiveBooking(
      [
        {
          roomId: 'r1',
          status: 'cancelled',
          checkInDate: '2026-09-01',
          checkOutDate: '2026-12-01',
        },
      ],
      'r1',
      '2026-10-01',
      '2026-12-15'
    ),
    false
  );

  const rollup = calculateHostelInventoryRollup([
    {
      id: 'r1',
      hostelId: 'h1',
      ownerId: 'o1',
      name: 'Single',
      category: 'single',
      priceMwk: 45000,
      depositMwk: 45000,
      paymentPeriod: 'monthly',
      totalUnits: 4,
      availableUnits: 3,
      isPublished: true,
      updatedAtMs: 1,
    },
    {
      id: 'r2',
      hostelId: 'h1',
      ownerId: 'o1',
      name: 'Self-Contained',
      category: 'self_contained',
      priceMwk: 75000,
      depositMwk: 75000,
      paymentPeriod: 'monthly',
      totalUnits: 2,
      availableUnits: 2,
      isPublished: true,
      updatedAtMs: 1,
    },
    {
      id: 'r3',
      hostelId: 'h1',
      ownerId: 'o1',
      name: 'Draft Room',
      category: 'shared',
      priceMwk: 20000,
      depositMwk: 0,
      paymentPeriod: 'monthly',
      totalUnits: 5,
      availableUnits: 5,
      isPublished: false,
      updatedAtMs: 1,
    },
  ]);

  assert.equal(rollup.totalAvailableRooms, 5);
  assert.equal(rollup.minPriceMwk, 45000);
  assert.equal(rollup.maxPriceMwk, 75000);
});

test('getPolygonCentroid computes geometric center', () => {
  assert.equal(getPolygonCentroid([]), null);
  const c = getPolygonCentroid([
    { lat: -11.0, lng: 33.8 },
    { lat: -11.0, lng: 33.9 },
    { lat: -11.1, lng: 33.9 },
    { lat: -11.1, lng: 33.8 },
  ]);
  assert.ok(c !== null);
  assert.ok(Math.abs(c.lat - -11.05) < 0.0001);
  assert.ok(Math.abs(c.lng - 33.85) < 0.0001);
});

test('filterAndSortHostels filters by price, facilities, verification, and sorts correctly', () => {
  const hostels: Hostel[] = [
    {
      id: 'h1',
      ownerId: 'o1',
      campusId: 'rumphi-main',
      name: 'Boma Ridge Hostel',
      description: 'Clean rooms near Rumphi town center',
      address: 'Rumphi Boma',
      area: 'Boma',
      lat: -11.016,
      lng: 33.858,
      hasCoordinates: true,
      locationStatus: 'verified',
      verificationStatus: 'verified',
      listingStatus: 'active',
      facilities: ['Electricity', 'Water', 'Security'],
      imageUrls: [],
      minPriceMwk: 45000,
      maxPriceMwk: 65000,
      paymentPeriod: 'monthly',
      depositMwk: 45000,
      totalAvailableRooms: 4,
      isFeatured: true,
      isSponsored: false,
      lastAvailabilityConfirmationMs: Date.now(),
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
    {
      id: 'h2',
      ownerId: 'o2',
      campusId: 'rumphi-main',
      name: 'Chiweta Valley Annex',
      description: 'Quiet study rooms',
      address: 'Road 4',
      area: 'Chiweta',
      hasCoordinates: false,
      locationStatus: 'unavailable',
      verificationStatus: 'pending',
      listingStatus: 'active',
      facilities: ['Water'],
      imageUrls: [],
      minPriceMwk: 30000,
      maxPriceMwk: 30000,
      paymentPeriod: 'monthly',
      depositMwk: 0,
      totalAvailableRooms: 0,
      isFeatured: false,
      isSponsored: false,
      lastAvailabilityConfirmationMs: Date.now(),
      createdAtMs: 2000,
      updatedAtMs: 2000,
    },
  ];
  const rooms: Room[] = [
    {
      id: 'r1',
      hostelId: 'h1',
      ownerId: 'o1',
      name: 'Single Study',
      category: 'single',
      priceMwk: 45000,
      depositMwk: 45000,
      paymentPeriod: 'monthly',
      totalUnits: 10,
      availableUnits: 4,
      isPublished: true,
      updatedAtMs: 1000,
    },
  ];

  const baseFilters: HostelSearchFilters = {
    query: '',
    campusId: 'all',
    area: 'all',
    minPriceMwk: null,
    maxPriceMwk: null,
    maxDistanceKm: null,
    roomCategory: 'all',
    facilities: [],
    onlyVerified: false,
    onlyAvailable: false,
    sortBy: 'price_asc',
  };

  const all = filterAndSortHostels(hostels, rooms, baseFilters, { lat: -11.0186, lng: 33.8574 });
  assert.equal(all.length, 2);
  assert.equal(all[0].id, 'h2');

  const verifiedOnly = filterAndSortHostels(
    hostels,
    rooms,
    { ...baseFilters, onlyVerified: true, facilities: ['Security'], roomCategory: 'single' },
    { lat: -11.0186, lng: 33.8574 }
  );
  assert.equal(verifiedOnly.length, 1);
  assert.equal(verifiedOnly[0].id, 'h1');
  assert.ok(verifiedOnly[0].distanceKm !== null);
});
