# ToStay Firestore Security Specification

## 1. Data Invariants
1. **Self-Assigned Role Prevention**: A user creating `/users/{userId}` can only choose `'student'` or `'owner'` (never `'admin'`, and cannot set `ownerVerified: true` or `accountStatus: 'suspended'`). Admin access requires either a verified bootstrapped admin email (`aceclazzo360@gmail.com` with `email_verified == true`) or a document in `/admins/{uid}`.
2. **PII Isolation**: User emails, phone numbers, WhatsApp numbers, student IDs, and personal budgets live strictly in `/users/{userId}/private/info`, readable/writable only by the owning user or an admin.
3. **Owner Isolation & Anti-Self-Verification**: Owners can create hostels only with `ownerId == request.auth.uid`, `verificationStatus == 'pending'`, `locationStatus in ['unavailable', 'unverified']`, `isFeatured == false`, `isSponsored == false`. Only admins can set `verificationStatus == 'verified'`, `locationStatus == 'verified'`, `isFeatured`, or `isSponsored`.
4. **Master Gate on Messages**: Messages under `/conversations/{conversationId}/messages/{messageId}` must validate via `get()` on the parent conversation that `request.auth.uid` is either `studentId` or `ownerId`, and `senderId == request.auth.uid`.
5. **Booking Integrity & Terminal Locking**: Students can only create bookings with `studentId == request.auth.uid` and `status == 'pending'`. Owners can transition bookings they own (accept/decline/viewing/complete), students can only cancel their own non-terminal bookings, and terminal states (`declined`, `cancelled`, `completed`) cannot be mutated by non-admins.
6. **Review Eligibility**: Reviews can only be created when the referenced `bookingId` exists, belongs to `request.auth.uid`, and has `status == 'completed'`, with `moderationStatus == 'pending'`.
7. **Immutable Audit Trail**: `/auditLogs/{logId}` can only be created by admins and never updated or deleted.

## 2. "Dirty Dozen" Adversarial Test Payloads
1. **Self-Privilege Escalation on User Create**: `{ uid: "u1", role: "admin", ... }` -> DENIED (`role` restricted to `'student' | 'owner'`).
2. **Ghost Field Injection on Hostel Create**: `{ ownerId: "u1", verificationStatus: "verified", ... }` -> DENIED (owners must submit `'pending'`).
3. **Cross-Owner Hostel Mutation**: Owner B updates Owner A's hostel -> DENIED (`existing().ownerId == request.auth.uid`).
4. **PII Blanket Read**: Signed-in Student A reads `/users/u2/private/info` -> DENIED (`request.auth.uid == userId || isAdmin()`).
5. **Fake Booking Auto-Confirm**: Student creates booking with `status: "accepted"` -> DENIED (`incoming().status == 'pending'`).
6. **Terminal Booking Tampering**: Student updates booking after `status: "completed"` -> DENIED (terminal state locked).
7. **Unverified Email Spoofing**: Admin-matching email with `email_verified: false` attempts admin write -> DENIED (`email_verified == true` enforced).
8. **ID Poisoning**: Document ID of 200+ chars or invalid chars (`"../admin"`) -> DENIED (`isValidId()` regex + size `<= 128`).
9. **Value Poisoning on Update**: Owner sends 500KB string in `name` while changing only `affectedKeys().hasOnly(['name', 'updatedAt'])` -> DENIED (`isValidHostel()` enforces `.size() <= 120`).
10. **Non-Participant Chat Injection**: User C writes to `/conversations/conv1/messages/m1` -> DENIED (Master Gate `get()` checks `studentId` or `ownerId`).
11. **Uneligible Review Creation**: Student submits review referencing non-completed booking -> DENIED (`get()` checks `booking.status == 'completed'`).
12. **Client Timestamp Forgery**: Payload submits `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED (`incoming().createdAt == request.time`).
