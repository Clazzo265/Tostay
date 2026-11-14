import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, MapPin, Minus, Scale, ShieldCheck, X } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { SafeImage } from '../components/ui/SafeImage';
import { usePlatform } from '../context/PlatformContext';
import { formatMwk, formatRelativeTime, haversineDistanceKm } from '../lib/hostelUtils';
import { ALL_FACILITIES } from '../types/domain';

export const ComparePage: React.FC = () => {
  const { hostels, campuses, compareIds, toggleCompare, clearCompare } = usePlatform();

  const selectedHostels = useMemo(
    () => hostels.filter((h) => compareIds.includes(h.id)),
    [hostels, compareIds]
  );

  const defaultCampus = campuses[0];

  return (
    <div className="bg-slate-50 min-h-screen py-10 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Compare Hostels Side-by-Side
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Evaluate MWK pricing, campus distance, location verification, and facilities across up to 3 properties.
            </p>
          </div>
          {selectedHostels.length > 0 && (
            <button
              type="button"
              onClick={clearCompare}
              className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Clear Comparison
            </button>
          )}
        </div>

        {selectedHostels.length === 0 ? (
          <EmptyState
            icon={<Scale className="w-6 h-6" />}
            title="No properties selected to compare"
            description="Tap the scale icon on any hostel card in Explore to compare pricing, facilities, and distance side-by-side."
            action={
              <Link
                to="/explore"
                className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0A192F] text-white text-sm font-semibold"
              >
                Browse Hostels
              </Link>
            }
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-5 w-48 text-xs font-semibold uppercase tracking-wider text-slate-500 align-top">
                    Property Overview
                  </th>
                  {selectedHostels.map((h) => (
                    <th key={h.id} className="p-5 align-top min-w-[220px]">
                      <div className="relative rounded-xl overflow-hidden mb-3">
                        <SafeImage src={h.imageUrls[0]} alt={h.name} aspectClassName="aspect-[16/10]" />
                        <button
                          type="button"
                          onClick={() => toggleCompare(h.id)}
                          aria-label={`Remove ${h.name}`}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <Link
                        to={`/hostel/${h.id}`}
                        className="font-display font-bold text-base text-slate-900 hover:text-blue-700 block"
                      >
                        {h.name}
                      </Link>
                      <p className="text-xs font-normal text-slate-500 mt-0.5">{h.area}</p>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                <tr>
                  <td className="p-4 font-semibold text-slate-700">Price Range</td>
                  {selectedHostels.map((h) => (
                    <td key={h.id} className="p-4 font-bold text-slate-900 tabular-nums">
                      {formatMwk(h.minPriceMwk)} – {formatMwk(h.maxPriceMwk, h.paymentPeriod)}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-slate-700">Security Deposit</td>
                  {selectedHostels.map((h) => (
                    <td key={h.id} className="p-4 text-slate-700 tabular-nums">
                      {formatMwk(h.depositMwk)}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-slate-700">Campus Distance</td>
                  {selectedHostels.map((h) => {
                    const targetCampus = campuses.find((c) => c.id === h.campusId) ?? defaultCampus;
                    const dist =
                      targetCampus && h.hasCoordinates && typeof h.lat === 'number' && typeof h.lng === 'number'
                        ? haversineDistanceKm(
                            { lat: targetCampus.lat, lng: targetCampus.lng },
                            { lat: h.lat, lng: h.lng }
                          )
                        : null;
                    return (
                      <td key={h.id} className="p-4 text-slate-700 tabular-nums">
                        {dist !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            {dist} km
                          </span>
                        ) : (
                          <span className="text-amber-700">Location unavailable</span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-slate-700">Verification</td>
                  {selectedHostels.map((h) => (
                    <td key={h.id} className="p-4">
                      {h.verificationStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <ShieldCheck className="w-4 h-4" />
                          Verified ({h.locationStatus})
                        </span>
                      ) : (
                        <span className="text-amber-700 capitalize">{h.verificationStatus}</span>
                      )}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="p-4 font-semibold text-slate-700">Available Rooms</td>
                  {selectedHostels.map((h) => (
                    <td key={h.id} className="p-4 tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {h.totalAvailableRooms} available
                      </span>
                      <span className="block text-xs text-slate-500">
                        Confirmed {formatRelativeTime(h.lastAvailabilityConfirmationMs)}
                      </span>
                    </td>
                  ))}
                </tr>

                {ALL_FACILITIES.map((fac) => (
                  <tr key={fac}>
                    <td className="px-4 py-2.5 text-slate-600">{fac}</td>
                    {selectedHostels.map((h) => {
                      const has = h.facilities.some((f) => f.toLowerCase() === fac.toLowerCase());
                      return (
                        <td key={h.id} className="px-4 py-2.5">
                          {has ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Minus className="w-4 h-4 text-slate-300" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr>
                  <td className="p-4" />
                  {selectedHostels.map((h) => (
                    <td key={h.id} className="p-4">
                      <Link
                        to={`/hostel/${h.id}`}
                        className="inline-flex items-center justify-center w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#0A192F] text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        View & Request Booking
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
