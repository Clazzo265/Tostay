import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck } from 'lucide-react';
import { ToStaySatelliteMap } from '../components/map/ToStaySatelliteMap';
import { EmptyState } from '../components/ui/EmptyState';
import { usePlatform } from '../context/PlatformContext';
import { formatMwk, haversineDistanceKm } from '../lib/hostelUtils';

export const MapPage: React.FC = () => {
  const { campuses, hostels } = usePlatform();
  const [selectedCampusId, setSelectedCampusId] = useState(campuses[0]?.id ?? 'rumphi-main');
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(
    hostels.find((h) => h.hasCoordinates)?.id ?? null
  );

  const activeCampus = useMemo(
    () => campuses.find((c) => c.id === selectedCampusId) ?? campuses[0],
    [campuses, selectedCampusId]
  );

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)] pb-16 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Satellite Campus & Hostel Map
            </h1>
            <p className="text-sm text-slate-600">
              Select a property to inspect verified boundaries, gate entrances, and campus routes.
            </p>
          </div>
          <select
            aria-label="Select campus"
            value={selectedCampusId}
            onChange={(e) => setSelectedCampusId(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {hostels.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-6 h-6" />}
                title="No verified properties pinned yet"
                description="Property owners can submit GPS pins and compound boundaries in the Owner Studio."
                action={
                  <Link
                    to="/dashboard/owner"
                    className="min-h-[40px] inline-flex items-center px-4 py-2 rounded-lg bg-[#0A192F] text-white text-xs font-semibold"
                  >
                    Open Owner Studio
                  </Link>
                }
              />
            ) : (
              hostels.map((h) => {
                const isSelected = h.id === selectedHostelId;
                const dist =
                  activeCampus && h.hasCoordinates && typeof h.lat === 'number' && typeof h.lng === 'number'
                    ? haversineDistanceKm(
                        { lat: activeCampus.lat, lng: activeCampus.lng },
                        { lat: h.lat, lng: h.lng }
                      )
                    : null;

                return (
                  <div
                    key={h.id}
                    onClick={() => h.hasCoordinates && setSelectedHostelId(h.id)}
                    className={`rounded-xl border p-4 transition-all ${
                      h.hasCoordinates ? 'cursor-pointer' : 'opacity-80'
                    } ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display font-semibold text-sm text-slate-900">{h.name}</h2>
                      {h.locationStatus === 'verified' && (
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {dist !== null ? `${h.area} · ${dist} km from campus` : `${h.area} · Location unavailable`}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        From {formatMwk(h.minPriceMwk, h.paymentPeriod)}
                      </span>
                      <Link
                        to={`/hostel/${h.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="lg:col-span-8">
            {activeCampus && (
              <ToStaySatelliteMap
                campus={activeCampus}
                hostels={hostels}
                selectedHostelId={selectedHostelId}
                onSelectHostel={setSelectedHostelId}
                heightClassName="h-[460px] lg:h-[600px]"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
