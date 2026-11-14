import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Compass,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { HostelCard } from '../components/hostel/HostelCard';
import { ToStaySatelliteMap } from '../components/map/ToStaySatelliteMap';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { usePlatform } from '../context/PlatformContext';
import { HERO_IMAGE_URL } from '../data/platformDefaults';
import { filterAndSortHostels } from '../lib/hostelUtils';
import { ROOM_CATEGORY_LABELS, type RoomCategoryType } from '../types/domain';

const FAQS = [
  {
    q: 'How does ToStay verify hostel locations near University of Livingstonia, Rumphi Campus?',
    a: 'Owners submit GPS coordinates and plot boundaries via satellite imagery. Before a listing receives Verified Location status, a ToStay administrator inspects the satellite footprint, entrance gate pin, and address against the University of Livingstonia, Rumphi Campus corridor.',
  },
  {
    q: 'Can I browse hostels before creating an account?',
    a: 'Yes. Students can search, filter by Malawian Kwacha (MWK) budget, inspect satellite maps, and compare properties side-by-side without registering. Signing in with Google is only needed to save favourites, message owners, request viewings, or submit booking requests.',
  },
  {
    q: 'Are prices shown per month or per semester?',
    a: 'Every hostel and room category on ToStay explicitly displays whether rent is billed per month, per semester, or per academic year, alongside any required security deposit in MWK.',
  },
  {
    q: 'What does "Availability Confirmed" mean?',
    a: 'Owners confirm their live available room count inside the Owner Studio. Listings that have not been confirmed within 14 days display a clear staleness warning so students can enquire before travelling.',
  },
];

