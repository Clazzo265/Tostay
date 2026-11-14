import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { BoundaryPickerMap } from '../components/map/BoundaryPickerMap';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { formatMwk, formatRelativeTime, isAvailabilityStale } from '../lib/hostelUtils';
import { hostelSubmissionSchema, roomSchema } from '../lib/validation';
import {
  confirmHostelAvailability,
  createOwnerHostel,
  createRoomCategory,
  ensureOwnerFreeSubscription,
  replyToEnquiry,
  sendConversationMessage,
  subscribeConversationMessages,
  subscribeOwnerHostels,
  subscribeOwnerRooms,
  subscribeUserBookings,
  subscribeUserConversations,
  subscribeUserEnquiries,
  updateBookingStatusAsOwner,
  updateOwnerHostel,
  updateRoomAvailability,
  updateUserProfileAndPreferences,
} from '../services/firestoreService';
import {
  ALL_FACILITIES,
  ROOM_CATEGORY_LABELS,
  type Booking,
  type Conversation,
  type Enquiry,
  type Hostel,
  type LatLngLiteral,
  type Message,
  type OwnerSubscription,
  type PaymentPeriod,
  type Room,
  type RoomCategoryType,
} from '../types/domain';

type OwnerTab = 'properties' | 'bookings' | 'enquiries' | 'messages' | 'subscription';

