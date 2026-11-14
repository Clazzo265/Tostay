import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  bookingRequestSchema,
  hostelSubmissionSchema,
  reviewSchema,
  roomSchema,
  userProfileSchema,
} from './validation';

test('Dirty Dozen Schema Checks: reject role escalation, invalid IDs, oversized strings, and bad price ranges', () => {
  // 1. Self-privilege escalation to admin via profile schema
  const adminAttempt = userProfileSchema.safeParse({
    displayName: 'Mallory',
    role: 'admin',
  });
  assert.equal(adminAttempt.success, false);

  // 2. ID poisoning with path traversal characters
  const poisonedRoom = roomSchema.safeParse({
    hostelId: '../admins/hack',
    name: 'Single',
    category: 'single',
    priceMwk: 45000,
    depositMwk: 0,
    paymentPeriod: 'monthly',
    totalUnits: 5,
    availableUnits: 5,
    isPublished: true,
  });
  assert.equal(poisonedRoom.success, false);

  // 3. Available units exceeding total units
  const impossibleUnits = roomSchema.safeParse({
    hostelId: 'hostel_1',
    name: 'Single',
    category: 'single',
    priceMwk: 45000,
    depositMwk: 0,
    paymentPeriod: 'monthly',
    totalUnits: 2,
    availableUnits: 5,
    isPublished: true,
  });
  assert.equal(impossibleUnits.success, false);

  // 4. Max price lower than min price
  const badPriceRange = hostelSubmissionSchema.safeParse({
    campusId: 'rumphi-main',
    name: 'Test Hostel',
    description: 'Valid description over 10 chars',
    address: 'Rumphi Road',
    area: 'Boma',
    hasCoordinates: false,
    facilities: ['Water'],
    imageUrls: [],
    minPriceMwk: 80000,
    maxPriceMwk: 40000,
    paymentPeriod: 'monthly',
    depositMwk: 0,
    totalAvailableRooms: 3,
  });
  assert.equal(badPriceRange.success, false);

  // 5. Value poisoning: 5000-char hostel name
  const oversizedName = hostelSubmissionSchema.safeParse({
    campusId: 'rumphi-main',
    name: 'A'.repeat(200),
    description: 'Valid description over 10 chars',
    address: 'Rumphi Road',
    area: 'Boma',
    hasCoordinates: false,
    facilities: ['Water'],
    imageUrls: [],
    minPriceMwk: 40000,
    maxPriceMwk: 60000,
    paymentPeriod: 'monthly',
    depositMwk: 0,
    totalAvailableRooms: 3,
  });
  assert.equal(oversizedName.success, false);

  // 6. Inverted booking dates
  const badDates = bookingRequestSchema.safeParse({
    roomId: 'room_1',
    checkInDate: '2026-12-01',
    checkOutDate: '2026-11-01',
  });
  assert.equal(badDates.success, false);

  // 7. Out-of-bounds review rating
  const badReview = reviewSchema.safeParse({
    bookingId: 'booking_1',
    rating: 6,
    comment: 'Great hostel!',
  });
  assert.equal(badReview.success, false);
});

test('Firestore rules file preserves mandatory security invariants', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.ok(rules.includes("rules_version = '2';"));
  assert.ok(rules.includes('allow read, write: if false;'));
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(rules.includes("request.auth.token.email == 'aceclazzo360@gmail.com'"));
  assert.ok(rules.includes('function isValidId(id)'));
  assert.ok(rules.includes('match /private/{docId}'));
  assert.ok(rules.includes('match /auditLogs/{logId}'));
  assert.ok(rules.includes('affectedKeys().hasOnly'));
  // Milestone 1 hardening checks
  assert.ok(rules.includes('incoming().studentId != incoming().ownerId'));
  assert.ok(rules.includes('data.availableUnits > 0'));
  assert.ok(rules.includes('data.priceMwk'));
  assert.ok(rules.includes("reviewId == incoming().bookingId + '_' + request.auth.uid"));
  assert.ok(rules.includes('data.hostelId == incoming().hostelId'));
  assert.ok(rules.includes('data.ownerId == incoming().ownerId'));
});
