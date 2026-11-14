import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { canTransitionBookingStatus, validateBookingDates } from '../lib/hostelUtils';
import type {
  AppNotification,
  AuditLog,
  Booking,
  BookingStatus,
  Campus,
  Conversation,
  Enquiry,
  EnquiryStatus,
  Favorite,
  Hostel,
  LatLngLiteral,
  ListingReport,
  Message,
  OwnerSubscription,
  Review,
  Room,
  SystemSettings,
  UserPrivate,
  UserPublic,
  UserRole,
  VerificationRecord,
} from '../types/domain';
import { DEFAULT_CAMPUS_REFERENCES, DEFAULT_SYSTEM_SETTINGS } from '../data/platformDefaults';

function toMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

function mapHostel(id: string, d: Record<string, unknown>): Hostel {
  return {
    id,
    ownerId: String(d.ownerId ?? ''),
    campusId: String(d.campusId ?? 'rumphi-main'),
    name: String(d.name ?? ''),
    description: String(d.description ?? ''),
    address: String(d.address ?? ''),
    area: String(d.area ?? ''),
    lat: typeof d.lat === 'number' ? d.lat : undefined,
    lng: typeof d.lng === 'number' ? d.lng : undefined,
    entranceLat: typeof d.entranceLat === 'number' ? d.entranceLat : undefined,
    entranceLng: typeof d.entranceLng === 'number' ? d.entranceLng : undefined,
    hasCoordinates: Boolean(d.hasCoordinates),
    boundaryCoordinates: Array.isArray(d.boundaryCoordinates)
      ? (d.boundaryCoordinates as LatLngLiteral[])
      : undefined,
    locationStatus: (d.locationStatus as Hostel['locationStatus']) ?? 'unavailable',
    verificationStatus: (d.verificationStatus as Hostel['verificationStatus']) ?? 'pending',
    listingStatus: (d.listingStatus as Hostel['listingStatus']) ?? 'pending_review',
    facilities: Array.isArray(d.facilities) ? d.facilities.map(String) : [],
    imageUrls: Array.isArray(d.imageUrls) ? d.imageUrls.map(String) : [],
    minPriceMwk: Number(d.minPriceMwk ?? 0),
    maxPriceMwk: Number(d.maxPriceMwk ?? 0),
    paymentPeriod: (d.paymentPeriod as Hostel['paymentPeriod']) ?? 'monthly',
    depositMwk: Number(d.depositMwk ?? 0),
    totalAvailableRooms: Number(d.totalAvailableRooms ?? 0),
    houseRules: typeof d.houseRules === 'string' ? d.houseRules : undefined,
    ownerDisplayName: typeof d.ownerDisplayName === 'string' ? d.ownerDisplayName : undefined,
    ownerWhatsapp: typeof d.ownerWhatsapp === 'string' ? d.ownerWhatsapp : undefined,
    isFeatured: Boolean(d.isFeatured),
    isSponsored: Boolean(d.isSponsored),
    lastAvailabilityConfirmationMs: toMs(d.lastAvailabilityConfirmation),
    createdAtMs: toMs(d.createdAt),
    updatedAtMs: toMs(d.updatedAt),
  };
}

function mapRoom(id: string, d: Record<string, unknown>): Room {
  return {
    id,
    hostelId: String(d.hostelId ?? ''),
    ownerId: String(d.ownerId ?? ''),
    name: String(d.name ?? ''),
    category: (d.category as Room['category']) ?? 'single',
    priceMwk: Number(d.priceMwk ?? 0),
    depositMwk: Number(d.depositMwk ?? 0),
    paymentPeriod: (d.paymentPeriod as Room['paymentPeriod']) ?? 'monthly',
    totalUnits: Number(d.totalUnits ?? 1),
    availableUnits: Number(d.availableUnits ?? 0),
    isPublished: Boolean(d.isPublished),
    description: typeof d.description === 'string' ? d.description : undefined,
    updatedAtMs: toMs(d.updatedAt),
  };
}

function mapBooking(id: string, d: Record<string, unknown>): Booking {
  return {
    id,
    studentId: String(d.studentId ?? ''),
    ownerId: String(d.ownerId ?? ''),
    hostelId: String(d.hostelId ?? ''),
    roomId: String(d.roomId ?? ''),
    hostelName: String(d.hostelName ?? ''),
    roomName: String(d.roomName ?? ''),
    studentName: String(d.studentName ?? ''),
    checkInDate: String(d.checkInDate ?? ''),
    checkOutDate: String(d.checkOutDate ?? ''),
    rentalPeriod: (d.rentalPeriod as Booking['rentalPeriod']) ?? 'monthly',
    totalAmountMwk: Number(d.totalAmountMwk ?? 0),
    status: (d.status as BookingStatus) ?? 'pending',
    notes: typeof d.notes === 'string' ? d.notes : undefined,
    createdAtMs: toMs(d.createdAt),
    updatedAtMs: toMs(d.updatedAt),
  };
}

export function subscribePublicCampuses(
  onData: (campuses: Campus[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'campuses'), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const rawName = String(d.name ?? '');
        const rawUniversity = String(d.universityName ?? '');
        const defaultRumphi = DEFAULT_CAMPUS_REFERENCES[0];
        const isLegacyRumphiName =
          docSnap.id === 'rumphi-main' &&
          (!rawName || rawName === 'Rumphi University Hub (Laws / Boma Corridor)');
        const isLegacyRumphiUniv =
          docSnap.id === 'rumphi-main' &&
          (!rawUniversity || rawUniversity === 'Target University — Rumphi');
        return {
          id: docSnap.id,
          name: isLegacyRumphiName ? defaultRumphi.name : rawName,
          universityName: isLegacyRumphiUniv ? defaultRumphi.universityName : rawUniversity,
          district: String(d.district ?? ''),
          country: String(d.country ?? 'Malawi'),
          lat: Number(d.lat ?? -11.0186),
          lng: Number(d.lng ?? 33.8574),
          isActive: Boolean(d.isActive),
          createdAtMs: toMs(d.createdAt),
        } satisfies Campus;
      });
      onData(list);
    },
    (error) => {
      console.warn('Campuses listener error:', error.message);
      onError?.(error);
    }
  );
}

