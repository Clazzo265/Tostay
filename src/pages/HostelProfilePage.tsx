import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Flag,
  Heart,
  MapPin,
  MessageSquare,
  Scale,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { ToStaySatelliteMap } from '../components/map/ToStaySatelliteMap';
import { EmptyState } from '../components/ui/EmptyState';
import { SafeImage } from '../components/ui/SafeImage';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import {
  formatMwk,
  formatRelativeTime,
  haversineDistanceKm,
  isAvailabilityStale,
  validateBookingDates,
} from '../lib/hostelUtils';
import { enquirySchema, reportSchema, reviewSchema } from '../lib/validation';
import {
  createBookingRequest,
  createEnquiryRequest,
  startOrGetConversation,
  submitCompletedStayReview,
  submitListingReport,
  subscribeApprovedReviews,
  subscribeUserBookings,
} from '../services/firestoreService';
import {
  PAYMENT_PERIOD_LABELS,
  ROOM_CATEGORY_LABELS,
  type Booking,
  type Review,
} from '../types/domain';

export const HostelProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { firebaseUser, userPublic } = useAuth();
  const {
    campuses,
    hostels,
    rooms,
    favoriteHostelIds,
    toggleFavorite,
    compareIds,
    toggleCompare,
    recordRecentView,
    pushToast,
  } = usePlatform();

  const hostel = useMemo(() => hostels.find((h) => h.id === id) ?? null, [hostels, id]);
  const hostelRooms = useMemo(
    () => rooms.filter((r) => r.hostelId === hostel?.id && r.isPublished),
    [rooms, hostel?.id]
  );
  const campus = useMemo(
    () => campuses.find((c) => c.id === hostel?.campusId) ?? campuses[0],
    [campuses, hostel?.campusId]
  );

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userBookings, setUserBookings] = useState<Booking[]>([]);

  // Modal states
  const [activeModal, setActiveModal] = useState<
    null | 'booking' | 'viewing' | 'message' | 'report'
  >(null);

  // Booking form
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => {
    const d = new Date(Date.now() + 3 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date(Date.now() + 120 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [bookingNotes, setBookingNotes] = useState('');

  // Viewing / Enquiry form
  const [viewingDate, setViewingDate] = useState('');
  const [viewingMessage, setViewingMessage] = useState('');

  // Message form
  const [directMessage, setDirectMessage] = useState('');

  // Report form
  const [reportReason, setReportReason] = useState('Misleading price or photos');
  const [reportDetails, setReportDetails] = useState('');

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hostel?.id) {
      recordRecentView(hostel.id);
    }
  }, [hostel?.id, recordRecentView]);

  useEffect(() => {
    const firstAvailable = hostelRooms.find((r) => r.availableUnits > 0) ?? hostelRooms[0];
    if (firstAvailable && (!selectedRoomId || !hostelRooms.some((r) => r.id === selectedRoomId))) {
      setSelectedRoomId(firstAvailable.id);
    }
  }, [hostelRooms, selectedRoomId]);

  useEffect(() => {
    if (!hostel?.id) {
      setReviews([]);
      return;
    }
    return subscribeApprovedReviews(hostel.id, setReviews);
  }, [hostel?.id]);

  useEffect(() => {
    if (!firebaseUser) {
      setUserBookings([]);
      return;
    }
    return subscribeUserBookings(firebaseUser.uid, 'studentId', setUserBookings);
  }, [firebaseUser]);

  if (!hostel) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title="Hostel listing not found"
          description="This property may have been removed or is no longer active."
          action={
            <Link
              to="/explore"
              className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
            >
              Back to Explore
            </Link>
          }
        />
      </div>
    );
  }

  const isSaved = favoriteHostelIds.has(hostel.id);
  const isCompared = compareIds.includes(hostel.id);
  const stale = isAvailabilityStale(hostel.lastAvailabilityConfirmationMs);
  const distanceKm =
    campus && hostel.hasCoordinates && typeof hostel.lat === 'number' && typeof hostel.lng === 'number'
      ? haversineDistanceKm(
          { lat: campus.lat, lng: campus.lng },
          { lat: hostel.lat, lng: hostel.lng }
        )
      : null;

  const isOwnListing = Boolean(firebaseUser && firebaseUser.uid === hostel.ownerId);
  const hasBookableRooms = hostelRooms.some((r) => r.availableUnits > 0);
  const completedBookingForHostel = userBookings.find(
    (b) => b.hostelId === hostel.id && b.status === 'completed'
  );

  const requireSignedInLiveListing = (actionName: string): boolean => {
    if (!firebaseUser) {
      pushToast({
        title: 'Sign in required',
        description: `Please sign in to ${actionName.toLowerCase()}.`,
        variant: 'info',
      });
      navigate('/auth');
      return false;
    }
    return true;
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireSignedInLiveListing('Submit Booking Request') || !firebaseUser) return;
    if (isOwnListing) {
      pushToast({ title: 'Owners cannot book their own property', variant: 'error' });
      return;
    }
    const room = hostelRooms.find((r) => r.id === selectedRoomId);
    if (!room) {
      pushToast({ title: 'Select a room category first', variant: 'error' });
      return;
    }
    if (room.availableUnits <= 0) {
      pushToast({ title: 'Selected room category has no open units left', variant: 'error' });
      return;
    }
    const dateCheck = validateBookingDates(checkInDate, checkOutDate);
    if (!dateCheck.valid) {
      pushToast({ title: dateCheck.error || 'Invalid dates', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await createBookingRequest({
        studentId: firebaseUser.uid,
        studentName: userPublic?.displayName || firebaseUser.displayName || 'Student',
        ownerId: hostel.ownerId,
        hostelId: hostel.id,
        hostelName: hostel.name,
        roomId: room.id,
        roomName: room.name,
        checkInDate,
        checkOutDate,
        rentalPeriod: room.paymentPeriod,
        totalAmountMwk: room.priceMwk,
        notes: bookingNotes,
      });
      setActiveModal(null);
      setBookingNotes('');
      pushToast({
        title: 'Booking request submitted',
        description: 'Track owner approval in your Student Dashboard.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Booking submission failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireSignedInLiveListing('Request Viewing') || !firebaseUser) return;
    const parsed = enquirySchema.safeParse({
      type: 'viewing',
      subject: `Physical Viewing Request — ${hostel.name}`,
      message: viewingMessage,
      preferredDate: viewingDate,
    });
    if (!parsed.success) {
      pushToast({ title: parsed.error.issues[0]?.message || 'Check your message', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await createEnquiryRequest({
        studentId: firebaseUser.uid,
        studentName: userPublic?.displayName || firebaseUser.displayName || 'Student',
        ownerId: hostel.ownerId,
        hostelId: hostel.id,
        hostelName: hostel.name,
        type: 'viewing',
        subject: parsed.data.subject,
        message: parsed.data.message,
        preferredDate: parsed.data.preferredDate,
      });
      setActiveModal(null);
      setViewingMessage('');
      pushToast({
        title: 'Viewing request sent',
        description: 'The property owner has been notified.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Failed to send request',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireSignedInLiveListing('Message Owner') || !firebaseUser) return;
    if (directMessage.trim().length < 2) {
      pushToast({ title: 'Enter a message for the property owner', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await startOrGetConversation({
        studentId: firebaseUser.uid,
        studentName: userPublic?.displayName || firebaseUser.displayName || 'Student',
        ownerId: hostel.ownerId,
        ownerName: hostel.ownerDisplayName || 'Property Owner',
        hostelId: hostel.id,
        hostelName: hostel.name,
        initialMessage: directMessage,
      });
      setActiveModal(null);
      setDirectMessage('');
      pushToast({
        title: 'Message delivered',
        description: 'Continue chatting inside your Student Dashboard.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Failed to send message',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireSignedInLiveListing('Report Listing') || !firebaseUser) return;
    const parsed = reportSchema.safeParse({ reason: reportReason, details: reportDetails });
    if (!parsed.success) {
      pushToast({ title: parsed.error.issues[0]?.message || 'Check report details', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await submitListingReport({
        reporterId: firebaseUser.uid,
        hostelId: hostel.id,
        reason: parsed.data.reason,
        details: parsed.data.details,
      });
      setActiveModal(null);
      setReportDetails('');
      pushToast({
        title: 'Report submitted to ToStay Trust & Safety',
        description: 'An administrator will review this listing.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Failed to submit report',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !completedBookingForHostel) return;
    const parsed = reviewSchema.safeParse({
      bookingId: completedBookingForHostel.id,
      rating: reviewRating,
      comment: reviewComment,
    });
    if (!parsed.success) {
      pushToast({ title: parsed.error.issues[0]?.message || 'Check review details', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await submitCompletedStayReview({
        studentId: firebaseUser.uid,
        studentName: userPublic?.displayName || firebaseUser.displayName || 'Student',
        hostelId: hostel.id,
        bookingId: completedBookingForHostel.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      });
      setReviewComment('');
      pushToast({
        title: 'Review submitted for moderation',
        description: 'Your verified stay review will appear once approved.',
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not submit review',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Explore</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCompare(hostel.id)}
              className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                isCompared
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>{isCompared ? 'In Compare' : 'Compare'}</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleFavorite(hostel.id)}
              className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                isSaved
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (requireSignedInLiveListing('Report Listing')) setActiveModal('report');
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-600 hover:text-rose-600"
            >
              <Flag className="w-4 h-4" />
              <span>Report</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Content Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Gallery */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <SafeImage
                src={hostel.imageUrls[activePhotoIndex] ?? hostel.imageUrls[0]}
                alt={hostel.name}
                aspectClassName="aspect-[16/9]"
              />
              {hostel.imageUrls.length > 1 && (
                <div className="p-3 flex items-center gap-2 overflow-x-auto bg-slate-50 border-t border-slate-200">
                  {hostel.imageUrls.map((url, idx) => (
                    <button
                      key={`${url}-${idx}`}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 ${
                        idx === activePhotoIndex ? 'border-blue-600' : 'border-transparent opacity-70'
                      }`}
                    >
                      <SafeImage src={url} alt={`${hostel.name} photo ${idx + 1}`} aspectClassName="w-full h-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Overview */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                <span className="text-slate-900 font-semibold">{hostel.area}</span>
                <span>·</span>
                <span>{hostel.address}</span>
                <span>·</span>
                {hostel.verificationStatus === 'verified' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    Verified Listing
                  </span>
                ) : (
                  <span className="text-amber-700 capitalize">{hostel.verificationStatus}</span>
                )}
              </div>

              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900">
                {hostel.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                {distanceKm !== null ? (
                  <span className="inline-flex items-center gap-1.5 tabular-nums font-medium">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    {distanceKm} km from {campus?.name || 'Campus'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Location unavailable — awaiting GPS verification
                  </span>
                )}
                <span className="text-slate-300">|</span>
                <span className={stale ? 'text-amber-700 font-medium' : 'text-slate-600'}>
                  Availability confirmed {formatRelativeTime(hostel.lastAvailabilityConfirmationMs)}
                  {stale ? ' (Owner re-confirmation overdue)' : ''}
                </span>
              </div>

              <p className="mt-4 text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {hostel.description}
              </p>

              {/* Facilities */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h2 className="font-display font-semibold text-base text-slate-900 mb-3">
                  Property Facilities & Utilities
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {hostel.facilities.map((fac) => (
                    <div
                      key={fac}
                      className="flex items-center gap-2 text-sm text-slate-700 py-1"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{fac}</span>
                    </div>
                  ))}
                </div>
              </div>

              {hostel.houseRules && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h2 className="font-display font-semibold text-base text-slate-900 mb-2">
                    House Rules & Tenancy Notes
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{hostel.houseRules}</p>
                </div>
              )}
            </section>

            {/* Room Categories */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-xl font-bold text-slate-900 mb-4">
                Room Categories & MWK Pricing
              </h2>
              {hostelRooms.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Standard pricing starts at{' '}
                  <strong className="tabular-nums">
                    {formatMwk(hostel.minPriceMwk, hostel.paymentPeriod)}
                  </strong>{' '}
                  (Security deposit: {formatMwk(hostel.depositMwk)}). Contact the owner for specific room openings.
                </p>
              ) : (
                <div className="space-y-3">
                  {hostelRooms.map((room) => (
                    <div
                      key={room.id}
                      className="rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                          {ROOM_CATEGORY_LABELS[room.category]}
                        </p>
                        <h3 className="font-display font-bold text-base text-slate-900 mt-0.5">
                          {room.name}
                        </h3>
                        {room.description && (
                          <p className="text-xs text-slate-600 mt-1">{room.description}</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500 tabular-nums">
                          Deposit: {formatMwk(room.depositMwk)} ·{' '}
                          <span
                            className={
                              room.availableUnits > 0
                                ? 'text-emerald-700 font-semibold'
                                : 'text-rose-700 font-semibold'
                            }
                          >
                            {room.availableUnits} of {room.totalUnits} units available
                          </span>
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="font-display font-bold text-lg text-slate-900 tabular-nums">
                          {formatMwk(room.priceMwk)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {PAYMENT_PERIOD_LABELS[room.paymentPeriod]}
                        </p>
                        <button
                          type="button"
                          disabled={room.availableUnits <= 0}
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            if (requireSignedInLiveListing('Request Booking')) {
                              setActiveModal('booking');
                            }
                          }}
                          className="mt-2 min-h-[38px] px-4 py-1.5 rounded-lg bg-[#0A192F] text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40"
                        >
                          {room.availableUnits > 0 ? 'Request Room' : 'Full'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Satellite Location Inspection */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Satellite Location & Campus Route
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Status:{' '}
                    <span className="font-semibold capitalize">{hostel.locationStatus}</span>
                    {hostel.boundaryCoordinates && hostel.boundaryCoordinates.length >= 3
                      ? ' · Property boundary polygon mapped'
                      : ''}
                  </p>
                </div>
                {hostel.hasCoordinates && typeof hostel.lat === 'number' && typeof hostel.lng === 'number' && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${hostel.lat},${hostel.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {hostel.hasCoordinates && campus ? (
                <ToStaySatelliteMap
                  campus={campus}
                  hostels={[hostel]}
                  selectedHostelId={hostel.id}
                  heightClassName="h-[360px]"
                />
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                  <strong>Location unavailable:</strong> GPS coordinates for this property have not yet
                  been verified. Request a physical viewing or contact the owner for guided directions.
                </div>
              )}
            </section>

            {/* Reviews Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-xl font-bold text-slate-900 mb-1">
                Verified Student Stay Reviews
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Only students with a completed booking at this hostel can submit a review.
              </p>

              {completedBookingForHostel && (
                <form
                  onSubmit={handleReviewSubmit}
                  className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    Share your stay experience
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-700">Rating:</label>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} / 5 Stars
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Comment on water reliability, quiet study atmosphere, and landlord responsiveness..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#0A192F] text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    Submit Review
                  </button>
                </form>
              )}

              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No moderated reviews published for this property yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-slate-900">{rev.studentName}</p>
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold tabular-nums">
                          <Star className="w-4 h-4 fill-current" />
                          <span>{rev.rating}.0</span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Action Sidebar */}
          <aside className="lg:col-span-4">
            <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Transparent MWK Rent
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                  {formatMwk(hostel.minPriceMwk)}
                  {hostel.maxPriceMwk > hostel.minPriceMwk
                    ? ` – ${formatMwk(hostel.maxPriceMwk)}`
                    : ''}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Billed {PAYMENT_PERIOD_LABELS[hostel.paymentPeriod]} · Deposit{' '}
                  <span className="font-semibold tabular-nums">{formatMwk(hostel.depositMwk)}</span>
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-slate-900">
                  {hostel.totalAvailableRooms > 0
                    ? `${hostel.totalAvailableRooms} rooms available right now`
                    : 'No rooms currently listed as open'}
                </p>
                <p className="text-slate-600">
                  Managed by {hostel.ownerDisplayName || 'Verified Hostel Owner'}
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={!hasBookableRooms || isOwnListing}
                  onClick={() => {
                    if (requireSignedInLiveListing('Request Booking')) setActiveModal('booking');
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOwnListing
                    ? 'Your Own Listing'
                    : hasBookableRooms
                    ? 'Request Booking'
                    : hostelRooms.length === 0
                    ? 'Contact Owner for Room Openings'
                    : 'No Open Units Currently'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (requireSignedInLiveListing('Request Viewing')) setActiveModal('viewing');
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-[#0A192F] hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule Physical Viewing</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (requireSignedInLiveListing('Message Owner')) setActiveModal('message');
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message Owner In-App</span>
                </button>
                {hostel.ownerWhatsapp && (
                  <a
                    href={`https://wa.me/${hostel.ownerWhatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full min-h-[44px] rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Chat on WhatsApp</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Modal: Request Booking */}
      {activeModal === 'booking' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleBookingSubmit}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Submit Booking Request
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Category
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {hostelRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {formatMwk(r.priceMwk, r.paymentPeriod)} ({r.availableUnits} open)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Move-in Date
                </label>
                <input
                  type="date"
                  required
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Move-out Date
                </label>
                <input
                  type="date"
                  required
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes for Owner (Optional)
              </label>
              <textarea
                rows={3}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Share your year of study, preferred floor, or questions..."
                className="w-full p-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[42px] px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Viewing */}
      {activeModal === 'viewing' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleViewingSubmit}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Request Physical Viewing
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Date
              </label>
              <input
                type="date"
                value={viewingDate}
                onChange={(e) => setViewingDate(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Message
              </label>
              <textarea
                rows={3}
                required
                value={viewingMessage}
                onChange={(e) => setViewingMessage(e.target.value)}
                placeholder="Let the owner know what time works for you to inspect the rooms..."
                className="w-full p-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[42px] px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-4 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
              >
                {submitting ? 'Sending...' : 'Send Viewing Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Direct Message */}
      {activeModal === 'message' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleMessageSubmit}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Message Property Owner
            </h3>
            <textarea
              rows={4}
              required
              value={directMessage}
              onChange={(e) => setDirectMessage(e.target.value)}
              placeholder="Ask about water backup, study desk setup, or deposit terms..."
              className="w-full p-3 rounded-lg border border-slate-300 text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[42px] px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Report Listing */}
      {activeModal === 'report' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Report Suspicious Listing
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="Misleading price or photos">Misleading price or photos</option>
                <option value="Incorrect GPS location">Incorrect GPS location</option>
                <option value="Suspected fraud or deposit scam">Suspected fraud or deposit scam</option>
                <option value="Property permanently closed">Property permanently closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Details</label>
              <textarea
                rows={3}
                required
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe what you observed so our verification team can investigate..."
                className="w-full p-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[42px] px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
