import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

interface LegalPageProps {
  section: 'privacy' | 'terms' | 'support';
}

export const LegalPage: React.FC<LegalPageProps> = ({ section }) => {
  return (
    <div className="bg-slate-50 min-h-screen py-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <ShieldCheck className="w-4 h-4" />
            <span>ToStay Governance & Trust</span>
          </div>

          {section === 'privacy' && (
            <>
              <h1 className="font-display text-3xl font-bold text-slate-900">Privacy Policy</h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                ToStay isolates personal contact details (email, phone number, WhatsApp, and student ID
                records) inside private user subcollections accessible only to the account owner and
                authorized ToStay administrators. Public hostel listings never expose student PII.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Mapping and routing services are powered by Google Maps Platform and are governed by
                the{' '}
                <a
                  href="https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  Google Privacy Policy
                </a>
                .
              </p>
            </>
          )}

          {section === 'terms' && (
            <>
              <h1 className="font-display text-3xl font-bold text-slate-900">Terms of Service</h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                Property owners are responsible for keeping MWK rent rates, security deposit terms,
                and room availability counts accurate. Listings not re-confirmed within 14 days display
                a stale-availability warning to students.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                By using ToStay&apos;s interactive satellite map and route features, users agree to be
                bound by the{' '}
                <a
                  href="https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  Google Maps / Google Earth Additional Terms of Service
                </a>
                .
              </p>
            </>
          )}

          {section === 'support' && (
            <>
              <h1 className="font-display text-3xl font-bold text-slate-900">
                Support & Safe Booking Guidance
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                <strong>For University of Livingstonia, Rumphi Campus Students:</strong> Always inspect a
                property&apos;s Location Verification status and schedule a physical viewing through
                ToStay before paying a security deposit. Report any suspicious price changes or
                misleading photos using the Report button on any property profile.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                <strong>For Hostel Owners & University Partners:</strong> Submit properties via the{' '}
                <Link to="/dashboard/owner" className="text-blue-700 underline">
                  Owner Property Studio
                </Link>{' '}
                or inspect institutional housing capacity on the{' '}
                <Link to="/university" className="text-blue-700 underline">
                  University Portal
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