export function subscribeApprovedHostels(
  onData: (hostels: Hostel[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'hostels'),
    where('listingStatus', '==', 'active'),
    where('verificationStatus', '==', 'verified')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((s) => mapHostel(s.id, s.data())));
    },
    (error) => {
      console.warn('Approved hostels listener error:', error.message);
      onError?.(error);
    }
  );
}

export function subscribePublishedRooms(
  onData: (rooms: Room[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'rooms'), where('isPublished', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((s) => mapRoom(s.id, s.data())));
    },
    (error) => {
      console.warn('Published rooms listener error:', error.message);
      onError?.(error);
    }
  );
}

export function subscribeOwnerHostels(ownerId: string, onData: (hostels: Hostel[]) => void): Unsubscribe {
  const q = query(collection(db, 'hostels'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((s) => mapHostel(s.id, s.data()))),
    (err) => handleFirestoreError(err, OperationType.LIST, 'hostels')
  );
}

export function subscribeOwnerRooms(ownerId: string, onData: (rooms: Room[]) => void): Unsubscribe {
  const q = query(collection(db, 'rooms'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((s) => mapRoom(s.id, s.data()))),
    (err) => handleFirestoreError(err, OperationType.LIST, 'rooms')
  );
}

export function subscribeAdminAllHostels(onData: (hostels: Hostel[]) => void): Unsubscribe {
  const q = query(collection(db, 'hostels'), orderBy('updatedAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((s) => mapHostel(s.id, s.data()))),
    (err) => handleFirestoreError(err, OperationType.LIST, 'hostels')
  );
}

export function subscribeUserBookings(
  uid: string,
  roleField: 'studentId' | 'ownerId',
  onData: (bookings: Booking[]) => void
): Unsubscribe {
  const q = query(collection(db, 'bookings'), where(roleField, '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((s) => mapBooking(s.id, s.data()));
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
  );
}

export function subscribeAdminAllBookings(onData: (bookings: Booking[]) => void): Unsubscribe {
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((s) => mapBooking(s.id, s.data()))),
    (err) => handleFirestoreError(err, OperationType.LIST, 'bookings')
  );
}

export function subscribeUserEnquiries(
  uid: string,
  roleField: 'studentId' | 'ownerId',
  onData: (enquiries: Enquiry[]) => void
): Unsubscribe {
  const q = query(collection(db, 'enquiries'), where(roleField, '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          studentId: String(d.studentId ?? ''),
          ownerId: String(d.ownerId ?? ''),
          hostelId: String(d.hostelId ?? ''),
          hostelName: String(d.hostelName ?? ''),
          studentName: String(d.studentName ?? ''),
          type: (d.type as Enquiry['type']) ?? 'general',
          subject: String(d.subject ?? ''),
          message: String(d.message ?? ''),
          preferredDate: typeof d.preferredDate === 'string' ? d.preferredDate : undefined,
          status: (d.status as EnquiryStatus) ?? 'open',
          ownerReply: typeof d.ownerReply === 'string' ? d.ownerReply : undefined,
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        } satisfies Enquiry;
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'enquiries')
  );
}

export function subscribeUserConversations(
  uid: string,
  roleField: 'studentId' | 'ownerId',
  onData: (convos: Conversation[]) => void
): Unsubscribe {
  const q = query(collection(db, 'conversations'), where(roleField, '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          studentId: String(d.studentId ?? ''),
          ownerId: String(d.ownerId ?? ''),
          hostelId: String(d.hostelId ?? ''),
          hostelName: String(d.hostelName ?? ''),
          studentName: String(d.studentName ?? ''),
          ownerName: String(d.ownerName ?? ''),
          lastMessage: String(d.lastMessage ?? ''),
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        } satisfies Conversation;
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
  );
}

