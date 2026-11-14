import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  AlertTriangle,
  Car,
  ExternalLink,
  Footprints,
  GraduationCap,
  Layers,
  MapPin,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMwk, haversineDistanceKm } from '../../lib/hostelUtils';
import type { Campus, Hostel, LatLngLiteral } from '../../types/domain';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

interface PolygonOverlayProps {
  paths: LatLngLiteral[];
  strokeColor?: string;
  fillColor?: string;
}

const PolygonOverlay: React.FC<PolygonOverlayProps> = ({
  paths,
  strokeColor = '#38BDF8',
  fillColor = '#38BDF8',
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib || paths.length < 3) return;
    const polygon = new google.maps.Polygon({
      paths,
      strokeColor,
      strokeOpacity: 0.95,
      strokeWeight: 2.5,
      fillColor,
      fillOpacity: 0.22,
      clickable: false,
      map,
    });
    return () => {
      polygon.setMap(null);
    };
  }, [map, mapsLib, paths, strokeColor, fillColor]);

  return null;
};

interface RouteOverlayProps {
  origin: LatLngLiteral;
  destination: LatLngLiteral;
  travelMode: 'WALKING' | 'DRIVING';
  onRouteInfo: (info: { distanceText: string; durationText: string } | null) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  travelMode,
  onRouteInfo,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!map || !routesLib) return;

    const clearLines = () => {
      for (const pl of polylinesRef.current) {
        pl.setMap(null);
      }
      polylinesRef.current = [];
    };
    clearLines();

    const compute = async () => {
      try {
        const RouteClass = (routesLib as unknown as {
          Route?: {
            computeRoutes?: (req: Record<string, unknown>) => Promise<{ routes?: unknown[] }>;
            new (): { computeRoutes: (req: Record<string, unknown>) => Promise<{ routes?: unknown[] }> };
          };
          TravelMode?: Record<string, unknown>;
        }).Route;

        if (!RouteClass) {
          onRouteInfo(null);
          return;
        }

        const modeEnum =
          (routesLib as unknown as { TravelMode?: Record<string, unknown> }).TravelMode?.[
            travelMode
          ] ?? travelMode;

        const req = {
          origin,
          destination,
          travelMode: modeEnum,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        };

        let result: { routes?: Array<Record<string, unknown>> } | undefined;
        if (typeof RouteClass.computeRoutes === 'function') {
          result = (await RouteClass.computeRoutes(req)) as {
            routes?: Array<Record<string, unknown>>;
          };
        } else {
          const instance = new RouteClass();
          result = (await instance.computeRoutes(req)) as {
            routes?: Array<Record<string, unknown>>;
          };
        }

        if (cancelled) return;
        const primaryRoute = result?.routes?.[0];
        if (!primaryRoute) {
          onRouteInfo(null);
          return;
        }

        if (typeof (primaryRoute as { createPolylines?: () => google.maps.Polyline[] }).createPolylines === 'function') {
          const lines = (
            primaryRoute as { createPolylines: (opts?: Record<string, unknown>) => google.maps.Polyline[] }
          ).createPolylines({
            polylineOptions: {
              strokeColor: travelMode === 'WALKING' ? '#38BDF8' : '#2563EB',
              strokeOpacity: 0.95,
              strokeWeight: 5,
            },
          });
          lines.forEach((line) => line.setMap(map));
          polylinesRef.current = lines;
        } else if (
          (primaryRoute.polyline as { encodedPolyline?: string } | undefined)?.encodedPolyline &&
          typeof (RouteClass as unknown as { decode?: (enc: string) => google.maps.LatLng[] }).decode === 'function'
        ) {
          const decoded = (
            RouteClass as unknown as { decode: (enc: string) => google.maps.LatLng[] }
          ).decode((primaryRoute.polyline as { encodedPolyline: string }).encodedPolyline);
          const line = new google.maps.Polyline({
            path: decoded,
            geodesic: true,
            strokeColor: travelMode === 'WALKING' ? '#38BDF8' : '#2563EB',
            strokeOpacity: 0.95,
            strokeWeight: 5,
            map,
          });
          polylinesRef.current = [line];
        }

        const meters = Number(primaryRoute.distanceMeters ?? 0);
        const millis = Number(primaryRoute.durationMillis ?? 0);
        if (meters > 0) {
          const distanceText =
            meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
          const mins = Math.max(1, Math.round(millis / 60000));
          onRouteInfo({
            distanceText,
            durationText: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`,
          });
        } else {
          const straightKm = haversineDistanceKm(origin, destination);
          onRouteInfo({
            distanceText: `~${straightKm} km`,
            durationText: travelMode === 'WALKING' ? `~${Math.max(2, Math.round(straightKm * 12))} min walk` : `~${Math.max(1, Math.round(straightKm * 3))} min drive`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('quota') ||
          msg.includes('429') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          const straightKm = haversineDistanceKm(origin, destination);
          onRouteInfo({
            distanceText: `${straightKm} km straight-line`,
            durationText: travelMode === 'WALKING' ? `~${Math.max(2, Math.round(straightKm * 12))} min` : `~${Math.max(1, Math.round(straightKm * 3))} min`,
          });
        }
      }
    };

    void compute();

    return () => {
      cancelled = true;
      clearLines();
    };
  }, [map, routesLib, origin, destination, travelMode, onRouteInfo]);

  return null;
};

interface ClusteredHostelMarkersProps {
  hostels: Hostel[];
  selectedHostelId: string | null;
  onSelect: (hostel: Hostel) => void;
}

const ClusteredHostelMarkers: React.FC<ClusteredHostelMarkersProps> = ({
  hostels,
  selectedHostelId,
  onSelect,
}) => {
  const map = useMap();
  const markerLib = useMapsLibrary('marker');

  useEffect(() => {
    if (!map || !markerLib || hostels.length < 6) return;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    for (const h of hostels) {
      if (typeof h.lat !== 'number' || typeof h.lng !== 'number') continue;
      const isSelected = h.id === selectedHostelId;
      const pin = new markerLib.PinElement({
        background: isSelected ? '#2563EB' : h.locationStatus === 'verified' ? '#059669' : '#D97706',
        borderColor: '#FFFFFF',
        glyphColor: '#FFFFFF',
        scale: isSelected ? 1.25 : 1,
      });
      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: h.lat, lng: h.lng },
        title: h.name,
        content: pin.element,
      });
      marker.addListener('click', () => onSelect(h));
      markers.push(marker);
    }

    const clusterer = new MarkerClusterer({ map, markers });
    return () => {
      clusterer.clearMarkers();
    };
  }, [map, markerLib, hostels, selectedHostelId, onSelect]);

  return null;
};

interface ToStaySatelliteMapProps {
  campus: Campus;
  hostels: Hostel[];
  selectedHostelId?: string | null;
  onSelectHostel?: (hostelId: string) => void;
  showDirections?: boolean;
  autoOpenInfoWindow?: boolean;
  heightClassName?: string;
}

export const ToStaySatelliteMap: React.FC<ToStaySatelliteMapProps> = ({
  campus,
  hostels,
  selectedHostelId = null,
  onSelectHostel,
  showDirections = true,
  autoOpenInfoWindow = false,
  heightClassName = 'h-[420px] md:h-[520px]',
}) => {
  const apiStatus = useApiLoadingStatus();
  const hasApiKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const [mapTypeId, setMapTypeId] = useState<'satellite' | 'hybrid' | 'roadmap'>('hybrid');
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedHostelId);
  const [infoWindowId, setInfoWindowId] = useState<string | null>(
    autoOpenInfoWindow ? selectedHostelId : null
  );
  const [travelMode, setTravelMode] = useState<'WALKING' | 'DRIVING'>('WALKING');
  const [directionsActive, setDirectionsActive] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string } | null>(null);

  useEffect(() => {
    setInternalSelectedId(selectedHostelId);
    if (autoOpenInfoWindow) {
      setInfoWindowId(selectedHostelId);
    }
  }, [selectedHostelId, autoOpenInfoWindow]);

  const activeId = selectedHostelId ?? internalSelectedId;
  const geocodedHostels = useMemo(
    () =>
      hostels.filter(
        (h) => h.hasCoordinates && typeof h.lat === 'number' && typeof h.lng === 'number'
      ),
    [hostels]
  );

  const selectedHostel = useMemo(
    () => hostels.find((h) => h.id === activeId) ?? null,
    [hostels, activeId]
  );

  const infoHostel = useMemo(
    () => hostels.find((h) => h.id === infoWindowId) ?? null,
    [hostels, infoWindowId]
  );

  const mapCenter = useMemo<LatLngLiteral>(() => {
    if (
      selectedHostel &&
      selectedHostel.hasCoordinates &&
      typeof selectedHostel.lat === 'number' &&
      typeof selectedHostel.lng === 'number'
    ) {
      return { lat: selectedHostel.lat, lng: selectedHostel.lng };
    }
    return { lat: campus.lat, lng: campus.lng };
  }, [selectedHostel, campus]);

  const handleMarkerClick = (h: Hostel) => {
    setInternalSelectedId(h.id);
    setInfoWindowId(h.id);
    onSelectHostel?.(h.id);
  };

  const mapUnavailable =
    !hasApiKey ||
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  if (mapUnavailable) {
    return (
      <div
        className={`relative rounded-2xl border border-slate-200 bg-[#0A192F] text-white overflow-hidden flex flex-col justify-between p-6 ${heightClassName}`}
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-sky-300">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Interactive Satellite Map Waiting on Maps API Key</span>
          </div>
          <h3 className="mt-4 font-display text-xl font-bold">
            {campus.name} Spatial Reference
          </h3>
          <p className="mt-1 text-sm text-slate-300 max-w-xl">
            Campus Hub Coordinates: {campus.lat.toFixed(4)}, {campus.lng.toFixed(4)} ({campus.district}, {campus.country}).
            Configure <code className="text-sky-300">VITE_GOOGLE_MAPS_API_KEY</code> to render live Google Satellite imagery, verified property boundaries, and walking routes.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-60 pr-1">
          {geocodedHostels.map((h) => {
            const dist = haversineDistanceKm(
              { lat: campus.lat, lng: campus.lng },
              { lat: h.lat!, lng: h.lng! }
            );
            return (
              <div
                key={h.id}
                className="rounded-xl bg-slate-900/80 border border-slate-700 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {h.area} · {dist} km from campus · {formatMwk(h.minPriceMwk, h.paymentPeriod)}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const destinationCoords =
    selectedHostel && selectedHostel.hasCoordinates && typeof selectedHostel.lat === 'number' && typeof selectedHostel.lng === 'number'
      ? {
          lat: selectedHostel.entranceLat ?? selectedHostel.lat,
          lng: selectedHostel.entranceLng ?? selectedHostel.lng,
        }
      : null;

  return (
    <div className={`relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-900 ${heightClassName}`}>
      {/* Map Layer, Directions & Route Summary Stack (never overlaps Google logo at bottom) */}
      <div className="absolute top-3 left-3 right-14 z-10 flex flex-col items-start gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="inline-flex rounded-lg bg-white/95 backdrop-blur border border-slate-200 p-1 shadow-sm">
            {(['hybrid', 'satellite', 'roadmap'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMapTypeId(mode)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                  mapTypeId === mode
                    ? 'bg-[#0A192F] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {mode === 'hybrid' ? 'Satellite + Labels' : mode}
              </button>
            ))}
          </div>

          {showDirections && destinationCoords && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-white/95 backdrop-blur border border-slate-200 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setDirectionsActive((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  directionsActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{directionsActive ? 'Hide Route' : 'Route from Campus'}</span>
              </button>
              {directionsActive && (
                <>
                  <button
                    type="button"
                    onClick={() => setTravelMode('WALKING')}
                    className={`p-1.5 rounded-md ${
                      travelMode === 'WALKING'
                        ? 'bg-sky-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Walking route"
                    aria-label="Walking route"
                  >
                    <Footprints className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTravelMode('DRIVING')}
                    className={`p-1.5 rounded-md ${
                      travelMode === 'DRIVING'
                        ? 'bg-sky-100 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Driving route"
                    aria-label="Driving route"
                  >
                    <Car className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {directionsActive && routeInfo && (
          <div className="pointer-events-auto rounded-lg bg-[#0A192F]/95 backdrop-blur border border-slate-700 px-3 py-1.5 text-xs text-white shadow-lg flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold tabular-nums">{routeInfo.distanceText}</span>
            <span className="text-slate-400">·</span>
            <span className="text-sky-300 tabular-nums">{routeInfo.durationText}</span>
          </div>
        )}
      </div>

      <GoogleMap
        defaultCenter={mapCenter}
        center={mapCenter}
        defaultZoom={selectedHostel ? 17 : 15}
        mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
        mapTypeId={mapTypeId}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={ATTRIBUTION_IDS}
        className="w-full h-full"
      >
        {/* Campus Anchor Pin */}
        <AdvancedMarker
          position={{ lat: campus.lat, lng: campus.lng }}
          title={campus.name}
        >
          <div className="flex items-center gap-1.5 rounded-full bg-[#0A192F] text-white border-2 border-sky-400 px-2.5 py-1 shadow-lg text-xs font-semibold">
            <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
            <span>Campus Hub</span>
          </div>
        </AdvancedMarker>

        {/* Hostel Markers: Clustered when >= 6, direct Pin markers when < 6 */}
        {geocodedHostels.length >= 6 ? (
          <ClusteredHostelMarkers
            hostels={geocodedHostels}
            selectedHostelId={activeId}
            onSelect={handleMarkerClick}
          />
        ) : (
          geocodedHostels.map((h) => {
            const isSelected = h.id === activeId;
            return (
              <AdvancedMarker
                key={h.id}
                position={{ lat: h.lat!, lng: h.lng! }}
                title={h.name}
                onClick={() => handleMarkerClick(h)}
              >
                <Pin
                  background={
                    isSelected
                      ? '#2563EB'
                      : h.locationStatus === 'verified'
                      ? '#059669'
                      : '#D97706'
                  }
                  borderColor="#FFFFFF"
                  glyphColor="#FFFFFF"
                  scale={isSelected ? 1.25 : 1}
                />
              </AdvancedMarker>
            );
          })
        )}

        {/* Selected Hostel Boundary Polygon + Entrance Marker */}
        {selectedHostel?.hasCoordinates &&
          selectedHostel.boundaryCoordinates &&
          selectedHostel.boundaryCoordinates.length >= 3 && (
            <PolygonOverlay paths={selectedHostel.boundaryCoordinates} />
          )}

        {selectedHostel?.hasCoordinates &&
          typeof selectedHostel.entranceLat === 'number' &&
          typeof selectedHostel.entranceLng === 'number' && (
            <AdvancedMarker
              position={{
                lat: selectedHostel.entranceLat,
                lng: selectedHostel.entranceLng,
              }}
              title={`${selectedHostel.name} Entrance`}
            >
              <div className="rounded-md bg-emerald-700 text-white border border-white px-2 py-0.5 text-[10px] font-bold shadow">
                Gate / Entrance
              </div>
            </AdvancedMarker>
          )}

        {/* Clicked Hostel InfoWindow */}
        {infoHostel &&
          infoHostel.hasCoordinates &&
          typeof infoHostel.lat === 'number' &&
          typeof infoHostel.lng === 'number' && (
            <InfoWindow
              position={{ lat: infoHostel.lat, lng: infoHostel.lng }}
              onCloseClick={() => setInfoWindowId(null)}
            >
              <div className="max-w-[230px] p-1 text-slate-900">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {infoHostel.locationStatus === 'verified'
                      ? 'Verified Location'
                      : 'Coordinates Submitted'}
                  </span>
                </div>
                <p className="font-display font-bold text-sm leading-snug">
                  {infoHostel.name}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{infoHostel.area}</p>
                <p className="text-xs font-bold text-slate-900 mt-1.5 tabular-nums">
                  From {formatMwk(infoHostel.minPriceMwk, infoHostel.paymentPeriod)}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Link
                    to={`/hostel/${infoHostel.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-[#0A192F] text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-700"
                  >
                    Open Property
                  </Link>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${infoHostel.lat},${infoHostel.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                  >
                    <MapPin className="w-3 h-3" />
                    Maps
                  </a>
                </div>
              </div>
            </InfoWindow>
          )}

        {/* Walking / Driving Route Overlay */}
        {directionsActive && destinationCoords && (
          <RouteOverlay
            origin={{ lat: campus.lat, lng: campus.lng }}
            destination={destinationCoords}
            travelMode={travelMode}
            onRouteInfo={setRouteInfo}
          />
        )}
      </GoogleMap>
    </div>
  );
};
