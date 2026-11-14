import heroCampusLivingImg from '../assets/images/hero_campus_living_1794661327307.jpg';
import type { Campus, SystemSettings } from '../types/domain';

export const HERO_IMAGE_URL = heroCampusLivingImg;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  featuredEnabled: true,
  sponsoredLabelText: 'Sponsored Placement',
  bookingServiceFeePercent: 0,
  maintenanceMode: false,
  updatedAtMs: 1794661000000,
};

export const DEFAULT_CAMPUS_REFERENCES: Campus[] = [
  {
    id: 'rumphi-main',
    name: 'Rumphi Campus',
    universityName: 'University of Livingstonia',
    district: 'Rumphi',
    country: 'Malawi',
    lat: -11.0186,
    lng: 33.8574,
    isActive: true,
    createdAtMs: 1794661000000,
  },
];