export function subscribeConversationMessages(
  conversationId: string,
  onData: (messages: Message[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((s) => {
          const d = s.data();
          return {
            id: s.id,
            senderId: String(d.senderId ?? ''),
            body: String(d.body ?? ''),
            read: Boolean(d.read),
            createdAtMs: toMs(d.createdAt),
          } satisfies Message;
        })
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`)
  );
}

export function subscribeUserFavorites(uid: string, onData: (favs: Favorite[]) => void): Unsubscribe {
  const q = query(collection(db, 'favorites'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((s) => ({
          id: s.id,
          userId: String(s.data().userId ?? ''),
          hostelId: String(s.data().hostelId ?? ''),
          createdAtMs: toMs(s.data().createdAt),
        }))
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'favorites')
  );
}

export function subscribeUserNotifications(
  uid: string,
  onData: (items: AppNotification[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          userId: String(d.userId ?? ''),
          title: String(d.title ?? ''),
          body: String(d.body ?? ''),
          category: (d.category as AppNotification['category']) ?? 'system',
          link: typeof d.link === 'string' ? d.link : undefined,
          read: Boolean(d.read),
          createdAtMs: toMs(d.createdAt),
        } satisfies AppNotification;
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
  );
}

export function subscribeApprovedReviews(
  hostelId: string,
  onData: (reviews: Review[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'reviews'),
    where('hostelId', '==', hostelId),
    where('moderationStatus', '==', 'approved')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((s) => {
          const d = s.data();
          return {
            id: s.id,
            studentId: String(d.studentId ?? ''),
            studentName: String(d.studentName ?? ''),
            hostelId: String(d.hostelId ?? ''),
            bookingId: String(d.bookingId ?? ''),
            rating: Number(d.rating ?? 5),
            comment: String(d.comment ?? ''),
            moderationStatus: (d.moderationStatus as Review['moderationStatus']) ?? 'approved',
            createdAtMs: toMs(d.createdAt),
          } satisfies Review;
        })
      );
    },
    (error) => {
      console.warn('Reviews listener info:', error.message);
      onError?.(error);
    }
  );
}

export function subscribeSystemSettings(onData: (settings: SystemSettings) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'systemSettings', 'global'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SYSTEM_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        featuredEnabled: Boolean(d.featuredEnabled ?? true),
        sponsoredLabelText: String(d.sponsoredLabelText ?? 'Sponsored Placement'),
        bookingServiceFeePercent: Number(d.bookingServiceFeePercent ?? 0),
        maintenanceMode: Boolean(d.maintenanceMode ?? false),
        updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
        updatedAtMs: toMs(d.updatedAt),
      });
    },
    () => onData(DEFAULT_SYSTEM_SETTINGS)
  );
}

export async function ensureUserDocuments(params: {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  preferredRole?: 'student' | 'owner';
}): Promise<{ pub: UserPublic; priv: UserPrivate }> {
  const pubRef = doc(db, 'users', params.uid);
  const privRef = doc(db, 'users', params.uid, 'private', 'info');

  try {
    const pubSnap = await getDoc(pubRef);
    const privSnap = await getDoc(privRef);

    if (!pubSnap.exists()) {
      const role: UserRole = params.preferredRole ?? 'student';
      const pubPayload: Record<string, unknown> = {
        uid: params.uid,
        displayName: params.displayName.slice(0, 100) || 'ToStay User',
        role,
        accountStatus: 'active',
        ownerVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (params.photoUrl) pubPayload.photoUrl = params.photoUrl.slice(0, 500);
      await setDoc(pubRef, pubPayload);
    }

    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid: params.uid,
        email: params.email.slice(0, 200),
        updatedAt: serverTimestamp(),
      });
    }

    const finalPubSnap = await getDoc(pubRef);
    const finalPrivSnap = await getDoc(privRef);
    const pd = finalPubSnap.data() ?? {};
    const prd = finalPrivSnap.data() ?? {};

    return {
      pub: {
        uid: params.uid,
        displayName: String(pd.displayName ?? params.displayName),
        role: (pd.role as UserRole) ?? 'student',
        photoUrl: typeof pd.photoUrl === 'string' ? pd.photoUrl : undefined,
        accountStatus: (pd.accountStatus as UserPublic['accountStatus']) ?? 'active',
        ownerVerified: Boolean(pd.ownerVerified),
        universityName: typeof pd.universityName === 'string' ? pd.universityName : undefined,
        createdAtMs: toMs(pd.createdAt),
        updatedAtMs: toMs(pd.updatedAt),
      },
      priv: {
        uid: params.uid,
        email: String(prd.email ?? params.email),
        phone: typeof prd.phone === 'string' ? prd.phone : undefined,
        whatsapp: typeof prd.whatsapp === 'string' ? prd.whatsapp : undefined,
        studentIdNumber: typeof prd.studentIdNumber === 'string' ? prd.studentIdNumber : undefined,
        businessName: typeof prd.businessName === 'string' ? prd.businessName : undefined,
        preferredCampusId: typeof prd.preferredCampusId === 'string' ? prd.preferredCampusId : undefined,
        maxBudgetMwk: typeof prd.maxBudgetMwk === 'number' ? prd.maxBudgetMwk : undefined,
        preferredRoomType: typeof prd.preferredRoomType === 'string' ? prd.preferredRoomType : undefined,
        updatedAtMs: toMs(prd.updatedAt),
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateUserProfileAndPreferences(
  uid: string,
  email: string,
  updates: {
    displayName: string;
    role: 'student' | 'owner';
    universityName?: string;
    phone?: string;
    whatsapp?: string;
    studentIdNumber?: string;
    businessName?: string;
    preferredCampusId?: string;
    maxBudgetMwk?: number;
    preferredRoomType?: string;
  }
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const pubUpdate: Record<string, unknown> = {
      displayName: updates.displayName.trim().slice(0, 100),
      role: updates.role,
      updatedAt: serverTimestamp(),
    };
    if (updates.universityName) {
      pubUpdate.universityName = updates.universityName.trim().slice(0, 150);
    }
    batch.update(doc(db, 'users', uid), pubUpdate);

    const privPayload: Record<string, unknown> = {
      uid,
      updatedAt: serverTimestamp(),
    };
    if (email.trim().length >= 3) {
      privPayload.email = email.trim().slice(0, 200);
    }
    if (updates.phone !== undefined) privPayload.phone = updates.phone.trim().slice(0, 32);
    if (updates.whatsapp !== undefined) privPayload.whatsapp = updates.whatsapp.trim().slice(0, 32);
    if (updates.studentIdNumber !== undefined) {
      privPayload.studentIdNumber = updates.studentIdNumber.trim().slice(0, 64);
    }
    if (updates.businessName !== undefined) {
      privPayload.businessName = updates.businessName.trim().slice(0, 120);
    }
    if (updates.preferredCampusId !== undefined) {
      privPayload.preferredCampusId = updates.preferredCampusId.trim().slice(0, 64);
    }
    if (typeof updates.maxBudgetMwk === 'number') {
      privPayload.maxBudgetMwk = updates.maxBudgetMwk;
    }
    if (updates.preferredRoomType !== undefined) {
      privPayload.preferredRoomType = updates.preferredRoomType.trim().slice(0, 40);
    }

    batch.set(doc(db, 'users', uid, 'private', 'info'), privPayload, { merge: true });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function toggleFavoriteHostel(
  uid: string,
  hostelId: string,
  currentlySaved: boolean
): Promise<void> {
  const favId = `${uid}_${hostelId}`;
  const path = `favorites/${favId}`;
  try {
    if (currentlySaved) {
      await deleteDoc(doc(db, 'favorites', favId));
    } else {
      await setDoc(doc(db, 'favorites', favId), {
        userId: uid,
        hostelId,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createNotificationRecord(params: {
  userId: string;
  title: string;
  body: string;
  category: AppNotification['category'];
  link?: string;
}): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      userId: params.userId,
      title: params.title.slice(0, 140),
      body: params.body.slice(0, 500),
      category: params.category,
      read: false,
      createdAt: serverTimestamp(),
    };
    if (params.link) payload.link = params.link.slice(0, 200);
    await addDoc(collection(db, 'notifications'), payload);
  } catch (err) {
    console.warn('Notification creation skipped:', err);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function createBookingRequest(params: {
  studentId: string;
  studentName: string;
  ownerId: string;
  hostelId: string;
  hostelName: string;
  roomId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  rentalPeriod: Booking['rentalPeriod'];
  totalAmountMwk: number;
  notes?: string;
}): Promise<string> {
  if (params.studentId === params.ownerId) {
    throw new Error('Property owners cannot submit booking requests for their own listings.');
  }
  const dateCheck = validateBookingDates(params.checkInDate, params.checkOutDate);
  if (!dateCheck.valid) {
    throw new Error(dateCheck.error || 'Invalid booking check-in or check-out dates.');
  }

  try {
    const payload: Record<string, unknown> = {
      studentId: params.studentId,
      ownerId: params.ownerId,
      hostelId: params.hostelId,
      roomId: params.roomId,
      hostelName: params.hostelName.slice(0, 120),
      roomName: params.roomName.slice(0, 100),
      studentName: params.studentName.slice(0, 100),
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      rentalPeriod: params.rentalPeriod,
      totalAmountMwk: params.totalAmountMwk,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.notes?.trim()) payload.notes = params.notes.trim().slice(0, 800);
    const ref = await addDoc(collection(db, 'bookings'), payload);
    await createNotificationRecord({
      userId: params.ownerId,
      title: 'New Booking Request',
      body: `${params.studentName} requested ${params.roomName} at ${params.hostelName}.`,
      category: 'booking',
      link: '/dashboard/owner',
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'bookings');
  }
}

export async function updateBookingStatusAsStudent(bookingId: string): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const bookingRef = doc(db, 'bookings', bookingId);
      const bSnap = await tx.get(bookingRef);
      if (!bSnap.exists()) {
        throw new Error('Booking request no longer exists.');
      }
      const currentStatus = String(bSnap.data().status ?? 'pending') as BookingStatus;
      if (!canTransitionBookingStatus(currentStatus, 'cancelled', 'student')) {
        throw new Error(
          currentStatus === 'accepted'
            ? 'This reservation is already accepted. Please message the property owner to release the room.'
            : `Cannot cancel a booking that is already ${currentStatus.replace('_', ' ')}.`
        );
      }
      tx.update(bookingRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Booking request no longer exists') ||
        err.message.includes('Cannot cancel') ||
        err.message.includes('already accepted'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
  }
}

/**
 * Atomic Firestore Transaction: enforces state transitions and synchronizes
 * room/hostel inventory on acceptance or post-acceptance release.
 */
export async function updateBookingStatusAsOwner(
  booking: Booking,
  nextStatus: BookingStatus
): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const bookingRef = doc(db, 'bookings', booking.id);
      const roomRef = doc(db, 'rooms', booking.roomId);
      const hostelRef = doc(db, 'hostels', booking.hostelId);

      const bSnap = await tx.get(bookingRef);
      if (!bSnap.exists()) throw new Error('Booking no longer exists.');

      const currentStatus = String(bSnap.data().status ?? 'pending') as BookingStatus;
      if (!canTransitionBookingStatus(currentStatus, nextStatus, 'owner')) {
        throw new Error(
          `Cannot transition booking from ${currentStatus.replace('_', ' ')} to ${nextStatus.replace('_', ' ')}.`
        );
      }

      const needsUnitDecrement = nextStatus === 'accepted' && currentStatus !== 'accepted';
      const needsUnitRestore =
        currentStatus === 'accepted' && (nextStatus === 'declined' || nextStatus === 'cancelled');

      if (needsUnitDecrement || needsUnitRestore) {
        const [rSnap, hSnap] = await Promise.all([tx.get(roomRef), tx.get(hostelRef)]);
        if (!rSnap.exists()) throw new Error('Room category no longer exists.');
        if (!hSnap.exists()) throw new Error('Hostel listing no longer exists.');

        const currentAvail = Number(rSnap.data().availableUnits ?? 0);
        const totalUnits = Number(rSnap.data().totalUnits ?? currentAvail);
        const hostelAvail = Number(hSnap.data().totalAvailableRooms ?? 0);

        if (needsUnitDecrement) {
          if (currentAvail <= 0) {
            throw new Error('No available units left in this room category. Cannot accept booking.');
          }
          tx.update(roomRef, {
            availableUnits: currentAvail - 1,
            updatedAt: serverTimestamp(),
          });
          tx.update(hostelRef, {
            totalAvailableRooms: Math.max(0, hostelAvail - 1),
            lastAvailabilityConfirmation: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (needsUnitRestore) {
          const restoredAvail = Math.min(totalUnits, currentAvail + 1);
          const restoredDelta = restoredAvail - currentAvail;
          tx.update(roomRef, {
            availableUnits: restoredAvail,
            updatedAt: serverTimestamp(),
          });
          tx.update(hostelRef, {
            totalAvailableRooms: Math.max(0, hostelAvail + restoredDelta),
            lastAvailabilityConfirmation: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      tx.update(bookingRef, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    });

    await createNotificationRecord({
      userId: booking.studentId,
      title: `Booking ${nextStatus.replace('_', ' ')}`,
      body: `Your request for ${booking.roomName} at ${booking.hostelName} is now ${nextStatus.replace('_', ' ')}.`,
      category: 'booking',
      link: '/dashboard/student',
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('No available units left') ||
        err.message.includes('Cannot transition booking') ||
        err.message.includes('no longer exists'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `bookings/${booking.id}`);
  }
}

export async function createEnquiryRequest(params: {
  studentId: string;
  studentName: string;
  ownerId: string;
  hostelId: string;
  hostelName: string;
  type: Enquiry['type'];
  subject: string;
  message: string;
  preferredDate?: string;
}): Promise<string> {
  try {
    const payload: Record<string, unknown> = {
      studentId: params.studentId,
      ownerId: params.ownerId,
      hostelId: params.hostelId,
      hostelName: params.hostelName.slice(0, 120),
      studentName: params.studentName.slice(0, 100),
      type: params.type,
      subject: params.subject.trim().slice(0, 140),
      message: params.message.trim().slice(0, 1500),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.preferredDate) payload.preferredDate = params.preferredDate;
    const ref = await addDoc(collection(db, 'enquiries'), payload);

    await createNotificationRecord({
      userId: params.ownerId,
      title: params.type === 'viewing' ? 'New Viewing Request' : 'New Student Enquiry',
      body: `${params.studentName}: ${params.subject.slice(0, 80)}`,
      category: params.type === 'viewing' ? 'viewing' : 'message',
      link: '/dashboard/owner',
    });
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'enquiries');
  }
}

export async function replyToEnquiry(
  enquiry: Enquiry,
  reply: string,
  status: EnquiryStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, 'enquiries', enquiry.id), {
      ownerReply: reply.trim().slice(0, 1500),
      status,
      updatedAt: serverTimestamp(),
    });
    await createNotificationRecord({
      userId: enquiry.studentId,
      title: 'Owner Replied to Your Enquiry',
      body: `Update on ${enquiry.hostelName}: ${reply.slice(0, 90)}`,
      category: enquiry.type === 'viewing' ? 'viewing' : 'message',
      link: '/dashboard/student',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `enquiries/${enquiry.id}`);
  }
}

export async function startOrGetConversation(params: {
  studentId: string;
  studentName: string;
  ownerId: string;
  ownerName: string;
  hostelId: string;
  hostelName: string;
  initialMessage: string;
}): Promise<string> {
  const convId = `${params.studentId}_${params.hostelId}`;
  const convRef = doc(db, 'conversations', convId);
  try {
    const snap = await getDoc(convRef);
    const batch = writeBatch(db);
    if (!snap.exists()) {
      batch.set(convRef, {
        studentId: params.studentId,
        ownerId: params.ownerId,
        hostelId: params.hostelId,
        hostelName: params.hostelName.slice(0, 120),
        studentName: params.studentName.slice(0, 100),
        ownerName: params.ownerName.slice(0, 100),
        lastMessage: params.initialMessage.trim().slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(convRef, {
        lastMessage: params.initialMessage.trim().slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    }
    const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
    batch.set(msgRef, {
      senderId: params.studentId,
      body: params.initialMessage.trim().slice(0, 2000),
      read: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    await createNotificationRecord({
      userId: params.ownerId,
      title: `Message about ${params.hostelName}`,
      body: `${params.studentName}: ${params.initialMessage.slice(0, 100)}`,
      category: 'message',
      link: '/dashboard/owner',
    });
    return convId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `conversations/${convId}`);
  }
}

export async function sendConversationMessage(
  conversation: Conversation,
  senderId: string,
  body: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const msgRef = doc(collection(db, 'conversations', conversation.id, 'messages'));
    batch.set(msgRef, {
      senderId,
      body: body.trim().slice(0, 2000),
      read: false,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'conversations', conversation.id), {
      lastMessage: body.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const recipientId = senderId === conversation.studentId ? conversation.ownerId : conversation.studentId;
    await createNotificationRecord({
      userId: recipientId,
      title: `New message on ${conversation.hostelName}`,
      body: body.trim().slice(0, 120),
      category: 'message',
      link: senderId === conversation.studentId ? '/dashboard/owner' : '/dashboard/student',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `conversations/${conversation.id}/messages`);
  }
}

export async function submitListingReport(params: {
  reporterId: string;
  hostelId: string;
  reason: string;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'reports'), {
      reporterId: params.reporterId,
      hostelId: params.hostelId,
      reason: params.reason.trim().slice(0, 120),
      details: params.details.trim().slice(0, 1500),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'reports');
  }
}

export async function submitCompletedStayReview(params: {
  studentId: string;
  studentName: string;
  hostelId: string;
  bookingId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const reviewId = `${params.bookingId}_${params.studentId}`;
  const reviewRef = doc(db, 'reviews', reviewId);
  try {
    const existing = await getDoc(reviewRef);
    if (existing.exists()) {
      throw new Error('You have already submitted a review for this completed stay.');
    }
    await setDoc(reviewRef, {
      studentId: params.studentId,
      studentName: params.studentName.slice(0, 100),
      hostelId: params.hostelId,
      bookingId: params.bookingId,
      rating: params.rating,
      comment: params.comment.trim().slice(0, 1500),
      moderationStatus: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already submitted a review')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
  }
}

export async function createOwnerHostel(params: {
  ownerId: string;
  ownerDisplayName: string;
  ownerWhatsapp?: string;
  campusId: string;
  name: string;
  description: string;
  address: string;
  area: string;
  hasCoordinates: boolean;
  lat?: number;
  lng?: number;
  entranceLat?: number;
  entranceLng?: number;
  boundaryCoordinates?: LatLngLiteral[];
  facilities: string[];
  imageUrls: string[];
  minPriceMwk: number;
  maxPriceMwk: number;
  paymentPeriod: Hostel['paymentPeriod'];
  depositMwk: number;
  totalAvailableRooms: number;
  houseRules?: string;
  submitForReview: boolean;
}): Promise<string> {
  try {
    const payload: Record<string, unknown> = {
      ownerId: params.ownerId,
      campusId: params.campusId,
      name: params.name.trim().slice(0, 120),
      description: params.description.trim().slice(0, 2500),
      address: params.address.trim().slice(0, 250),
      area: params.area.trim().slice(0, 100),
      hasCoordinates: params.hasCoordinates,
      locationStatus: params.hasCoordinates ? 'unverified' : 'unavailable',
      verificationStatus: 'pending',
      listingStatus: params.submitForReview ? 'pending_review' : 'draft',
      facilities: params.facilities.slice(0, 20),
      imageUrls: params.imageUrls.slice(0, 10),
      minPriceMwk: params.minPriceMwk,
      maxPriceMwk: params.maxPriceMwk,
      paymentPeriod: params.paymentPeriod,
      depositMwk: params.depositMwk,
      totalAvailableRooms: params.totalAvailableRooms,
      ownerDisplayName: params.ownerDisplayName.slice(0, 100),
      isFeatured: false,
      isSponsored: false,
      lastAvailabilityConfirmation: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.hasCoordinates && typeof params.lat === 'number' && typeof params.lng === 'number') {
      payload.lat = params.lat;
      payload.lng = params.lng;
    }
    if (typeof params.entranceLat === 'number' && typeof params.entranceLng === 'number') {
      payload.entranceLat = params.entranceLat;
      payload.entranceLng = params.entranceLng;
    }
    if (params.boundaryCoordinates && params.boundaryCoordinates.length > 0) {
      payload.boundaryCoordinates = params.boundaryCoordinates.slice(0, 25);
    }
    if (params.houseRules?.trim()) payload.houseRules = params.houseRules.trim().slice(0, 1500);
    if (params.ownerWhatsapp?.trim()) payload.ownerWhatsapp = params.ownerWhatsapp.trim().slice(0, 32);

    const ref = await addDoc(collection(db, 'hostels'), payload);

    if (params.submitForReview) {
      await addDoc(collection(db, 'verificationRecords'), {
        targetType: 'hostel',
        targetId: ref.id,
        ownerId: params.ownerId,
        submittedNotes: `New property submitted: ${params.name}`,
        evidenceSummary: params.hasCoordinates ? 'GPS coordinates attached for satellite audit' : 'Awaiting GPS verification',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return ref.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'hostels');
  }
}

export async function confirmHostelAvailability(hostelId: string, totalAvailableRooms: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'hostels', hostelId), {
      totalAvailableRooms,
      lastAvailabilityConfirmation: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `hostels/${hostelId}`);
  }
}

export async function createRoomCategory(params: {
  hostelId: string;
  ownerId: string;
  name: string;
  category: Room['category'];
  priceMwk: number;
  depositMwk: number;
  paymentPeriod: Room['paymentPeriod'];
  totalUnits: number;
  availableUnits: number;
  isPublished: boolean;
  description?: string;
}): Promise<string> {
  try {
    const roomRef = doc(collection(db, 'rooms'));
    await runTransaction(db, async (tx) => {
      const hostelRef = doc(db, 'hostels', params.hostelId);
      const hSnap = await tx.get(hostelRef);
      if (!hSnap.exists()) throw new Error('Hostel listing not found.');

      const payload: Record<string, unknown> = {
        hostelId: params.hostelId,
        ownerId: params.ownerId,
        name: params.name.trim().slice(0, 100),
        category: params.category,
        priceMwk: params.priceMwk,
        depositMwk: params.depositMwk,
        paymentPeriod: params.paymentPeriod,
        totalUnits: params.totalUnits,
        availableUnits: params.availableUnits,
        isPublished: params.isPublished,
        updatedAt: serverTimestamp(),
      };
      if (params.description?.trim()) payload.description = params.description.trim().slice(0, 600);
      tx.set(roomRef, payload);

      if (params.isPublished && params.availableUnits > 0) {
        const currentTotal = Number(hSnap.data().totalAvailableRooms ?? 0);
        tx.update(hostelRef, {
          totalAvailableRooms: currentTotal + params.availableUnits,
          lastAvailabilityConfirmation: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    return roomRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'rooms');
  }
}

export async function updateRoomAvailability(roomId: string, availableUnits: number): Promise<void> {
  try {
    await runTransaction(db, async (tx) => {
      const roomRef = doc(db, 'rooms', roomId);
      const rSnap = await tx.get(roomRef);
      if (!rSnap.exists()) throw new Error('Room category no longer exists.');

      const oldAvail = Number(rSnap.data().availableUnits ?? 0);
      const totalUnits = Number(rSnap.data().totalUnits ?? oldAvail);
      const nextAvail = Math.max(0, Math.min(totalUnits, availableUnits));
      const hostelId = String(rSnap.data().hostelId ?? '');
      const delta = nextAvail - oldAvail;

      if (hostelId && delta !== 0) {
        const hostelRef = doc(db, 'hostels', hostelId);
        const hSnap = await tx.get(hostelRef);
        if (hSnap.exists()) {
          const currentTotal = Number(hSnap.data().totalAvailableRooms ?? 0);
          tx.update(hostelRef, {
            totalAvailableRooms: Math.max(0, currentTotal + delta),
            lastAvailabilityConfirmation: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      tx.update(roomRef, {
        availableUnits: nextAvail,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function updateOwnerHostel(
  existing: Hostel,
  updates: {
    name: string;
    description: string;
    address: string;
    area: string;
    hasCoordinates: boolean;
    lat?: number;
    lng?: number;
    entranceLat?: number;
    entranceLng?: number;
    boundaryCoordinates?: LatLngLiteral[];
    facilities: string[];
    imageUrls: string[];
    minPriceMwk: number;
    maxPriceMwk: number;
    paymentPeriod: Hostel['paymentPeriod'];
    depositMwk: number;
    totalAvailableRooms: number;
    houseRules?: string;
    ownerDisplayName?: string;
    ownerWhatsapp?: string;
    listingStatus?: 'draft' | 'pending_review';
  }
): Promise<void> {
  try {
    const coordsChanged =
      updates.hasCoordinates !== existing.hasCoordinates ||
      updates.lat !== existing.lat ||
      updates.lng !== existing.lng ||
      updates.entranceLat !== existing.entranceLat ||
      updates.entranceLng !== existing.entranceLng ||
      JSON.stringify(updates.boundaryCoordinates ?? []) !==
        JSON.stringify(existing.boundaryCoordinates ?? []);

    const payload: Record<string, unknown> = {
      name: updates.name.trim().slice(0, 120),
      description: updates.description.trim().slice(0, 2500),
      address: updates.address.trim().slice(0, 250),
      area: updates.area.trim().slice(0, 100),
      hasCoordinates: updates.hasCoordinates,
      locationStatus: coordsChanged
        ? updates.hasCoordinates
          ? 'unverified'
          : 'unavailable'
        : existing.locationStatus,
      facilities: updates.facilities.slice(0, 20),
      imageUrls: updates.imageUrls.slice(0, 10),
      minPriceMwk: updates.minPriceMwk,
      maxPriceMwk: updates.maxPriceMwk,
      paymentPeriod: updates.paymentPeriod,
      depositMwk: updates.depositMwk,
      totalAvailableRooms: updates.totalAvailableRooms,
      lastAvailabilityConfirmation: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (updates.listingStatus) {
      payload.listingStatus = updates.listingStatus;
      if (existing.verificationStatus === 'rejected' && updates.listingStatus === 'pending_review') {
        payload.verificationStatus = 'pending';
      }
    }
    if (updates.hasCoordinates && typeof updates.lat === 'number' && typeof updates.lng === 'number') {
      payload.lat = updates.lat;
      payload.lng = updates.lng;
    } else if (!updates.hasCoordinates) {
      payload.lat = deleteField();
      payload.lng = deleteField();
      payload.entranceLat = deleteField();
      payload.entranceLng = deleteField();
      payload.boundaryCoordinates = deleteField();
    }
    if (updates.hasCoordinates && typeof updates.entranceLat === 'number' && typeof updates.entranceLng === 'number') {
      payload.entranceLat = updates.entranceLat;
      payload.entranceLng = updates.entranceLng;
    }
    if (updates.hasCoordinates && updates.boundaryCoordinates && updates.boundaryCoordinates.length > 0) {
      payload.boundaryCoordinates = updates.boundaryCoordinates.slice(0, 25);
    }
    if (updates.houseRules?.trim()) payload.houseRules = updates.houseRules.trim().slice(0, 1500);
    if (updates.ownerDisplayName?.trim()) {
      payload.ownerDisplayName = updates.ownerDisplayName.trim().slice(0, 100);
    }
    if (updates.ownerWhatsapp?.trim()) {
      payload.ownerWhatsapp = updates.ownerWhatsapp.trim().slice(0, 32);
    }

    await updateDoc(doc(db, 'hostels', existing.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `hostels/${existing.id}`);
  }
}

export async function ensureOwnerFreeSubscription(ownerId: string): Promise<OwnerSubscription> {
  const subRef = doc(db, 'subscriptions', ownerId);
  try {
    const snap = await getDoc(subRef);
    if (!snap.exists()) {
      await setDoc(subRef, {
        ownerId,
        plan: 'free',
        status: 'active',
        priceMwk: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id: ownerId,
        ownerId,
        plan: 'free',
        status: 'active',
        priceMwk: 0,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
    }
    const d = snap.data();
    return {
      id: snap.id,
      ownerId: String(d.ownerId ?? ownerId),
      plan: (d.plan as OwnerSubscription['plan']) ?? 'free',
      status: (d.status as OwnerSubscription['status']) ?? 'active',
      priceMwk: Number(d.priceMwk ?? 0),
      createdAtMs: toMs(d.createdAt),
      updatedAtMs: toMs(d.updatedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `subscriptions/${ownerId}`);
  }
}

// ADMIN OPERATIONS

export async function initializeCampusAndSettings(adminUid: string): Promise<void> {
  try {
    const existingSnaps = await Promise.all(
      DEFAULT_CAMPUS_REFERENCES.map((c) => getDoc(doc(db, 'campuses', c.id)))
    );

    const batch = writeBatch(db);
    DEFAULT_CAMPUS_REFERENCES.forEach((c, idx) => {
      const campusRef = doc(db, 'campuses', c.id);
      if (!existingSnaps[idx].exists()) {
        batch.set(campusRef, {
          id: c.id,
          name: c.name,
          universityName: c.universityName,
          district: c.district,
          country: c.country,
          lat: c.lat,
          lng: c.lng,
          isActive: c.isActive,
          createdAt: serverTimestamp(),
        });
      } else {
        batch.update(campusRef, {
          name: c.name,
          universityName: c.universityName,
          district: c.district,
          country: c.country,
          lat: c.lat,
          lng: c.lng,
          isActive: c.isActive,
        });
      }
    });

    batch.set(doc(db, 'systemSettings', 'global'), {
      featuredEnabled: DEFAULT_SYSTEM_SETTINGS.featuredEnabled,
      sponsoredLabelText: DEFAULT_SYSTEM_SETTINGS.sponsoredLabelText,
      bookingServiceFeePercent: DEFAULT_SYSTEM_SETTINGS.bookingServiceFeePercent,
      maintenanceMode: DEFAULT_SYSTEM_SETTINGS.maintenanceMode,
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, 'auditLogs')), {
      actorId: adminUid,
      action: 'INITIALIZE_PLATFORM_DEFAULTS',
      targetCollection: 'campuses',
      targetId: 'rumphi-main',
      summary: 'Initialized University of Livingstonia, Rumphi Campus reference and global system settings.',
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'campuses');
  }
}

export async function adminVerifyHostel(params: {
  adminUid: string;
  hostel: Hostel;
  approve: boolean;
  locationStatus: Hostel['locationStatus'];
  lat?: number;
  lng?: number;
  entranceLat?: number;
  entranceLng?: number;
  boundaryCoordinates?: LatLngLiteral[];
  notes: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const hostelRef = doc(db, 'hostels', params.hostel.id);

    const updateData: Record<string, unknown> = {
      verificationStatus: params.approve ? 'verified' : 'rejected',
      listingStatus: params.approve ? 'active' : 'draft',
      locationStatus: params.locationStatus,
      updatedAt: serverTimestamp(),
    };
    if (typeof params.lat === 'number' && typeof params.lng === 'number') {
      updateData.lat = params.lat;
      updateData.lng = params.lng;
      updateData.hasCoordinates = true;
    }
    if (typeof params.entranceLat === 'number' && typeof params.entranceLng === 'number') {
      updateData.entranceLat = params.entranceLat;
      updateData.entranceLng = params.entranceLng;
    }
    if (params.boundaryCoordinates && params.boundaryCoordinates.length >= 3) {
      updateData.boundaryCoordinates = params.boundaryCoordinates.slice(0, 25);
    }

    batch.update(hostelRef, updateData);

    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, {
      actorId: params.adminUid,
      action: params.approve ? 'HOSTEL_VERIFIED' : 'HOSTEL_REJECTED',
      targetCollection: 'hostels',
      targetId: params.hostel.id,
      summary: `${params.approve ? 'Verified' : 'Rejected'} ${params.hostel.name} (location: ${params.locationStatus}). ${params.notes}`.slice(0, 500),
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    await createNotificationRecord({
      userId: params.hostel.ownerId,
      title: params.approve ? 'Property Verified & Published' : 'Property Verification Needs Changes',
      body: `${params.hostel.name}: ${params.notes || (params.approve ? 'Your property is now live for students.' : 'Please review admin feedback.')}`,
      category: 'verification',
      link: '/dashboard/owner',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `hostels/${params.hostel.id}`);
  }
}

export async function adminToggleHostelFlags(
  adminUid: string,
  hostel: Hostel,
  flags: { isFeatured?: boolean; isSponsored?: boolean; listingStatus?: Hostel['listingStatus'] }
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'hostels', hostel.id), {
      ...flags,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, 'auditLogs')), {
      actorId: adminUid,
      action: 'HOSTEL_FLAGS_UPDATED',
      targetCollection: 'hostels',
      targetId: hostel.id,
      summary: `Updated listing flags for ${hostel.name}: ${JSON.stringify(flags)}`.slice(0, 500),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `hostels/${hostel.id}`);
  }
}

export async function adminFetchCollectionSnapshot(): Promise<{
  users: UserPublic[];
  reports: ListingReport[];
  reviews: Review[];
  verificationRecords: VerificationRecord[];
  auditLogs: AuditLog[];
  subscriptions: OwnerSubscription[];
}> {
  try {
    const [usersSnap, reportsSnap, reviewsSnap, verifSnap, logsSnap, subsSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(150))),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'verificationRecords'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'subscriptions'), limit(100))),
    ]);

    return {
      users: usersSnap.docs.map((s) => {
        const d = s.data();
        return {
          uid: String(d.uid ?? s.id),
          displayName: String(d.displayName ?? ''),
          role: (d.role as UserRole) ?? 'student',
          photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : undefined,
          accountStatus: (d.accountStatus as UserPublic['accountStatus']) ?? 'active',
          ownerVerified: Boolean(d.ownerVerified),
          universityName: typeof d.universityName === 'string' ? d.universityName : undefined,
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        };
      }),
      reports: reportsSnap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          reporterId: String(d.reporterId ?? ''),
          hostelId: String(d.hostelId ?? ''),
          reason: String(d.reason ?? ''),
          details: String(d.details ?? ''),
          status: (d.status as ListingReport['status']) ?? 'open',
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        };
      }),
      reviews: reviewsSnap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          studentId: String(d.studentId ?? ''),
          studentName: String(d.studentName ?? ''),
          hostelId: String(d.hostelId ?? ''),
          bookingId: String(d.bookingId ?? ''),
          rating: Number(d.rating ?? 5),
          comment: String(d.comment ?? ''),
          moderationStatus: (d.moderationStatus as Review['moderationStatus']) ?? 'pending',
          createdAtMs: toMs(d.createdAt),
        };
      }),
      verificationRecords: verifSnap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          targetType: (d.targetType as VerificationRecord['targetType']) ?? 'hostel',
          targetId: String(d.targetId ?? ''),
          ownerId: String(d.ownerId ?? ''),
          submittedNotes: typeof d.submittedNotes === 'string' ? d.submittedNotes : undefined,
          evidenceSummary: typeof d.evidenceSummary === 'string' ? d.evidenceSummary : undefined,
          status: (d.status as VerificationRecord['status']) ?? 'pending',
          reviewerId: typeof d.reviewerId === 'string' ? d.reviewerId : undefined,
          reviewNotes: typeof d.reviewNotes === 'string' ? d.reviewNotes : undefined,
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        };
      }),
      auditLogs: logsSnap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          actorId: String(d.actorId ?? ''),
          action: String(d.action ?? ''),
          targetCollection: String(d.targetCollection ?? ''),
          targetId: String(d.targetId ?? ''),
          summary: String(d.summary ?? ''),
          createdAtMs: toMs(d.createdAt),
        };
      }),
      subscriptions: subsSnap.docs.map((s) => {
        const d = s.data();
        return {
          id: s.id,
          ownerId: String(d.ownerId ?? ''),
          plan: (d.plan as OwnerSubscription['plan']) ?? 'free',
          status: (d.status as OwnerSubscription['status']) ?? 'active',
          priceMwk: Number(d.priceMwk ?? 0),
          createdAtMs: toMs(d.createdAt),
          updatedAtMs: toMs(d.updatedAt),
        };
      }),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin_console');
  }
}

export async function adminModerateReview(
  adminUid: string,
  reviewId: string,
  moderationStatus: 'approved' | 'rejected'
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'reviews', reviewId), { moderationStatus });
    batch.set(doc(collection(db, 'auditLogs')), {
      actorId: adminUid,
      action: `REVIEW_${moderationStatus.toUpperCase()}`,
      targetCollection: 'reviews',
      targetId: reviewId,
      summary: `Moderated review ${reviewId} as ${moderationStatus}.`,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reviews/${reviewId}`);
  }
}