export const OwnerDashboardPage: React.FC = () => {
  const { firebaseUser, userPublic, userPrivate, isAuthReady, refreshUserProfile } = useAuth();
  const { campuses, pushToast } = usePlatform();

  const [tab, setTab] = useState<OwnerTab>('properties');
  const [ownerHostels, setOwnerHostels] = useState<Hostel[]>([]);
  const [ownerRooms, setOwnerRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [subscription, setSubscription] = useState<OwnerSubscription | null>(null);

  // Property Editor State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? 'rumphi-main');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [minPriceMwk, setMinPriceMwk] = useState('40000');
  const [maxPriceMwk, setMaxPriceMwk] = useState('65000');
  const [depositMwk, setDepositMwk] = useState('40000');
  const [paymentPeriod, setPaymentPeriod] = useState<PaymentPeriod>('monthly');
  const [totalAvailableRooms, setTotalAvailableRooms] = useState('4');
  const [houseRules, setHouseRules] = useState('');
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([
    'Electricity',
    'Water',
    'Security',
    'Toilets',
  ]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [hasCoordinates, setHasCoordinates] = useState(true);
  const [pin, setPin] = useState<LatLngLiteral | undefined>({
    lat: campuses[0]?.lat ?? -11.0186,
    lng: campuses[0]?.lng ?? 33.8574,
  });
  const [entrance, setEntrance] = useState<LatLngLiteral | undefined>(undefined);
  const [boundary, setBoundary] = useState<LatLngLiteral[]>([]);
  const [savingHostel, setSavingHostel] = useState(false);

  // Room Modal State
  const [roomModalHostelId, setRoomModalHostelId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCategory, setRoomCategory] = useState<RoomCategoryType>('single');
  const [roomPriceMwk, setRoomPriceMwk] = useState('45000');
  const [roomDepositMwk, setRoomDepositMwk] = useState('45000');
  const [roomPeriod, setRoomPeriod] = useState<PaymentPeriod>('monthly');
  const [roomTotalUnits, setRoomTotalUnits] = useState('4');
  const [roomAvailableUnits, setRoomAvailableUnits] = useState('4');
  const [roomDescription, setRoomDescription] = useState('');

  // Enquiry Reply drafts
  const [enquiryReplies, setEnquiryReplies] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!firebaseUser) return;
    const u1 = subscribeOwnerHostels(firebaseUser.uid, setOwnerHostels);
    const u2 = subscribeOwnerRooms(firebaseUser.uid, setOwnerRooms);
    const u3 = subscribeUserBookings(firebaseUser.uid, 'ownerId', setBookings);
    const u4 = subscribeUserEnquiries(firebaseUser.uid, 'ownerId', setEnquiries);
    const u5 = subscribeUserConversations(firebaseUser.uid, 'ownerId', (list) => {
      setConversations(list);
      if (list.length > 0 && !selectedConvoId) setSelectedConvoId(list[0].id);
    });
    void ensureOwnerFreeSubscription(firebaseUser.uid)
      .then(setSubscription)
      .catch(() => {});

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [firebaseUser, selectedConvoId]);

  useEffect(() => {
    if (!selectedConvoId) return;
    return subscribeConversationMessages(selectedConvoId, setMessages);
  }, [selectedConvoId]);

  if (!isAuthReady) {
    return <div className="max-w-7xl mx-auto px-4 py-12 text-sm text-slate-600">Loading Owner Studio...</div>;
  }

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="Sign in to access the Owner Property Studio"
          description="List hostels in Rumphi, draw verified satellite boundaries, update room counts, and manage student booking requests."
          action={
            <Link
              to="/auth?role=owner"
              className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
            >
              Sign In as Property Owner
            </Link>
          }
        />
      </div>
    );
  }

  const openNewPropertyForm = () => {
    setEditingHostel(null);
    setCampusId(campuses[0]?.id ?? 'rumphi-main');
    setName('');
    setArea('');
    setAddress('');
    setDescription('');
    setMinPriceMwk('40000');
    setMaxPriceMwk('65000');
    setDepositMwk('40000');
    setPaymentPeriod('monthly');
    setTotalAvailableRooms('4');
    setHouseRules('');
    setOwnerWhatsapp(userPrivate?.whatsapp ?? '');
    setSelectedFacilities(['Electricity', 'Water', 'Security', 'Toilets']);
    setImageUrlInput('');
    setHasCoordinates(true);
    setPin({
      lat: campuses[0]?.lat ?? -11.0186,
      lng: campuses[0]?.lng ?? 33.8574,
    });
    setEntrance(undefined);
    setBoundary([]);
    setEditorOpen(true);
  };

  const openEditPropertyForm = (h: Hostel) => {
    setEditingHostel(h);
    setCampusId(h.campusId);
    setName(h.name);
    setArea(h.area);
    setAddress(h.address);
    setDescription(h.description);
    setMinPriceMwk(String(h.minPriceMwk));
    setMaxPriceMwk(String(h.maxPriceMwk));
    setDepositMwk(String(h.depositMwk));
    setPaymentPeriod(h.paymentPeriod);
    setTotalAvailableRooms(String(h.totalAvailableRooms));
    setHouseRules(h.houseRules ?? '');
    setOwnerWhatsapp(h.ownerWhatsapp ?? '');
    setSelectedFacilities(h.facilities);
    setImageUrlInput(h.imageUrls.join(', '));
    setHasCoordinates(h.hasCoordinates);
    setPin(
      typeof h.lat === 'number' && typeof h.lng === 'number'
        ? { lat: h.lat, lng: h.lng }
        : undefined
    );
    setEntrance(
      typeof h.entranceLat === 'number' && typeof h.entranceLng === 'number'
        ? { lat: h.entranceLat, lng: h.entranceLng }
        : undefined
    );
    setBoundary(h.boundaryCoordinates ?? []);
    setEditorOpen(true);
  };

  const handleSaveHostel = async (e: React.FormEvent, submitForReview: boolean) => {
    e.preventDefault();
    const images = imageUrlInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const candidate = {
      campusId,
      name,
      description,
      address,
      area,
      hasCoordinates: hasCoordinates && Boolean(pin),
      lat: hasCoordinates && pin ? pin.lat : undefined,
      lng: hasCoordinates && pin ? pin.lng : undefined,
      entranceLat: hasCoordinates && entrance ? entrance.lat : undefined,
      entranceLng: hasCoordinates && entrance ? entrance.lng : undefined,
      boundaryCoordinates: hasCoordinates && boundary.length > 0 ? boundary : undefined,
      facilities: selectedFacilities,
      imageUrls: images,
      minPriceMwk: Number(minPriceMwk),
      maxPriceMwk: Number(maxPriceMwk),
      paymentPeriod,
      depositMwk: Number(depositMwk),
      totalAvailableRooms: Number(totalAvailableRooms),
      houseRules: houseRules || undefined,
      ownerDisplayName: userPublic?.displayName || 'Property Owner',
      ownerWhatsapp: ownerWhatsapp || undefined,
    };

    const parsed = hostelSubmissionSchema.safeParse(candidate);
    if (!parsed.success) {
      pushToast({
        title: parsed.error.issues[0]?.message || 'Check property form fields',
        variant: 'error',
      });
      return;
    }

    setSavingHostel(true);
    try {
      if (editingHostel) {
        await updateOwnerHostel(editingHostel, {
          ...parsed.data,
          listingStatus:
            editingHostel.listingStatus === 'active'
              ? undefined
              : submitForReview
              ? 'pending_review'
              : 'draft',
        });
        pushToast({ title: 'Property updated', variant: 'success' });
      } else {
        await createOwnerHostel({
          ...parsed.data,
          ownerId: firebaseUser.uid,
          ownerDisplayName: userPublic?.displayName || firebaseUser.displayName || 'Owner',
          submitForReview,
        });
        pushToast({
          title: submitForReview ? 'Property submitted for Admin verification' : 'Draft saved',
          description: submitForReview
            ? 'An administrator will inspect satellite coordinates and approve your listing.'
            : undefined,
          variant: 'success',
        });
      }
      setEditorOpen(false);
    } catch (err) {
      pushToast({
        title: 'Could not save property',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'error',
      });
    } finally {
      setSavingHostel(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomModalHostelId) return;
    const parsed = roomSchema.safeParse({
      hostelId: roomModalHostelId,
      name: roomName,
      category: roomCategory,
      priceMwk: Number(roomPriceMwk),
      depositMwk: Number(roomDepositMwk),
      paymentPeriod: roomPeriod,
      totalUnits: Number(roomTotalUnits),
      availableUnits: Number(roomAvailableUnits),
      isPublished: true,
      description: roomDescription || undefined,
    });
    if (!parsed.success) {
      pushToast({ title: parsed.error.issues[0]?.message || 'Invalid room details', variant: 'error' });
      return;
    }
    try {
      await createRoomCategory({
        ...parsed.data,
        ownerId: firebaseUser.uid,
      });
      setRoomModalHostelId(null);
      setRoomName('');
      setRoomDescription('');
      pushToast({ title: 'Room category published', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to add room category',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      });
    }
  };

  const handleSwitchToOwnerRole = async () => {
    try {
      await updateUserProfileAndPreferences(firebaseUser.uid, firebaseUser.email || '', {
        displayName: userPublic?.displayName || firebaseUser.displayName || 'Property Owner',
        role: 'owner',
      });
      await refreshUserProfile();
      pushToast({ title: 'Switched to Property Owner account', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Role update failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      });
    }
  };

  const totalOpenRooms = ownerHostels.reduce((acc, h) => acc + h.totalAvailableRooms, 0);
  const pendingBookingsCount = bookings.filter((b) =>
    ['pending', 'under_review', 'viewing_requested'].includes(b.status)
  ).length;
  const openEnquiriesCount = enquiries.filter((e) => e.status === 'open').length;

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId) ?? null;

  return (
    <div className="bg-slate-50 min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Hostel Owner & Property Management Studio
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Manage Properties & Bookings
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {userPublic?.role === 'student' && (
              <button
                type="button"
                onClick={() => void handleSwitchToOwnerRole()}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-blue-600 text-blue-700 text-sm font-semibold hover:bg-blue-50"
              >
                Activate Owner Role
              </button>
            )}
            <button
              type="button"
              onClick={openNewPropertyForm}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#0A192F] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              <span>Add Property</span>
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Your Properties</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {ownerHostels.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Open Rooms Listed</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {totalOpenRooms}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Pending Bookings</p>
            <p className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
              {pendingBookingsCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Open Enquiries</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {openEnquiriesCount}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200">
          {(
            [
              { id: 'properties', label: `Properties (${ownerHostels.length})` },
              { id: 'bookings', label: `Booking Requests (${bookings.length})` },
              { id: 'enquiries', label: `Enquiries & Viewings (${enquiries.length})` },
              { id: 'messages', label: `Messages (${conversations.length})` },
              { id: 'subscription', label: 'Plan & Monetization' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                tab === t.id
                  ? 'bg-[#0A192F] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Properties */}
        {tab === 'properties' && (
          <div className="space-y-6">
            {editorOpen && (
              <form className="rounded-2xl border border-slate-300 bg-white p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {editingHostel ? `Edit ${editingHostel.name}` : 'Register New Student Hostel'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Nyika View Student Hostels"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nearest Campus *
                    </label>
                    <select
                      value={campusId}
                      onChange={(e) => setCampusId(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      {campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Area / Neighbourhood *
                    </label>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Rumphi Boma / Kanyerere"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Street Address / Landmarks *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Plot number or road directions"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Property Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe room layout, water reliability, security, and study environment..."
                    className="w-full p-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Min Rent (MWK)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={minPriceMwk}
                      onChange={(e) => setMinPriceMwk(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Rent (MWK)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={maxPriceMwk}
                      onChange={(e) => setMaxPriceMwk(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deposit (MWK)
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={depositMwk}
                      onChange={(e) => setDepositMwk(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Billing Period
                    </label>
                    <select
                      value={paymentPeriod}
                      onChange={(e) => setPaymentPeriod(e.target.value as PaymentPeriod)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      <option value="monthly">Per Month</option>
                      <option value="semester">Per Semester</option>
                      <option value="academic_year">Per Academic Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Available Rooms
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={totalAvailableRooms}
                      onChange={(e) => setTotalAvailableRooms(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Facilities & Utilities
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALL_FACILITIES.map((fac) => (
                      <label
                        key={fac}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFacilities.includes(fac)}
                          onChange={() =>
                            setSelectedFacilities((prev) =>
                              prev.includes(fac)
                                ? prev.filter((item) => item !== fac)
                                : [...prev, fac]
                            )
                          }
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        <span>{fac}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Photo URLs (comma-separated HTTPS URLs)
                    </label>
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp Contact Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={ownerWhatsapp}
                      onChange={(e) => setOwnerWhatsapp(e.target.value)}
                      placeholder="+265..."
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    House Rules (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={houseRules}
                    onChange={(e) => setHouseRules(e.target.value)}
                    placeholder="Gate hours, visitor policy, quiet study hours..."
                    className="w-full p-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                {/* Satellite Pin & Boundary Section */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-slate-900">
                        GPS Pin, Entrance Gate & Compound Boundary
                      </h3>
                      <p className="text-xs text-slate-600">
                        Click on Satellite imagery to set your property location and boundary polygon for verification.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hasCoordinates}
                        onChange={(e) => setHasCoordinates(!e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span>Coordinates not available yet</span>
                    </label>
                  </div>

                  {hasCoordinates && (
                    <>
                      <BoundaryPickerMap
                        centerFallback={{
                          lat: campuses[0]?.lat ?? -11.0186,
                          lng: campuses[0]?.lng ?? 33.8574,
                        }}
                        pin={pin}
                        entrance={entrance}
                        boundary={boundary}
                        onChangePin={setPin}
                        onChangeEntrance={setEntrance}
                        onChangeBoundary={setBoundary}
                      />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 mb-1">Hostel Lat</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={pin?.lat ?? ''}
                            onChange={(e) =>
                              setPin({
                                lat: Number(e.target.value),
                                lng: pin?.lng ?? 33.8574,
                              })
                            }
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-300 tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">Hostel Lng</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={pin?.lng ?? ''}
                            onChange={(e) =>
                              setPin({
                                lat: pin?.lat ?? -11.0186,
                                lng: Number(e.target.value),
                              })
                            }
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-300 tabular-nums"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={savingHostel}
                    onClick={(e) => void handleSaveHostel(e, false)}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={savingHostel}
                    onClick={(e) => void handleSaveHostel(e, true)}
                    className="min-h-[44px] px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                  >
                    {savingHostel ? 'Saving...' : 'Submit for Admin Verification'}
                  </button>
                </div>
              </form>
            )}

            {ownerHostels.length === 0 ? (
              <EmptyState
                icon={<Building2 className="w-6 h-6" />}
                title="No hostels registered under your account yet"
                description="Add your first property with transparent MWK pricing, room categories, and satellite pin placement."
                action={
                  <button
                    type="button"
                    onClick={openNewPropertyForm}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
                  >
                    Add Your First Hostel
                  </button>
                }
              />
            ) : (
              <div className="space-y-4">
                {ownerHostels.map((h) => {
                  const hRooms = ownerRooms.filter((r) => r.hostelId === h.id);
                  const stale = isAvailabilityStale(h.lastAvailabilityConfirmationMs);
                  return (
                    <div
                      key={h.id}
                      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="text-blue-700 uppercase tracking-wider">
                              Listing: {h.listingStatus.replace('_', ' ')}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span
                              className={
                                h.verificationStatus === 'verified'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }
                            >
                              Verification: {h.verificationStatus}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-600">Location: {h.locationStatus}</span>
                          </div>
                          <h3 className="font-display font-bold text-xl text-slate-900 mt-1">
                            {h.name}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {h.area} · {formatMwk(h.minPriceMwk)} –{' '}
                            {formatMwk(h.maxPriceMwk, h.paymentPeriod)}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              stale ? 'text-amber-700 font-semibold' : 'text-slate-500'
                            }`}
                          >
                            {h.totalAvailableRooms} rooms available · Confirmed{' '}
                            {formatRelativeTime(h.lastAvailabilityConfirmationMs)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void confirmHostelAvailability(h.id, h.totalAvailableRooms).then(() =>
                                pushToast({
                                  title: 'Availability timestamp refreshed',
                                  variant: 'success',
                                })
                              )
                            }
                            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Confirm Availability</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoomModalHostelId(h.id)}
                            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            + Add Room Type
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPropertyForm(h)}
                            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0A192F] text-white text-xs font-semibold"
                          >
                            Edit Property
                          </button>
                        </div>
                      </div>

                      {hRooms.length > 0 && (
                        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {hRooms.map((rm) => (
                            <div
                              key={rm.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between gap-3"
                            >
                              <div>
                                <p className="font-semibold text-sm text-slate-900">{rm.name}</p>
                                <p className="text-xs text-slate-600 tabular-nums">
                                  {ROOM_CATEGORY_LABELS[rm.category]} ·{' '}
                                  {formatMwk(rm.priceMwk, rm.paymentPeriod)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                  {rm.availableUnits}/{rm.totalUnits} open
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateRoomAvailability(
                                      rm.id,
                                      Math.max(0, rm.availableUnits - 1)
                                    )
                                  }
                                  className="w-7 h-7 rounded border border-slate-300 bg-white text-xs font-bold"
                                  aria-label="Decrease available units"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateRoomAvailability(
                                      rm.id,
                                      Math.min(rm.totalUnits, rm.availableUnits + 1)
                                    )
                                  }
                                  className="w-7 h-7 rounded border border-slate-300 bg-white text-xs font-bold"
                                  aria-label="Increase available units"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Bookings */}
        {tab === 'bookings' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <EmptyState
                title="No booking requests yet"
                description="Incoming student booking requests for your properties will appear here."
              />
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Status: {b.status.replace('_', ' ')}
                    </p>
                    <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">
                      {b.studentName} — {b.hostelName} ({b.roomName})
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 tabular-nums">
                      {b.checkInDate} → {b.checkOutDate} ·{' '}
                      {formatMwk(b.totalAmountMwk, b.rentalPeriod)}
                    </p>
                    {b.notes && <p className="text-xs text-slate-500 mt-1">Student notes: {b.notes}</p>}
                  </div>

                  {!['declined', 'cancelled', 'completed'].includes(b.status) && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {b.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() =>
                            void updateBookingStatusAsOwner(b, 'accepted')
                              .then(() =>
                                pushToast({
                                  title: 'Booking accepted & room unit reserved atomically',
                                  variant: 'success',
                                })
                              )
                              .catch((err) =>
                                pushToast({
                                  title: 'Cannot accept booking',
                                  description: err instanceof Error ? err.message : 'Check units',
                                  variant: 'error',
                                })
                              )
                          }
                          className="min-h-[40px] px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          Accept & Reserve Room
                        </button>
                      )}
                      {b.status === 'accepted' && (
                        <button
                          type="button"
                          onClick={() =>
                            void updateBookingStatusAsOwner(b, 'completed').then(() =>
                              pushToast({ title: 'Booking marked completed', variant: 'success' })
                            )
                          }
                          className="min-h-[40px] px-3.5 rounded-lg bg-[#0A192F] text-white text-xs font-semibold"
                        >
                          Mark Stay Completed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void updateBookingStatusAsOwner(b, 'declined').then(() =>
                            pushToast({ title: 'Booking declined', variant: 'info' })
                          )
                        }
                        className="min-h-[40px] px-3.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Enquiries */}
        {tab === 'enquiries' && (
          <div className="space-y-4">
            {enquiries.length === 0 ? (
              <EmptyState
                title="No enquiries or viewing requests"
                description="Student questions and viewing schedules will appear here."
              />
            ) : (
              enquiries.map((enq) => (
                <div key={enq.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      {enq.type} · {enq.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(enq.createdAtMs)}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    {enq.studentName}: {enq.subject}
                  </h3>
                  <p className="text-sm text-slate-700">{enq.message}</p>
                  {enq.preferredDate && (
                    <p className="text-xs text-slate-500">
                      Requested date: <strong>{enq.preferredDate}</strong>
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <input
                      type="text"
                      value={enquiryReplies[enq.id] ?? enq.ownerReply ?? ''}
                      onChange={(e) =>
                        setEnquiryReplies((prev) => ({ ...prev, [enq.id]: e.target.value }))
                      }
                      placeholder="Reply with viewing times or room details..."
                      className="flex-1 min-h-[40px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void replyToEnquiry(
                          enq,
                          enquiryReplies[enq.id] || 'Confirmed — please visit during daytime hours.',
                          enq.type === 'viewing' ? 'scheduled' : 'responded'
                        ).then(() => pushToast({ title: 'Reply sent to student', variant: 'success' }))
                      }
                      className="min-h-[40px] px-4 rounded-lg bg-[#0A192F] text-white text-xs font-semibold"
                    >
                      {enq.type === 'viewing' ? 'Confirm Viewing & Reply' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Messages */}
        {tab === 'messages' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 space-y-2">
              {conversations.length === 0 ? (
                <EmptyState
                  title="No student messages yet"
                  description="When students message you about a property, chats appear here."
                />
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConvoId(c.id)}
                    className={`w-full text-left rounded-xl border p-4 ${
                      c.id === selectedConvoId
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="font-semibold text-sm text-slate-900">{c.studentName}</p>
                    <p className="text-xs text-slate-500">{c.hostelName}</p>
                    <p className="text-xs text-slate-600 mt-1 truncate">{c.lastMessage}</p>
                  </button>
                ))
              )}
            </div>
            <div className="md:col-span-8">
              {selectedConvo ? (
                <div className="rounded-2xl border border-slate-200 bg-white flex flex-col h-[460px]">
                  <div className="px-5 py-3.5 border-b border-slate-200">
                    <h3 className="font-display font-bold text-base text-slate-900">
                      {selectedConvo.studentName} — {selectedConvo.hostelName}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {messages.map((m) => {
                      const mine = m.senderId === firebaseUser.uid;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                              mine ? 'bg-[#0A192F] text-white' : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <p>{m.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!replyText.trim()) return;
                      void sendConversationMessage(selectedConvo, firebaseUser.uid, replyText).then(
                        () => setReplyText('')
                      );
                    }}
                    className="p-3 border-t border-slate-200 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Reply to student..."
                      className="flex-1 min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Select a student conversation to reply.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Subscription */}
        {tab === 'subscription' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border-2 border-blue-600 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-slate-900">Starter Owner</h3>
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                MWK 0 / month
              </p>
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                Active Plan: {subscription?.plan ?? 'free'}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Unlimited verified room categories
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Satellite pin & boundary verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Atomic student booking management
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-slate-900">Growth Featured</h3>
                <CreditCard className="w-5 h-5 text-slate-400" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                MWK 25,000 / month
              </p>
              <p className="text-xs text-slate-500 mt-1">Configured by ToStay Admin</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>· Priority featured placement in Rumphi search</li>
                <li>· Sponsored placement label above organic results</li>
                <li>· Multi-block availability analytics</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-display font-bold text-lg text-slate-900">Institutional Estate</h3>
              <p className="mt-2 font-display text-2xl font-bold text-slate-900 tabular-nums">
                MWK 75,000 / semester
              </p>
              <p className="text-xs text-slate-500 mt-1">For multi-hostel property managers</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>· Dedicated verification fast-track</li>
                <li>· University housing office directory sync</li>
                <li>· Bulk room inventory updates</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Add Room Modal */}
      {roomModalHostelId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRoom}
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Add Room Category
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room Title</label>
              <input
                type="text"
                required
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Standard Single Study Room"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={roomCategory}
                  onChange={(e) => setRoomCategory(e.target.value as RoomCategoryType)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  {(Object.keys(ROOM_CATEGORY_LABELS) as RoomCategoryType[]).map((key) => (
                    <option key={key} value={key}>
                      {ROOM_CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Period</label>
                <select
                  value={roomPeriod}
                  onChange={(e) => setRoomPeriod(e.target.value as PaymentPeriod)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="monthly">Monthly</option>
                  <option value="semester">Semester</option>
                  <option value="academic_year">Academic Year</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rent (MWK)
                </label>
                <input
                  type="number"
                  min={1000}
                  required
                  value={roomPriceMwk}
                  onChange={(e) => setRoomPriceMwk(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deposit (MWK)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={roomDepositMwk}
                  onChange={(e) => setRoomDepositMwk(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Units
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={roomTotalUnits}
                  onChange={(e) => setRoomTotalUnits(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Available Now
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={roomAvailableUnits}
                  onChange={(e) => setRoomAvailableUnits(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                value={roomDescription}
                onChange={(e) => setRoomDescription(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoomModalHostelId(null)}
                className="min-h-[42px] px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
              >
                Publish Room Category
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