export const HomePage: React.FC = () => {
  const { campuses, hostels, rooms, systemSettings, isCatalogLoading, catalogError } = usePlatform();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? 'rumphi-main');
  const [maxBudget, setMaxBudget] = useState('');
  const [roomCategory, setRoomCategory] = useState<RoomCategoryType | 'all'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedMapHostelId, setSelectedMapHostelId] = useState<string | null>(null);

  const activeCampus = useMemo(
    () => campuses.find((c) => c.id === campusId) ?? campuses[0],
    [campuses, campusId]
  );

  const featuredHostels = useMemo(() => {
    const sorted = filterAndSortHostels(
      hostels,
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
      activeCampus ? { lat: activeCampus.lat, lng: activeCampus.lng } : null
    );
    return sorted.slice(0, 6);
  }, [hostels, rooms, activeCampus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (campusId) params.set('campus', campusId);
    if (maxBudget.trim()) params.set('maxPrice', maxBudget.trim());
    if (roomCategory !== 'all') params.set('roomType', roomCategory);
    navigate(`/explore?${params.toString()}`);
  };

  return (
    <div className="bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-[#0A192F] text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE_URL}
            alt="ToStay verified student courtyard accommodation in Rumphi, Malawi"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A192F]/80 via-[#0A192F]/75 to-[#0A192F]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
              University of Livingstonia · Rumphi Campus, Malawi
            </p>
            <h1 className="mt-3 font-display text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance leading-[1.12]">
              Your next home is closer than you think.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Find your place. Feel at home. Compare transparent MWK hostel pricing, inspect
              verified Google Satellite boundaries, and book directly with property owners.
            </p>
          </div>

          {/* Search Console */}
          <form
            onSubmit={handleSearch}
            className="mt-8 rounded-2xl bg-white p-3 sm:p-4 shadow-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 text-slate-900"
          >
            <div className="md:col-span-4 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-blue-600 focus-within:bg-white">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <label htmlFor="hero-search" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Hostel or Area
                </label>
                <input
                  id="hero-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Rumphi Boma, Kanyerere..."
                  className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <label htmlFor="hero-campus" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Campus Corridor
              </label>
              <select
                id="hero-campus"
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 focus:outline-none"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <label htmlFor="hero-budget" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Max Rent (MWK)
              </label>
              <input
                id="hero-budget"
                type="number"
                min={0}
                step={5000}
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="e.g. 60000"
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none tabular-nums"
              />
            </div>

            <div className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <label htmlFor="hero-room" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Room Type
              </label>
              <select
                id="hero-room"
                value={roomCategory}
                onChange={(e) => setRoomCategory(e.target.value as RoomCategoryType | 'all')}
                className="w-full bg-transparent text-sm font-medium text-slate-900 focus:outline-none"
              >
                <option value="all">Any room</option>
                {(Object.keys(ROOM_CATEGORY_LABELS) as RoomCategoryType[]).map((key) => (
                  <option key={key} value={key}>
                    {ROOM_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1 flex">
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Find</span>
              </button>
            </div>
          </form>

          {/* Compact Trust Summary */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Satellite-audited property footprints
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-sky-400" />
              Walking & driving routes from campus
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-400" />
              Direct owner enquiries & atomic bookings
            </span>
          </div>
        </div>
      </section>

      {/* Featured & Verified Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Accommodation Directory
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Available Student Hostels in Rumphi
            </h2>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 shrink-0"
          >
            <span>Explore all filters</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isCatalogLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : catalogError ? (
          <EmptyState
            icon={<Building2 className="w-6 h-6 text-rose-600" />}
            title="Unable to load accommodation directory"
            description={catalogError}
          />
        ) : featuredHostels.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="No verified hostels published yet"
            description="Verified student accommodations submitted by property owners and audited by ToStay administrators will appear here."
            action={
              <Link
                to="/dashboard/owner"
                className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold hover:bg-slate-800"
              >
                List Your Property
              </Link>
            }
          />
        ) : (
          <div
            className={`grid grid-cols-1 gap-6 ${
              featuredHostels.length === 4
                ? 'md:grid-cols-2'
                : 'md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {featuredHostels.map((hostel) => (
              <HostelCard
                key={hostel.id}
                hostel={hostel}
                sponsoredLabelText={systemSettings.sponsoredLabelText}
              />
            ))}
          </div>
        )}
      </section>

      {/* Interactive Satellite Map Preview */}
      {activeCampus && (
        <section className="bg-white border-y border-slate-200 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Spatial Verification
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
                  Explore Rumphi on Google Satellite Maps
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Inspect physical roof footprints, entrance gates, and walking distance before spending transport fare.
                </p>
              </div>
              <Link
                to="/map"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Open Full-Screen Map
              </Link>
            </div>

            <ToStaySatelliteMap
              campus={activeCampus}
              hostels={hostels}
              selectedHostelId={selectedMapHostelId}
              onSelectHostel={setSelectedMapHostelId}
              heightClassName="h-[420px]"
            />
          </div>
        </section>
      )}

      {/* How ToStay Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Built for Transparency
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
            How ToStay Protects Students & Empowers Owners
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-sky-400 flex items-center justify-center mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-slate-900">
              1. Search & Compare Honestly
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Filter by MWK budget, payment period, water & power reliability, and walking distance.
              Compare up to 3 hostels side-by-side before reaching out.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-sky-400 flex items-center justify-center mb-4">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-slate-900">
              2. Verify Location via Satellite
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Every geocoded property displays its campus distance, gate entrance marker, and verified boundary polygon—or explicitly states when coordinates are pending.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-sky-400 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-slate-900">
              3. Schedule Viewings & Book
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Message owners in-app, request a physical inspection, and submit booking requests backed by atomic inventory tracking that prevents double allocation.
            </p>
          </div>
        </div>

        {/* Dual CTA for Students & Owners */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#0A192F] text-white p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                For University Students
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold">
                Start shortlisting your next room today
              </h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Save favourites, track viewing schedules, and review completed stays to help incoming cohorts in Rumphi.
              </p>
            </div>
            <div className="mt-6">
              <Link
                to="/explore"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors"
              >
                Browse Available Hostels
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                For Hostel Owners & Landlords
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold text-slate-900">
                Manage rooms, pins & student bookings digitally
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                List your property for free, draw your exact compound boundary on satellite imagery, confirm live room availability, and reply to enquiries in one studio.
              </p>
            </div>
            <div className="mt-6">
              <Link
                to="/dashboard/owner"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0A192F] hover:bg-slate-800 text-sm font-semibold text-white transition-colors"
              >
                Open Owner Studio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white border-t border-slate-200 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-slate-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-display font-semibold text-sm sm:text-base text-slate-900">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
