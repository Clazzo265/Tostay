import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Download, GraduationCap, MapPin, ShieldCheck } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { formatMwk, haversineDistanceKm } from '../lib/hostelUtils';
import { ROOM_CATEGORY_LABELS, type RoomCategoryType } from '../types/domain';

export const UniversityDashboardPage: React.FC = () => {
  const { campuses, hostels, rooms } = usePlatform();
  const [selectedCampusId, setSelectedCampusId] = useState(campuses[0]?.id ?? 'rumphi-main');

  const activeCampus = useMemo(
    () => campuses.find((c) => c.id === selectedCampusId) ?? campuses[0],
    [campuses, selectedCampusId]
  );

  const campusHostels = useMemo(
    () => hostels.filter((h) => !selectedCampusId || h.campusId === selectedCampusId),
    [hostels, selectedCampusId]
  );

  const metrics = useMemo(() => {
    const verified = campusHostels.filter((h) => h.verificationStatus === 'verified').length;
    const geocoded = campusHostels.filter((h) => h.hasCoordinates).length;
    const openRooms = campusHostels.reduce((sum, h) => sum + h.totalAvailableRooms, 0);

    const monthlyPrices = campusHostels
      .filter((h) => h.paymentPeriod === 'monthly')
      .map((h) => h.minPriceMwk);
    const avgMonthlyMwk =
      monthlyPrices.length > 0
        ? Math.round(monthlyPrices.reduce((a, b) => a + b, 0) / monthlyPrices.length)
        : 0;

    const distances = campusHostels
      .filter(
        (h) =>
          activeCampus && h.hasCoordinates && typeof h.lat === 'number' && typeof h.lng === 'number'
      )
      .map((h) =>
        haversineDistanceKm(
          { lat: activeCampus!.lat, lng: activeCampus!.lng },
          { lat: h.lat!, lng: h.lng! }
        )
      );
    const avgDistKm =
      distances.length > 0
        ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(2)
        : '—';

    return { verified, geocoded, openRooms, avgMonthlyMwk, avgDistKm };
  }, [campusHostels, activeCampus]);

  const areaBreakdown = useMemo(() => {
    const map = new window.Map<
      string,
      { count: number; openRooms: number; minMwk: number; maxMwk: number }
    >();
    for (const h of campusHostels) {
      const existing = map.get(h.area);
      if (!existing) {
        map.set(h.area, {
          count: 1,
          openRooms: h.totalAvailableRooms,
          minMwk: h.minPriceMwk,
          maxMwk: h.maxPriceMwk,
        });
      } else {
        existing.count += 1;
        existing.openRooms += h.totalAvailableRooms;
        existing.minMwk = Math.min(existing.minMwk, h.minPriceMwk);
        existing.maxMwk = Math.max(existing.maxMwk, h.maxPriceMwk);
      }
    }
    return Array.from(map.entries());
  }, [campusHostels]);

  const categoryBreakdown = useMemo(() => {
    const hostelIds = new Set(campusHostels.map((h) => h.id));
    const campusRooms = rooms.filter((r) => hostelIds.has(r.hostelId));
    const counts: Record<RoomCategoryType, { totalUnits: number; availableUnits: number }> = {
      single: { totalUnits: 0, availableUnits: 0 },
      shared: { totalUnits: 0, availableUnits: 0 },
      self_contained: { totalUnits: 0, availableUnits: 0 },
      furnished: { totalUnits: 0, availableUnits: 0 },
      other: { totalUnits: 0, availableUnits: 0 },
    };
    for (const r of campusRooms) {
      counts[r.category].totalUnits += r.totalUnits;
      counts[r.category].availableUnits += r.availableUnits;
    }
    return (Object.keys(counts) as RoomCategoryType[]).map((k) => ({
      category: k,
      label: ROOM_CATEGORY_LABELS[k],
      ...counts[k],
    }));
  }, [campusHostels, rooms]);

  const handleExportCsv = () => {
    const headers = [
      'Property Name',
      'Area',
      'Verification Status',
      'Location Status',
      'Min Price MWK',
      'Max Price MWK',
      'Payment Period',
      'Available Rooms',
      'Data Source',
    ];
    const rows = campusHostels.map((h) => [
      `"${h.name.replace(/"/g, '""')}"`,
      `"${h.area.replace(/"/g, '""')}"`,
      h.verificationStatus,
      h.locationStatus,
      h.minPriceMwk,
      h.maxPriceMwk,
      h.paymentPeriod,
      h.totalAvailableRooms,
      'Live Owner Submission',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tostay-${selectedCampusId}-housing-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="rounded-2xl bg-[#0A192F] text-white p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
              <GraduationCap className="w-4 h-4" />
              <span>University & Institutional Partner Portal</span>
            </div>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold">
              {activeCampus?.universityName || 'Campus Accommodation Insights'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-2xl">
              Live off-campus housing supply, spatial verification coverage, and MWK affordability
              monitoring for student welfare and dean-of-students offices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select campus"
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              className="min-h-[42px] px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV Report</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Tracked Properties</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {campusHostels.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Verified Listings</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
              {metrics.verified}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Open Student Rooms</p>
            <p className="mt-1 font-display text-2xl font-bold text-blue-700 tabular-nums">
              {metrics.openRooms}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Avg. Monthly Starting Rent</p>
            <p className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
              {metrics.avgMonthlyMwk > 0 ? formatMwk(metrics.avgMonthlyMwk) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Avg. Distance to Campus</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {metrics.avgDistKm} {metrics.avgDistKm !== '—' ? 'km' : ''}
            </p>
          </div>
        </div>

        {/* Breakdown Grids */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Supply & MWK Range by Area
            </h2>
            <div className="divide-y divide-slate-100">
              {areaBreakdown.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">
                  No verified listings recorded for this campus yet.
                </p>
              ) : (
                areaBreakdown.map(([areaName, stats]) => (
                  <div key={areaName} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{areaName}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {stats.count} {stats.count === 1 ? 'hostel' : 'hostels'} · {stats.openRooms}{' '}
                        open rooms
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900 tabular-nums text-xs sm:text-sm">
                      {formatMwk(stats.minMwk)} – {formatMwk(stats.maxMwk)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Capacity by Room Category
            </h2>
            <div className="divide-y divide-slate-100">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="py-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{item.label}</span>
                  <span className="tabular-nums text-slate-600">
                    <strong className="text-slate-900">{item.availableUnits}</strong> open /{' '}
                    {item.totalUnits} total units
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Provider Directory Table */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Accommodation Provider Directory
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Area</th>
                  <th className="px-6 py-3">Verification</th>
                  <th className="px-6 py-3">Starting Rent</th>
                  <th className="px-6 py-3">Open Rooms</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campusHostels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                      No verified providers published for this campus yet.
                    </td>
                  </tr>
                ) : (
                  campusHostels.map((h) => (
                    <tr key={h.id}>
                      <td className="px-6 py-3.5 font-semibold text-slate-900">{h.name}</td>
                      <td className="px-6 py-3.5 text-slate-600">{h.area}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
                          <ShieldCheck className="w-4 h-4" />
                          {h.verificationStatus} ({h.locationStatus})
                        </span>
                      </td>
                      <td className="px-6 py-3.5 tabular-nums text-slate-900">
                        {formatMwk(h.minPriceMwk, h.paymentPeriod)}
                      </td>
                      <td className="px-6 py-3.5 tabular-nums font-semibold text-slate-900">
                        {h.totalAvailableRooms}
                      </td>
                      <td className="px-6 py-3.5">
                        <Link
                          to={`/hostel/${h.id}`}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Inspect →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
