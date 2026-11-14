import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, LayoutGrid, Map as MapIcon, RotateCcw, Scale, X } from 'lucide-react';
import { HostelCard } from '../components/hostel/HostelCard';
import { ToStaySatelliteMap } from '../components/map/ToStaySatelliteMap';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { usePlatform } from '../context/PlatformContext';
import { filterAndSortHostels } from '../lib/hostelUtils';
import {
  ALL_FACILITIES,
  ROOM_CATEGORY_LABELS,
  type HostelSearchFilters,
  type RoomCategoryType,
  type SortOption,
} from '../types/domain';

const PAGE_SIZE = 6;

export const ExplorePage: React.FC = () => {
  const { campuses, hostels, rooms, compareIds, clearCompare, systemSettings, isCatalogLoading } =
    usePlatform();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [campusId, setCampusId] = useState(searchParams.get('campus') ?? 'all');
  const [area, setArea] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  const [maxDistanceKm, setMaxDistanceKm] = useState('');
  const [roomCategory, setRoomCategory] = useState<RoomCategoryType | 'all'>(
    (searchParams.get('roomType') as RoomCategoryType) || 'all'
  );
  const [facilities, setFacilities] = useState<string[]>([]);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'split'>('grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedMapHostelId, setSelectedMapHostelId] = useState<string | null>(null);

  const activeCampus = useMemo(
    () => campuses.find((c) => c.id === campusId) ?? campuses[0],
    [campuses, campusId]
  );

  const uniqueAreas = useMemo(() => {
    const set = new Set(hostels.map((h) => h.area).filter(Boolean));
    return Array.from(set).sort();
  }, [hostels]);

  const filters: HostelSearchFilters = useMemo(
    () => ({
      query,
      campusId,
      area,
      minPriceMwk: minPrice ? Number(minPrice) : null,
      maxPriceMwk: maxPrice ? Number(maxPrice) : null,
      maxDistanceKm: maxDistanceKm ? Number(maxDistanceKm) : null,
      roomCategory,
      facilities,
      onlyVerified,
      onlyAvailable,
      sortBy,
    }),
    [
      query,
      campusId,
      area,
      minPrice,
      maxPrice,
      maxDistanceKm,
      roomCategory,
      facilities,
      onlyVerified,
      onlyAvailable,
      sortBy,
    ]
  );

  const results = useMemo(
    () =>
      filterAndSortHostels(
        hostels,
        rooms,
        filters,
        activeCampus ? { lat: activeCampus.lat, lng: activeCampus.lng } : null
      ),
    [hostels, rooms, filters, activeCampus]
  );

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedResults = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleFacility = (fac: string) => {
    setPage(1);
    setFacilities((prev) =>
      prev.includes(fac) ? prev.filter((item) => item !== fac) : [...prev, fac]
    );
  };

  const resetFilters = () => {
    setQuery('');
    setCampusId('all');
    setArea('all');
    setMinPrice('');
    setMaxPrice('');
    setMaxDistanceKm('');
    setRoomCategory('all');
    setFacilities([]);
    setOnlyVerified(false);
    setOnlyAvailable(false);
    setSortBy('relevance');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Explore Student Accommodation
            </h1>
            <p className="text-sm text-slate-600 mt-0.5 tabular-nums">
              {results.length} {results.length === 1 ? 'property' : 'properties'} matching your criteria
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>

            <select
              aria-label="Sort hostels"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                setPage(1);
              }}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800"
            >
              <option value="relevance">Sort: Recommended</option>
              <option value="price_asc">Price: Low to High (MWK)</option>
              <option value="price_desc">Price: High to Low (MWK)</option>
              <option value="distance_asc">Distance from Campus</option>
              <option value="newest">Newest Listed</option>
            </select>

            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
                  viewMode === 'grid' ? 'bg-[#0A192F] text-white' : 'text-slate-700'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
                  viewMode === 'split' ? 'bg-[#0A192F] text-white' : 'text-slate-700'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map Split</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters Sidebar */}
        <aside
          className={`lg:col-span-3 space-y-6 ${
            mobileFiltersOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-slate-900">Filters</h2>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Keyword / Landmark
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search hostel name or area..."
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Campus
              </label>
              <select
                value={campusId}
                onChange={(e) => {
                  setCampusId(e.target.value);
                  setPage(1);
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="all">All active campuses</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Area / Neighbourhood
              </label>
              <select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setPage(1);
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="all">All areas</option>
                {uniqueAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Min MWK
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder="0"
                  className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Max MWK
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Any"
                  className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Max Distance from Campus (km)
              </label>
              <input
                type="number"
                min={0.2}
                step={0.5}
                value={maxDistanceKm}
                onChange={(e) => {
                  setMaxDistanceKm(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 2.5 km"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Category
              </label>
              <select
                value={roomCategory}
                onChange={(e) => {
                  setRoomCategory(e.target.value as RoomCategoryType | 'all');
                  setPage(1);
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="all">All categories</option>
                {(Object.keys(ROOM_CATEGORY_LABELS) as RoomCategoryType[]).map((key) => (
                  <option key={key} value={key}>
                    {ROOM_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVerified}
                  onChange={(e) => {
                    setOnlyVerified(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <span>Verified listings only</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => {
                    setOnlyAvailable(e.target.checked);
                    setPage(1);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <span>Rooms available right now</span>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">Facilities</p>
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {ALL_FACILITIES.map((fac) => (
                  <label
                    key={fac}
                    className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={facilities.includes(fac)}
                      onChange={() => toggleFacility(fac)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>{fac}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Results + Optional Split Map */}
        <main className="lg:col-span-9 space-y-6">
          {viewMode === 'split' && activeCampus && (
            <ToStaySatelliteMap
              campus={activeCampus}
              hostels={results}
              selectedHostelId={selectedMapHostelId}
              onSelectHostel={setSelectedMapHostelId}
              heightClassName="h-[380px]"
            />
          )}

          {isCatalogLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : hostels.length === 0 ? (
            <EmptyState
              title="No verified hostels published yet"
              description="Approved student accommodations from verified property owners will appear here once audited."
              action={
                <Link
                  to="/dashboard/owner"
                  className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
                >
                  Open Owner Studio
                </Link>
              }
            />
          ) : pagedResults.length === 0 ? (
            <EmptyState
              title="No matching hostels found"
              description="Try adjusting your MWK budget ceiling, removing facility constraints, or clearing the distance limit."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
                >
                  Clear All Filters
                </button>
              }
            />
          ) : (
            <>
              <div
                className={`grid grid-cols-1 gap-6 ${
                  viewMode === 'split' ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {pagedResults.map((hostel) => (
                  <HostelCard
                    key={hostel.id}
                    hostel={hostel}
                    sponsoredLabelText={systemSettings.sponsoredLabelText}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="min-h-[40px] px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-slate-600 tabular-nums px-3">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="min-h-[40px] px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Sticky Compare Bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 inset-x-4 z-30 max-w-2xl mx-auto rounded-2xl bg-[#0A192F] text-white px-4 py-3 shadow-2xl border border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm">
            <Scale className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-medium tabular-nums">
              {compareIds.length} of 3 hostels selected for comparison
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCompare}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Clear compare list"
            >
              <X className="w-4 h-4" />
            </button>
            <Link
              to="/compare"
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
            >
              Compare Now
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
