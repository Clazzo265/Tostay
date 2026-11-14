import { z } from 'zod';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const hostelSubmissionSchema = z.object({
  campusId: z.string().min(1).max(64).regex(ID_PATTERN, 'Invalid campus identifier'),
  name: z.string().trim().min(3, 'Property name must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2500),
  address: z.string().trim().min(3, 'Address or directions are required').max(250),
  area: z.string().trim().min(2, 'Area/village name is required').max(100),
  hasCoordinates: z.boolean(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  entranceLat: z.number().min(-90).max(90).optional(),
  entranceLng: z.number().min(-180).max(180).optional(),
  boundaryCoordinates: z.array(latLngSchema).max(25).optional(),
  facilities: z.array(z.string().max(50)).max(20),
  imageUrls: z.array(z.string().max(500)).max(10),
  minPriceMwk: z.number().min(0).max(100000000),
  maxPriceMwk: z.number().min(0).max(100000000),
  paymentPeriod: z.enum(['monthly', 'semester', 'academic_year']),
  depositMwk: z.number().min(0).max(100000000),
  totalAvailableRooms: z.number().int().min(0).max(5000),
  houseRules: z.string().max(1500).optional(),
  ownerDisplayName: z.string().max(100).optional(),
  ownerWhatsapp: z.string().max(32).optional(),
}).refine((data) => data.maxPriceMwk >= data.minPriceMwk, {
  message: 'Maximum price must be greater than or equal to minimum price',
  path: ['maxPriceMwk'],
});

export const roomSchema = z.object({
  hostelId: z.string().min(1).max(128).regex(ID_PATTERN),
  name: z.string().trim().min(2, 'Room name is required').max(100),
  category: z.enum(['single', 'shared', 'self_contained', 'furnished', 'other']),
  priceMwk: z.number().min(1000, 'Enter a valid MWK rent amount').max(100000000),
  depositMwk: z.number().min(0).max(100000000),
  paymentPeriod: z.enum(['monthly', 'semester', 'academic_year']),
  totalUnits: z.number().int().min(1).max(1000),
  availableUnits: z.number().int().min(0).max(1000),
  isPublished: z.boolean(),
  description: z.string().max(600).optional(),
}).refine((data) => data.availableUnits <= data.totalUnits, {
  message: 'Available units cannot exceed total units',
  path: ['availableUnits'],
});

export const bookingRequestSchema = z.object({
  roomId: z.string().min(1).max(128).regex(ID_PATTERN),
  checkInDate: z.string().min(8).max(32),
  checkOutDate: z.string().min(8).max(32),
  notes: z.string().max(800).optional(),
}).refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: 'Check-out date must be after check-in date',
  path: ['checkOutDate'],
});

export const enquirySchema = z.object({
  type: z.enum(['general', 'viewing']),
  subject: z.string().trim().min(2, 'Subject is required').max(140),
  message: z.string().trim().min(4, 'Message must be at least 4 characters').max(1500),
  preferredDate: z.string().max(32).optional(),
});

export const reviewSchema = z.object({
  bookingId: z.string().min(1).max(128).regex(ID_PATTERN),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5, 'Please share a brief review (min 5 characters)').max(1500),
});

export const reportSchema = z.object({
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().min(5, 'Please explain the issue (min 5 characters)').max(1500),
});

export const userProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(['student', 'owner']),
  phone: z.string().max(32).optional(),
  whatsapp: z.string().max(32).optional(),
  studentIdNumber: z.string().max(64).optional(),
  businessName: z.string().max(120).optional(),
  universityName: z.string().max(150).optional(),
  preferredCampusId: z.string().max(64).optional(),
  maxBudgetMwk: z.number().min(0).max(100000000).optional(),
  preferredRoomType: z.string().max(40).optional(),
});

export const systemSettingsSchema = z.object({
  featuredEnabled: z.boolean(),
  sponsoredLabelText: z.string().trim().min(1).max(80),
  bookingServiceFeePercent: z.number().min(0).max(30),
  maintenanceMode: z.boolean(),
});
