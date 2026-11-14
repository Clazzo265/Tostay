import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MapPin, Scale, ShieldCheck, AlertTriangle } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import {
  formatMwk,
  formatRelativeTime,
  isAvailabilityStale,
  type HostelWithMetrics,
} from '../../lib/hostelUtils';
import { SafeImage } from '../ui/SafeImage';

interface HostelCardProps {
  hostel: HostelWithMetrics;
  sponsoredLabelText?: string;
}

export const HostelCard: React.FC<HostelCardProps> = ({
  hostel,
  sponsoredLabelText = 'Sponsored Placement',
}) => {
  const { favoriteHostelIds, toggleFavorite, compareIds, toggleCompare } = usePlatform();
  const isSaved = favoriteHostelIds.has(hostel.id);
  const isCompared = compareIds.includes(hostel.id);
  const stale = isAvailabilityStale(hostel.lastAvailabilityConfirmationMs);

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-md transition-all flex flex-col">
      <div className="relative">
        <Link to={`/hostel/${hostel.id}`} className="block">
          <SafeImage
            src={hostel.imageUrls[0]}
            alt={hostel.name}
            fallbackLabel={hostel.name}
            aspectClassName="aspect-[4/3]"
            className="group-hover:scale-[1.02] transition-transform duration-300"
          />
        </Link>

        {/* Maximum 1 subtle top-left status indicator */}
        {hostel.verificationStatus === 'verified' ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-md bg-emerald-950/85 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Verified
          </span>
        ) : null}

        {/* Interactive Save + Compare buttons (44px touch target) */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleCompare(hostel.id)}
            aria-label={isCompared ? `Remove ${hostel.name} from compare` : `Compare ${hostel.name}`}
            aria-pressed={isCompared}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur border transition-colors ${
              isCompared
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'
            }`}
            title="Compare side-by-side"
          >
            <Scale className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void toggleFavorite(hostel.id)}
            aria-label={isSaved ? `Unsave ${hostel.name}` : `Save ${hostel.name}`}
            aria-pressed={isSaved}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur border transition-colors ${
              isSaved
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'
            }`}
            title="Save hostel"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Unboxed middot-separated metadata line */}
          <p className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{hostel.area}</span>
            <span>·</span>
            {hostel.hasCoordinates && hostel.distanceKm !== null ? (
              <span className="inline-flex items-center gap-1 text-slate-700 tabular-nums">
                <MapPin className="w-3 h-3 text-blue-600" />
                {hostel.distanceKm} km from campus
              </span>
            ) : (
              <span className="text-amber-700">Location unavailable</span>
            )}
            {hostel.isSponsored && (
              <>
                <span>·</span>
                <span className="text-blue-700 font-semibold">{sponsoredLabelText}</span>
              </>
            )}
          </p>

          <Link to={`/hostel/${hostel.id}`} className="block mt-1.5">
            <h3 className="font-display font-semibold text-base text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
              {hostel.name}
            </h3>
          </Link>

          <p className="mt-1.5 text-sm text-slate-600 line-clamp-2 leading-relaxed">
            {hostel.description}
          </p>

          {/* Compact unboxed facilities summary */}
          <p className="mt-3 text-xs text-slate-500 truncate">
            {hostel.facilities.slice(0, 4).join(' · ')}
            {hostel.facilities.length > 4 ? ` +${hostel.facilities.length - 4}` : ''}
          </p>
        </div>

        <div className="mt-4 pt-3.5 border-t border-slate-100">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xs text-slate-500 block">From</span>
              <span className="font-display font-bold text-base text-slate-900 tabular-nums">
                {formatMwk(hostel.minPriceMwk, hostel.paymentPeriod)}
              </span>
            </div>
            <Link
              to={`/hostel/${hostel.id}`}
              className="inline-flex items-center justify-center min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0"
            >
              View Property
            </Link>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span
              className={`font-medium tabular-nums ${
                hostel.totalAvailableRooms > 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {hostel.totalAvailableRooms > 0
                ? `${hostel.totalAvailableRooms} rooms available`
                : 'Currently full'}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${
                stale ? 'text-amber-700 font-medium' : 'text-slate-500'
              }`}
              title="Last confirmed by property owner"
            >
              {stale && <AlertTriangle className="w-3 h-3 shrink-0" />}
              Confirmed {formatRelativeTime(hostel.lastAvailabilityConfirmationMs)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
