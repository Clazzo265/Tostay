import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, Eraser, MapPin, PenTool } from 'lucide-react';
import type { LatLngLiteral } from '../../types/domain';

type DrawMode = 'pin' | 'entrance' | 'boundary';

interface BoundaryPickerMapProps {
  centerFallback: LatLngLiteral;
  pin?: LatLngLiteral;
  entrance?: LatLngLiteral;
  boundary: LatLngLiteral[];
  onChangePin: (coords: LatLngLiteral) => void;
  onChangeEntrance: (coords: LatLngLiteral) => void;
  onChangeBoundary: (coords: LatLngLiteral[]) => void;
}

const PickerPolygonAndClicks: React.FC<{
  mode: DrawMode;
  boundary: LatLngLiteral[];
  onMapClick: (latLng: LatLngLiteral) => void;
}> = ({ mode, boundary, onMapClick }) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onMapClick({
        lat: Number(e.latLng.lat().toFixed(6)),
        lng: Number(e.latLng.lng().toFixed(6)),
      });
    });
    return () => listener.remove();
  }, [map, mode, onMapClick]);

  useEffect(() => {
    if (!map || !mapsLib || boundary.length < 2) return;
    const poly =
      boundary.length >= 3
        ? new google.maps.Polygon({
            paths: boundary,
            strokeColor: '#38BDF8',
            strokeOpacity: 0.95,
            strokeWeight: 2.5,
            fillColor: '#38BDF8',
            fillOpacity: 0.25,
            clickable: false,
            map,
          })
        : new google.maps.Polyline({
            path: boundary,
            strokeColor: '#38BDF8',
            strokeWeight: 2.5,
            clickable: false,
            map,
          });
    return () => {
      poly.setMap(null);
    };
  }, [map, mapsLib, boundary]);

  return null;
};

export const BoundaryPickerMap: React.FC<BoundaryPickerMapProps> = ({
  centerFallback,
  pin,
  entrance,
  boundary,
  onChangePin,
  onChangeEntrance,
  onChangeBoundary,
}) => {
  const [mode, setMode] = useState<DrawMode>('pin');
  const apiStatus = useApiLoadingStatus();
  const hasApiKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const mapUnavailable =
    !hasApiKey ||
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE;

  const handleClick = (pt: LatLngLiteral) => {
    if (mode === 'pin') {
      onChangePin(pt);
    } else if (mode === 'entrance') {
      onChangeEntrance(pt);
    } else {
      if (boundary.length >= 25) return;
      onChangeBoundary([...boundary, pt]);
    }
  };

  if (mapUnavailable) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Interactive satellite pin placement activates when <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> is configured. You can still enter precise GPS latitude/longitude coordinates manually below.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
              mode === 'pin' ? 'bg-[#0A192F] text-white' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Set Hostel Pin
          </button>
          <button
            type="button"
            onClick={() => setMode('entrance')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
              mode === 'entrance' ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            Set Entrance
          </button>
          <button
            type="button"
            onClick={() => setMode('boundary')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
              mode === 'boundary' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Draw Boundary ({boundary.length} pts)
          </button>
        </div>

        {boundary.length > 0 && (
          <button
            type="button"
            onClick={() => onChangeBoundary([])}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            <Eraser className="w-3.5 h-3.5" />
            Clear Boundary
          </button>
        )}
      </div>

      <div className="h-[300px] rounded-xl overflow-hidden border border-slate-300">
        <GoogleMap
          defaultCenter={pin ?? centerFallback}
          defaultZoom={17}
          mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
          mapTypeId="hybrid"
          gestureHandling="greedy"
          streetViewControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
        >
          <PickerPolygonAndClicks mode={mode} boundary={boundary} onMapClick={handleClick} />
          {pin && (
            <AdvancedMarker position={pin} title="Hostel Pin">
              <Pin background="#2563EB" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
            </AdvancedMarker>
          )}
          {entrance && (
            <AdvancedMarker position={entrance} title="Main Gate / Entrance">
              <div className="rounded bg-emerald-700 text-white border border-white px-2 py-0.5 text-[10px] font-bold shadow">
                Gate
              </div>
            </AdvancedMarker>
          )}
          {boundary.map((pt, idx) => (
            <AdvancedMarker key={`${pt.lat}-${pt.lng}-${idx}`} position={pt}>
              <div className="w-3 h-3 rounded-full bg-sky-400 border-2 border-white shadow" />
            </AdvancedMarker>
          ))}
        </GoogleMap>
      </div>
    </div>
  );
};
