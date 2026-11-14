export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type UserRole = 'student' | 'owner' | 'university' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export type RoomCategoryType = 'single' | 'shared' | 'self_contained' | 'furnished' | 'other';
export type PaymentPeriod = 'monthly' | 'semester' | 'academic_year';
export type LocationStatus = 'unavailable' | 'unverified' | 'verified' | 'rejected';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'suspended';

export type BookingStatus =
  | 'pending'
  | 'under_review'
  | 'viewing_requested'
  | 'viewing_confirmed'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed';

export type EnquiryType = 'general' | 'viewing';
export type EnquiryStatus = 'open' | 'responded' | 'scheduled' | 'closed';

export type NotificationCategory = 'booking' | 'viewing' | 'verification' | 'listing' | 'message' | 'system';

export type FacilityKey =
  | 'Electricity'
  | 'Water'
  | 'Reliable water supply'
  | 'Security'
  | 'Internet'
  | 'Wi-Fi'
  | 'Kitchen'
  | 'Bathroom'
  | 'Toilets'
  | 'Laundry'
  | 'Parking'
  | 'Furniture';

export const ALL_FACILITIES: FacilityKey[] = [
  'Electricity',
  'Water',
  'Reliable water supply',
  'Security',
  'Internet',
  'Wi-Fi',
  'Kitchen',
  'Bathroom',
  'Toilets',
  'Laundry',
  'Parking',
  'Furniture',
];

export const ROOM_CATEGORY_LABELS: Record<RoomCategoryType, string> = {
  single: 'Single room',
  shared: 'Shared room',
  self_contained: 'Self-contained room',
  furnished: 'Furnished room',
  other: 'Other category',
};

export const PAYMENT_PERIOD_LABELS: Record<PaymentPeriod, string> = {
  monthly: 'per month',
  semester: 'per semester',
  academic_year: 'per academic year',
};

export interface UserPublic {
  uid: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string;
  accountStatus: AccountStatus;
  ownerVerified?: boolean;
  universityName?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UserPrivate {
  uid: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  studentIdNumber?: string;
  businessName?: string;
  preferredCampusId?: string;
  maxBudgetMwk?: number;
  preferredRoomType?: string;
  updatedAtMs: number;
}

export interface Campus {
  id: string;
  name: string;
  universityName: string;
  district: string;
  country: string;
  lat: number;
  lng: number;
  isActive: boolean;
  createdAtMs: number;
}

export interface Hostel {
  id: string;
  ownerId: string;
  campusId: string;
  name: string;
  description: string;
  address: string;
  area: string;
  lat?: number;
  lng?: number;
  entranceLat?: number;
  entranceLng?: number;
  hasCoordinates: boolean;
  boundaryCoordinates?: LatLngLiteral[];
  locationStatus: LocationStatus;
  verificationStatus: VerificationStatus;
  listingStatus: ListingStatus;
  facilities: string[];
  imageUrls: string[];
  minPriceMwk: number;
  maxPriceMwk: number;
  paymentPeriod: PaymentPeriod;
  depositMwk: number;
  totalAvailableRooms: number;
  houseRules?: string;
  ownerDisplayName?: string;
  ownerWhatsapp?: string;
  isFeatured: boolean;
  isSponsored: boolean;
  lastAvailabilityConfirmationMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface Room {
  id: string;
  hostelId: string;
  ownerId: string;
  name: string;
  category: RoomCategoryType;
  priceMwk: number;
  depositMwk: number;
  paymentPeriod: PaymentPeriod;
  totalUnits: number;
  availableUnits: number;
  isPublished: boolean;
  description?: string;
  updatedAtMs: number;
}

export interface Booking {
  id: string;
  studentId: string;
  ownerId: string;
  hostelId: string;
  roomId: string;
  hostelName: string;
  roomName: string;
  studentName: string;
  checkInDate: string;
  checkOutDate: string;
  rentalPeriod: PaymentPeriod;
  totalAmountMwk: number;
  status: BookingStatus;
  notes?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface Enquiry {
  id: string;
  studentId: string;
  ownerId: string;
  hostelId: string;
  hostelName: string;
  studentName: string;
  type: EnquiryType;
  subject: string;
  message: string;
  preferredDate?: string;
  status: EnquiryStatus;
  ownerReply?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface Conversation {
  id: string;
  studentId: string;
  ownerId: string;
  hostelId: string;
  hostelName: string;
  studentName: string;
  ownerName: string;
  lastMessage: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface Message {
  id: string;
  senderId: string;
  body: string;
  read: boolean;
  createdAtMs: number;
}

export interface Review {
  id: string;
  studentId: string;
  studentName: string;
  hostelId: string;
  bookingId: string;
  rating: number;
  comment: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  createdAtMs: number;
}

export interface Favorite {
  id: string;
  userId: string;
  hostelId: string;
  createdAtMs: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  link?: string;
  read: boolean;
  createdAtMs: number;
}

export interface ListingReport {
  id: string;
  reporterId: string;
  hostelId: string;
  reason: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  createdAtMs: number;
  updatedAtMs: number;
}

export interface VerificationRecord {
  id: string;
  targetType: 'owner' | 'hostel';
  targetId: string;
  ownerId: string;
  submittedNotes?: string;
  evidenceSummary?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewNotes?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAtMs: number;
}

export interface OwnerSubscription {
  id: string;
  ownerId: string;
  plan: 'free' | 'growth' | 'institutional';
  status: 'active' | 'inactive';
  priceMwk: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SystemSettings {
  featuredEnabled: boolean;
  sponsoredLabelText: string;
  bookingServiceFeePercent: number;
  maintenanceMode: boolean;
  updatedBy?: string;
  updatedAtMs: number;
}

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'distance_asc' | 'newest';

export interface HostelSearchFilters {
  query: string;
  campusId: string;
  area: string;
  minPriceMwk: number | null;
  maxPriceMwk: number | null;
  maxDistanceKm: number | null;
  roomCategory: RoomCategoryType | 'all';
  facilities: string[];
  onlyVerified: boolean;
  onlyAvailable: boolean;
  sortBy: SortOption;
}
