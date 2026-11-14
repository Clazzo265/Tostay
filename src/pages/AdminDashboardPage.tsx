import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Database,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { BoundaryPickerMap } from '../components/map/BoundaryPickerMap';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { formatMwk, formatRelativeTime } from '../lib/hostelUtils';
import { systemSettingsSchema } from '../lib/validation';
import {
  adminFetchCollectionSnapshot,
  adminModerateReview,
  adminSaveSystemSettings,
  adminToggleHostelFlags,
  adminUpdateReportStatus,
  adminUpdateUserAccount,
  adminVerifyHostel,
  initializeCampusAndSettings,
  subscribeAdminAllBookings,
  subscribeAdminAllHostels,
} from '../services/firestoreService';
import type {
  AuditLog,
  Booking,
  Hostel,
  LatLngLiteral,
  ListingReport,
  LocationStatus,
  OwnerSubscription,
  Review,
  UserPublic,
} from '../types/domain';

type AdminTab =
  | 'verification'
  | 'hostels'
  | 'users'
  | 'reviews'
  | 'reports'
  | 'audit'
  | 'settings';

export const AdminDashboardPage: React.FC = () => {
  const { firebaseUser, isAdmin, isAuthReady } = useAuth();
  const { campuses, hasLiveCampuses, systemSettings, pushToast } = usePlatform();

  const [tab, setTab] = useState<AdminTab>('verification');
  const [allHostels, setAllHostels] = useState<Hostel[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [subscriptions, setSubscriptions] = useState<OwnerSubscription[]>([]);

  // Verification inspector state
  const [inspectingHostel, setInspectingHostel] = useState<Hostel | null>(null);
  const [inspectPin, setInspectPin] = useState<LatLngLiteral | undefined>(undefined);
  const [inspectEntrance, setInspectEntrance] = useState<LatLngLiteral | undefined>(undefined);
  const [inspectBoundary, setInspectBoundary] = useState<LatLngLiteral[]>([]);
  const [inspectLocationStatus, setInspectLocationStatus] = useState<LocationStatus>('verified');
  const [inspectNotes, setInspectNotes] = useState('');

  // Settings form state
  const [featuredEnabled, setFeaturedEnabled] = useState(systemSettings.featuredEnabled);
  const [sponsoredLabelText, setSponsoredLabelText] = useState(systemSettings.sponsoredLabelText);
  const [bookingFeePercent, setBookingFeePercent] = useState(
    String(systemSettings.bookingServiceFeePercent)
  );
  const [maintenanceMode, setMaintenanceMode] = useState(systemSettings.maintenanceMode);

  const loadSnapshot = async () => {
    try {
      const snap = await adminFetchCollectionSnapshot();
      setUsers(snap.users);
      setReports(snap.reports);
      setReviews(snap.reviews);
      setAuditLogs(snap.auditLogs);
      setSubscriptions(snap.subscriptions);
    } catch (err) {
      console.warn('Admin snapshot load info:', err);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const u1 = subscribeAdminAllHostels(setAllHostels);
    const u2 = subscribeAdminAllBookings(setAllBookings);
    void loadSnapshot();
    return () => {
      u1();
      u2();
    };
  }, [isAdmin]);

  const [didAutoInit, setDidAutoInit] = useState(false);
  useEffect(() => {
    if (!isAdmin || !firebaseUser || hasLiveCampuses || didAutoInit) return;
    setDidAutoInit(true);
    void initializeCampusAndSettings(firebaseUser.uid)
      .then(() => loadSnapshot())
      .catch(() => {
        // Error surfaced cleanly via manual Initialize button if needed
      });
  }, [isAdmin, firebaseUser, hasLiveCampuses, didAutoInit]);

  useEffect(() => {
    setFeaturedEnabled(systemSettings.featuredEnabled);
    setSponsoredLabelText(systemSettings.sponsoredLabelText);
    setBookingFeePercent(String(systemSettings.bookingServiceFeePercent));
    setMaintenanceMode(systemSettings.maintenanceMode);
  }, [systemSettings]);

  if (!isAuthReady) {
    return <div className="max-w-7xl mx-auto px-4 py-12 text-sm text-slate-600">Loading Admin Console...</div>;
  }

  if (!firebaseUser || !isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<ShieldAlert className="w-6 h-6 text-rose-600" />}
          title="Administrator Authorization Required"
          description="This protected console is restricted to verified ToStay administrators."
          action={
            <Link
              to="/"
              className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
            >
              Return Home
            </Link>
          }
        />
      </div>
    );
  }

  const pendingQueue = allHostels.filter(
    (h) => h.verificationStatus === 'pending' || h.listingStatus === 'pending_review'
  );

  const openInspector = (h: Hostel) => {
    setInspectingHostel(h);
    setInspectPin(
      typeof h.lat === 'number' && typeof h.lng === 'number'
        ? { lat: h.lat, lng: h.lng }
        : { lat: campuses[0]?.lat ?? -11.0186, lng: campuses[0]?.lng ?? 33.8574 }
    );
    setInspectEntrance(
      typeof h.entranceLat === 'number' && typeof h.entranceLng === 'number'
        ? { lat: h.entranceLat, lng: h.entranceLng }
        : undefined
    );
    setInspectBoundary(h.boundaryCoordinates ?? []);
    setInspectLocationStatus(h.hasCoordinates ? 'verified' : 'unavailable');
    setInspectNotes('');
  };

  const handleDecision = async (approve: boolean) => {
    if (!inspectingHostel) return;
    try {
      await adminVerifyHostel({
        adminUid: firebaseUser.uid,
        hostel: inspectingHostel,
        approve,
        locationStatus: approve ? inspectLocationStatus : 'rejected',
        lat: inspectPin?.lat,
        lng: inspectPin?.lng,
        entranceLat: inspectEntrance?.lat,
        entranceLng: inspectEntrance?.lng,
        boundaryCoordinates: inspectBoundary,
        notes: inspectNotes || (approve ? 'Satellite verification approved.' : 'Requires correction.'),
      });
      setInspectingHostel(null);
      await loadSnapshot();
      pushToast({
        title: approve ? 'Hostel verified & published' : 'Hostel rejected',
        variant: approve ? 'success' : 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Verification action failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = systemSettingsSchema.safeParse({
      featuredEnabled,
      sponsoredLabelText,
      bookingServiceFeePercent: Number(bookingFeePercent),
      maintenanceMode,
    });
    if (!parsed.success) {
      pushToast({ title: parsed.error.issues[0]?.message || 'Invalid settings', variant: 'error' });
      return;
    }
    try {
      await adminSaveSystemSettings(firebaseUser.uid, parsed.data);
      await loadSnapshot();
      pushToast({ title: 'Global settings saved', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to update settings',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      });
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Protected Governance Console
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              ToStay Administration & Satellite Audit
            </h1>
          </div>
          <button
            type="button"
            onClick={() =>
              void initializeCampusAndSettings(firebaseUser.uid)
                .then(() => {
                  void loadSnapshot();
                  pushToast({
                    title: 'Rumphi campus & system defaults synchronized',
                    variant: 'success',
                  });
                })
                .catch((err) =>
                  pushToast({
                    title: 'Failed to initialize campus defaults',
                    description: err instanceof Error ? err.message : 'Please try again',
                    variant: 'error',
                  })
                )
            }
            className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-100 inline-flex items-center gap-2"
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Initialize Rumphi Campus & Defaults</span>
          </button>
        </div>

        {/* KPI Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Pending Queue</p>
            <p className="mt-1 font-display text-2xl font-bold text-amber-700 tabular-nums">
              {pendingQueue.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">All Hostels</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {allHostels.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Registered Users</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {users.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Bookings</p>
            <p className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
              {allBookings.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Open Reports</p>
            <p className="mt-1 font-display text-2xl font-bold text-rose-700 tabular-nums">
              {reports.filter((r) => r.status === 'open').length}
            </p>
          </div>
        </div>

        {/* Admin Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200">
          {(
            [
              { id: 'verification', label: `Verification Queue (${pendingQueue.length})` },
              { id: 'hostels', label: `All Hostels (${allHostels.length})` },
              { id: 'users', label: `Users (${users.length})` },
              { id: 'reviews', label: `Reviews (${reviews.length})` },
              { id: 'reports', label: `Reports (${reports.length})` },
              { id: 'audit', label: `Audit Logs (${auditLogs.length})` },
              { id: 'settings', label: 'Settings & Plans' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                tab === t.id
                  ? 'bg-[#0A192F] text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Verification Queue */}
        {tab === 'verification' && (
          <div className="space-y-6">
            {inspectingHostel && (
              <div className="rounded-2xl border-2 border-blue-600 bg-white p-6 space-y-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900">
                      Satellite Inspection: {inspectingHostel.name}
                    </h2>
                    <p className="text-xs text-slate-600">
                      {inspectingHostel.area} · {inspectingHostel.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingHostel(null)}
                    className="text-sm text-slate-500 hover:text-slate-900"
                  >
                    Close Inspector
                  </button>
                </div>

                <BoundaryPickerMap
                  centerFallback={{
                    lat: campuses[0]?.lat ?? -11.0186,
                    lng: campuses[0]?.lng ?? 33.8574,
                  }}
                  pin={inspectPin}
                  entrance={inspectEntrance}
                  boundary={inspectBoundary}
                  onChangePin={setInspectPin}
                  onChangeEntrance={setInspectEntrance}
                  onChangeBoundary={setInspectBoundary}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Location Verification Status
                    </label>
                    <select
                      value={inspectLocationStatus}
                      onChange={(e) => setInspectLocationStatus(e.target.value as LocationStatus)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      <option value="verified">Verified (Coordinates & Boundary Confirmed)</option>
                      <option value="unverified">Unverified (Pin Needs Field Check)</option>
                      <option value="unavailable">Unavailable (No GPS Confirmed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Admin Audit Notes
                    </label>
                    <input
                      type="text"
                      value={inspectNotes}
                      onChange={(e) => setInspectNotes(e.target.value)}
                      placeholder="Satellite roof match & gate entrance confirmed..."
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDecision(false)}
                    className="min-h-[42px] px-4 rounded-lg border border-rose-300 text-rose-700 text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Listing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDecision(true)}
                    className="min-h-[42px] px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Publish Live</span>
                  </button>
                </div>
              </div>
            )}

            {pendingQueue.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
                title="Verification queue is clear"
                description="All submitted hostels have been audited."
              />
            ) : (
              <div className="space-y-3">
                {pendingQueue.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-display font-bold text-base text-slate-900">{h.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {h.area} · {formatMwk(h.minPriceMwk, h.paymentPeriod)} · Coordinates:{' '}
                        {h.hasCoordinates ? 'Attached' : 'Unavailable'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openInspector(h)}
                      className="min-h-[40px] px-4 rounded-lg bg-[#0A192F] text-white text-xs font-semibold"
                    >
                      Inspect on Satellite
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: All Hostels */}
        {tab === 'hostels' && (
          <div className="space-y-3">
            {allHostels.map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-900">{h.name}</p>
                  <p className="text-xs text-slate-500">
                    {h.area} · Listing: {h.listingStatus} · Verification: {h.verificationStatus} ·
                    Location: {h.locationStatus}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openInspector(h)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                  >
                    Audit Map
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void adminToggleHostelFlags(firebaseUser.uid, h, {
                        isFeatured: !h.isFeatured,
                      })
                        .then(() => pushToast({ title: 'Featured flag updated', variant: 'success' }))
                        .catch((err) =>
                          pushToast({
                            title: 'Could not update featured flag',
                            description: err instanceof Error ? err.message : 'Please try again',
                            variant: 'error',
                          })
                        )
                    }
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold ${
                      h.isFeatured
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 text-slate-700'
                    }`}
                  >
                    {h.isFeatured ? 'Featured' : 'Feature'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void adminToggleHostelFlags(firebaseUser.uid, h, {
                        isSponsored: !h.isSponsored,
                      })
                        .then(() => pushToast({ title: 'Sponsored flag updated', variant: 'success' }))
                        .catch((err) =>
                          pushToast({
                            title: 'Could not update sponsored flag',
                            description: err instanceof Error ? err.message : 'Please try again',
                            variant: 'error',
                          })
                        )
                    }
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold ${
                      h.isSponsored
                        ? 'bg-[#0A192F] text-white'
                        : 'border border-slate-300 text-slate-700'
                    }`}
                  >
                    {h.isSponsored ? 'Sponsored' : 'Sponsor'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void adminToggleHostelFlags(firebaseUser.uid, h, {
                        listingStatus: h.listingStatus === 'suspended' ? 'active' : 'suspended',
                      })
                        .then(() => pushToast({ title: 'Listing status updated', variant: 'info' }))
                        .catch((err) =>
                          pushToast({
                            title: 'Could not update listing status',
                            description: err instanceof Error ? err.message : 'Please try again',
                            variant: 'error',
                          })
                        )
                    }
                    className="min-h-[36px] px-3 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                  >
                    {h.listingStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Users */}
        {tab === 'users' && (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.uid}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-900">
                    {u.displayName}{' '}
                    <span className="text-xs font-normal text-slate-500">({u.role})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Status: {u.accountStatus} · Owner verified: {u.ownerVerified ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {u.role === 'owner' && (
                    <button
                      type="button"
                      onClick={() =>
                        void adminUpdateUserAccount(firebaseUser.uid, u.uid, {
                          ownerVerified: !u.ownerVerified,
                        })
                          .then(() => {
                            void loadSnapshot();
                            pushToast({ title: 'Owner verification updated', variant: 'success' });
                          })
                          .catch((err) =>
                            pushToast({
                              title: 'Could not update owner verification',
                              description: err instanceof Error ? err.message : 'Please try again',
                              variant: 'error',
                            })
                          )
                      }
                      className="min-h-[36px] px-3 rounded-lg border border-emerald-300 text-emerald-800 text-xs font-semibold"
                    >
                      {u.ownerVerified ? 'Revoke Owner Badge' : 'Verify Owner'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void adminUpdateUserAccount(firebaseUser.uid, u.uid, {
                        accountStatus: u.accountStatus === 'active' ? 'suspended' : 'active',
                      })
                        .then(() => {
                          void loadSnapshot();
                          pushToast({ title: 'Account status updated', variant: 'info' });
                        })
                        .catch((err) =>
                          pushToast({
                            title: 'Could not update account status',
                            description: err instanceof Error ? err.message : 'Please try again',
                            variant: 'error',
                          })
                        )
                    }
                    className="min-h-[36px] px-3 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                  >
                    {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Reviews */}
        {tab === 'reviews' && (
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <EmptyState title="No reviews submitted yet" description="Student reviews awaiting moderation appear here." />
            ) : (
              reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-sm text-slate-900">
                      {rev.studentName} · {rev.rating}/5 Stars ({rev.moderationStatus})
                    </p>
                    <p className="text-sm text-slate-700 mt-1">{rev.comment}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void adminModerateReview(firebaseUser.uid, rev.id, 'approved')
                          .then(() => {
                            void loadSnapshot();
                            pushToast({ title: 'Review approved', variant: 'success' });
                          })
                          .catch((err) =>
                            pushToast({
                              title: 'Could not approve review',
                              description: err instanceof Error ? err.message : 'Please try again',
                              variant: 'error',
                            })
                          )
                      }
                      className="min-h-[36px] px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void adminModerateReview(firebaseUser.uid, rev.id, 'rejected')
                          .then(() => {
                            void loadSnapshot();
                            pushToast({ title: 'Review rejected', variant: 'info' });
                          })
                          .catch((err) =>
                            pushToast({
                              title: 'Could not reject review',
                              description: err instanceof Error ? err.message : 'Please try again',
                              variant: 'error',
                            })
                          )
                      }
                      className="min-h-[36px] px-3 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Reports */}
        {tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <EmptyState title="No fraud or listing reports" description="Student reports against listings appear here." />
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-rose-600">
                      {rep.status} · Hostel {rep.hostelId}
                    </p>
                    <p className="font-semibold text-sm text-slate-900 mt-0.5">{rep.reason}</p>
                    <p className="text-sm text-slate-700 mt-1">{rep.details}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void adminUpdateReportStatus(firebaseUser.uid, rep.id, 'resolved')
                          .then(() => {
                            void loadSnapshot();
                            pushToast({ title: 'Report resolved', variant: 'success' });
                          })
                          .catch((err) =>
                            pushToast({
                              title: 'Could not resolve report',
                              description: err instanceof Error ? err.message : 'Please try again',
                              variant: 'error',
                            })
                          )
                      }
                      className="min-h-[36px] px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void adminUpdateReportStatus(firebaseUser.uid, rep.id, 'dismissed')
                          .then(() => {
                            void loadSnapshot();
                            pushToast({ title: 'Report dismissed', variant: 'info' });
                          })
                          .catch((err) =>
                            pushToast({
                              title: 'Could not dismiss report',
                              description: err instanceof Error ? err.message : 'Please try again',
                              variant: 'error',
                            })
                          )
                      }
                      className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Audit Logs */}
        {tab === 'audit' && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No audit entries recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-700">{log.action}</span>
                      <p className="text-slate-800 mt-0.5">{log.summary}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {formatRelativeTime(log.createdAtMs)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Settings */}
        {tab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <h2 className="font-display text-xl font-bold text-slate-900">
                Platform & Monetization Settings
              </h2>
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={featuredEnabled}
                  onChange={(e) => setFeaturedEnabled(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>Enable Featured & Sponsored Placements</span>
              </label>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sponsored Label Text
                </label>
                <input
                  type="text"
                  value={sponsoredLabelText}
                  onChange={(e) => setSponsoredLabelText(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Booking Service Fee (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={bookingFeePercent}
                  onChange={(e) => setBookingFeePercent(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>Maintenance Mode Banner</span>
              </label>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
              >
                Save Global Settings
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Active Owner Subscriptions ({subscriptions.length})
              </h2>
              {subscriptions.length === 0 ? (
                <p className="text-sm text-slate-500">No owner subscription records yet.</p>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-slate-200 p-3 flex items-center justify-between text-sm"
                  >
                    <span className="font-mono text-xs text-slate-700">{sub.ownerId}</span>
                    <span className="font-semibold capitalize text-slate-900">
                      {sub.plan} ({formatMwk(sub.priceMwk)})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