export async function adminUpdateReportStatus(
  adminUid: string,
  reportId: string,
  status: ListingReport['status']
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'reports', reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, 'auditLogs')), {
      actorId: adminUid,
      action: 'REPORT_UPDATED',
      targetCollection: 'reports',
      targetId: reportId,
      summary: `Set listing report status to ${status}.`,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function adminUpdateUserAccount(
  adminUid: string,
  targetUid: string,
  updates: { accountStatus?: 'active' | 'suspended'; ownerVerified?: boolean; role?: UserRole }
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, 'auditLogs')), {
      actorId: adminUid,
      action: 'USER_UPDATED',
      targetCollection: 'users',
      targetId: targetUid,
      summary: `Admin updated user ${targetUid}: ${JSON.stringify(updates)}`.slice(0, 500),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function adminSaveSystemSettings(
  adminUid: string,
  settings: Omit<SystemSettings, 'updatedAtMs' | 'updatedBy'>
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'systemSettings', 'global'), {
      ...settings,
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, 'auditLogs')), {
      actorId: adminUid,
      action: 'SYSTEM_SETTINGS_UPDATED',
      targetCollection: 'systemSettings',
      targetId: 'global',
      summary: `Updated global monetization and platform configuration.`,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'systemSettings/global');
  }
}
