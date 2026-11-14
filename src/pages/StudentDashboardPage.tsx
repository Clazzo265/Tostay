import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Calendar, Heart, MessageSquare, Send, User } from 'lucide-react';
import { HostelCard } from '../components/hostel/HostelCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { filterAndSortHostels, formatMwk, formatRelativeTime } from '../lib/hostelUtils';
import { userProfileSchema } from '../lib/validation';
import {
  markNotificationRead,
  sendConversationMessage,
  subscribeConversationMessages,
  subscribeUserBookings,
  subscribeUserConversations,
  subscribeUserEnquiries,
  updateBookingStatusAsStudent,
  updateUserProfileAndPreferences,
} from '../services/firestoreService';
import type { Booking, Conversation, Enquiry, Message } from '../types/domain';

type Tab = 'overview' | 'bookings' | 'enquiries' | 'messages' | 'notifications' | 'profile';

export const StudentDashboardPage: React.FC = () => {
  const { firebaseUser, userPublic, userPrivate, isAuthReady, refreshUserProfile } = useAuth();
  const {
    campuses,
    hostels,
    rooms,
    favoriteHostelIds,
    recentlyViewedIds,
    notifications,
    unreadNotificationsCount,
    pushToast,
  } = usePlatform();

  const [tab, setTab] = useState<Tab>('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'student' | 'owner'>('student');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [preferredCampusId, setPreferredCampusId] = useState('rumphi-main');
  const [maxBudgetMwk, setMaxBudgetMwk] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (userPublic) {
      setDisplayName(userPublic.displayName);
      setRole(userPublic.role === 'owner' ? 'owner' : 'student');
      setUniversityName(userPublic.universityName ?? '');
    }
    if (userPrivate) {
      setPhone(userPrivate.phone ?? '');
      setWhatsapp(userPrivate.whatsapp ?? '');
      setStudentIdNumber(userPrivate.studentIdNumber ?? '');
      setPreferredCampusId(userPrivate.preferredCampusId ?? 'rumphi-main');
      setMaxBudgetMwk(userPrivate.maxBudgetMwk ? String(userPrivate.maxBudgetMwk) : '');
    }
  }, [userPublic, userPrivate]);

  useEffect(() => {
    if (!firebaseUser) return;
    const u1 = subscribeUserBookings(firebaseUser.uid, 'studentId', setBookings);
    const u2 = subscribeUserEnquiries(firebaseUser.uid, 'studentId', setEnquiries);
    const u3 = subscribeUserConversations(firebaseUser.uid, 'studentId', (list) => {
      setConversations(list);
      if (list.length > 0 && !selectedConvoId) {
        setSelectedConvoId(list[0].id);
      }
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, [firebaseUser, selectedConvoId]);

  useEffect(() => {
    if (!selectedConvoId) {
      setMessages([]);
      return;
    }
    return subscribeConversationMessages(selectedConvoId, setMessages);
  }, [selectedConvoId]);

  const savedHostels = useMemo(() => {
    const campus = campuses[0];
    return filterAndSortHostels(
      hostels.filter((h) => favoriteHostelIds.has(h.id)),
      rooms,
      {
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
        sortBy: 'relevance',
      },
      campus ? { lat: campus.lat, lng: campus.lng } : null
    );
  }, [hostels, rooms, favoriteHostelIds, campuses]);

  const recentHostels = useMemo(
    () => hostels.filter((h) => recentlyViewedIds.includes(h.id)),
    [hostels, recentlyViewedIds]
  );

  if (!isAuthReady) {
    return <div className="max-w-7xl mx-auto px-4 py-12 text-sm text-slate-600">Loading workspace...</div>;
  }

  if (!firebaseUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<User className="w-6 h-6" />}
          title="Sign in to access your Student Housing Dashboard"
          description="Save favourite hostels, track physical viewing appointments, manage booking requests, and chat with owners."
          action={
            <Link
              to="/auth"
              className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
            >
              Sign In with Google
            </Link>
          }
        />
      </div>
    );
  }

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId) ?? null;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvo || !replyText.trim()) return;
    try {
      await sendConversationMessage(selectedConvo, firebaseUser.uid, replyText);
      setReplyText('');
    } catch (err) {
      pushToast({
        title: 'Message failed',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'error',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = userProfileSchema.safeParse({
      displayName,
      role,
      phone: phone || undefined,
      whatsapp: whatsapp || undefined,
      studentIdNumber: studentIdNumber || undefined,
      universityName: universityName || undefined,
      preferredCampusId: preferredCampusId || undefined,
      maxBudgetMwk: maxBudgetMwk ? Number(maxBudgetMwk) : undefined,
    });
    if (!parsed.success) {
      pushToast({ title: parsed.error.issues[0]?.message || 'Invalid profile fields', variant: 'error' });
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfileAndPreferences(
        firebaseUser.uid,
        firebaseUser.email || '',
        parsed.data
      );
      await refreshUserProfile();
      pushToast({ title: 'Profile & preferences saved', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to save profile',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Student Accommodation Workspace
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Welcome, {userPublic?.displayName || 'Student'}
            </h1>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
          >
            Find More Hostels
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200">
          {(
            [
              { id: 'overview', label: `Saved & Recent (${savedHostels.length})` },
              { id: 'bookings', label: `Bookings (${bookings.length})` },
              { id: 'enquiries', label: `Viewings & Enquiries (${enquiries.length})` },
              { id: 'messages', label: `Messages (${conversations.length})` },
              { id: 'notifications', label: `Notifications (${unreadNotificationsCount})` },
              { id: 'profile', label: 'Profile & Preferences' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-[#0A192F] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-8">
            <section>
              <h2 className="font-display text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-600" />
                Saved Shortlist
              </h2>
              {savedHostels.length === 0 ? (
                <EmptyState
                  title="No saved hostels yet"
                  description="Bookmark properties from Explore to compare them and track availability here."
                  action={
                    <Link
                      to="/explore"
                      className="min-h-[42px] inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
                    >
                      Explore Hostels
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedHostels.map((h) => (
                    <HostelCard key={h.id} hostel={h} />
                  ))}
                </div>
              )}
            </section>

            {recentHostels.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
                  Recently Viewed
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentHostels.map((h) => (
                    <Link
                      key={h.id}
                      to={`/hostel/${h.id}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-500 transition-colors"
                    >
                      <p className="font-display font-semibold text-sm text-slate-900">{h.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {h.area} · {formatMwk(h.minPriceMwk, h.paymentPeriod)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="No booking requests yet"
                description="Once you request a room from a live property profile, you can track its approval status here."
              />
            ) : (
              bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      Status: {b.status.replace('_', ' ')}
                    </p>
                    <h3 className="font-display font-bold text-lg text-slate-900 mt-0.5">
                      {b.hostelName} — {b.roomName}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 tabular-nums">
                      {b.checkInDate} to {b.checkOutDate} · {formatMwk(b.totalAmountMwk, b.rentalPeriod)}
                    </p>
                    {b.notes && <p className="text-xs text-slate-500 mt-1">Notes: {b.notes}</p>}
                  </div>
                  {!['declined', 'cancelled', 'completed'].includes(b.status) && (
                    <button
                      type="button"
                      onClick={() => setCancelBookingId(b.id)}
                      className="min-h-[40px] px-4 py-2 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 shrink-0"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'enquiries' && (
          <div className="space-y-4">
            {enquiries.length === 0 ? (
              <EmptyState
                title="No enquiries or viewing requests"
                description="Send a question or physical viewing request on any property profile."
              />
            ) : (
              enquiries.map((enq) => (
                <div key={enq.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                      {enq.type} · {enq.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(enq.createdAtMs)}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-slate-900 mt-1">
                    {enq.subject}
                  </h3>
                  <p className="text-sm text-slate-700 mt-1">{enq.message}</p>
                  {enq.preferredDate && (
                    <p className="text-xs text-slate-500 mt-1">
                      Preferred viewing date: {enq.preferredDate}
                    </p>
                  )}
                  {enq.ownerReply && (
                    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-800">
                      <strong>Owner Reply:</strong> {enq.ownerReply}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 space-y-2">
              {conversations.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="w-6 h-6" />}
                  title="No conversations yet"
                  description="Start a direct chat from any hostel page."
                />
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConvoId(c.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      c.id === selectedConvoId
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-display font-semibold text-sm text-slate-900 truncate">
                      {c.hostelName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{c.ownerName}</p>
                    <p className="text-xs text-slate-600 mt-1.5 truncate">{c.lastMessage}</p>
                  </button>
                ))
              )}
            </div>

            <div className="md:col-span-8">
              {selectedConvo ? (
                <div className="rounded-2xl border border-slate-200 bg-white flex flex-col h-[460px]">
                  <div className="px-5 py-3.5 border-b border-slate-200">
                    <h3 className="font-display font-bold text-base text-slate-900">
                      {selectedConvo.hostelName}
                    </h3>
                    <p className="text-xs text-slate-500">With {selectedConvo.ownerName}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {messages.map((m) => {
                      const mine = m.senderId === firebaseUser.uid;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                              mine
                                ? 'bg-[#0A192F] text-white'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <p>{m.body}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                mine ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {formatRelativeTime(m.createdAtMs)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <form
                    onSubmit={handleSendReply}
                    className="p-3 border-t border-slate-200 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a message..."
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
                  Select a conversation to view messages.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-3 max-w-3xl">
            {notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="w-6 h-6" />}
                title="All caught up"
                description="Booking updates, viewing confirmations, and owner replies will appear here."
              />
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
                    n.read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/40'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(n.createdAtMs)}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => void markNotificationRead(n.id)}
                      className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 space-y-5"
          >
            <h2 className="font-display text-xl font-bold text-slate-900">
              Account & Housing Preferences
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'student' | 'owner')}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="student">Student</option>
                  <option value="owner">Hostel Owner / Property Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+265..."
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+265..."
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  University Name
                </label>
                <input
                  type="text"
                  value={universityName}
                  onChange={(e) => setUniversityName(e.target.value)}
                  placeholder="Rumphi University Campus"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student ID (Private)
                </label>
                <input
                  type="text"
                  value={studentIdNumber}
                  onChange={(e) => setStudentIdNumber(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preferred Campus
                </label>
                <select
                  value={preferredCampusId}
                  onChange={(e) => setPreferredCampusId(e.target.value)}
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
                  Target Max Budget (MWK)
                </label>
                <input
                  type="number"
                  min={0}
                  value={maxBudgetMwk}
                  onChange={(e) => setMaxBudgetMwk(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Preferences'}
            </button>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelBookingId)}
        title="Cancel booking request?"
        description="This will mark your accommodation request as cancelled and notify the property owner."
        confirmLabel="Cancel Request"
        destructive
        onCancel={() => setCancelBookingId(null)}
        onConfirm={() => {
          const id = cancelBookingId;
          setCancelBookingId(null);
          if (!id) return;
          void updateBookingStatusAsStudent(id)
            .then(() => pushToast({ title: 'Booking cancelled', variant: 'info' }))
            .catch((err) =>
              pushToast({
                title: 'Unable to cancel',
                description: err instanceof Error ? err.message : 'Try again',
                variant: 'error',
              })
            );
        }}
      />
    </div>
  );
};
