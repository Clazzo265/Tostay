import React from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0A192F] text-slate-300 border-t border-slate-800 pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-sky-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-lg text-white">ToStay</span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Find your place. Feel at home. Verified student accommodation discovery, satellite mapping,
              and digital property management built for university corridors starting in Rumphi, Malawi.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Pricing displayed in Malawian Kwacha (MWK). Map imagery and routing powered by Google Maps Platform.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">
              Platform
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/explore" className="hover:text-white transition-colors">
                  Explore Hostels
                </Link>
              </li>
              <li>
                <Link to="/map" className="hover:text-white transition-colors">
                  Satellite Map
                </Link>
              </li>
              <li>
                <Link to="/compare" className="hover:text-white transition-colors">
                  Compare Properties
                </Link>
              </li>
              <li>
                <Link to="/university" className="hover:text-white transition-colors">
                  University Partner Portal
                </Link>
              </li>
              <li>
                <Link to="/dashboard/owner" className="hover:text-white transition-colors">
                  List a Hostel
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">
              Trust & Policies
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/support" className="hover:text-white transition-colors">
                  Support & Verification
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} ToStay Accommodation Ecosystem · Rumphi, Malawi</p>
          <p>
            Use of mapping features is subject to the{' '}
            <a
              href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-300"
            >
              Google Maps End User Terms
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
};
