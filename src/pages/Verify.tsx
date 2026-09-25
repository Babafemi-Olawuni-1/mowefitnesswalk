import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { CheckCircle2, XCircle, Loader2, Search, ArrowLeft, User } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FloatingOrbs } from '@/components/FloatingOrbs';
import { api, extractParticipantId, type VerifyResult } from '@/lib/api';

/**
 * Public verification page.
 *
 * Reads ?id=MIWC2026-000001, which is exactly what the QR code encodes,
 * then calls GET /api/verify/:id. Accepts a bare id, the current verify
 * URL, or the legacy verify.php URL.
 */
export default function Verify() {
  const [location] = useLocation();
  const [participantId, setParticipantId] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const lookup = useCallback(async (raw: string) => {
    const id = extractParticipantId(raw);
    if (!id) {
      setResult(null);
      setError(
        'That does not look like a participant ID. Expected something like MIWC2026-000001.'
      );
      setSearched(true);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setParticipantId(id);

    try {
      const data = await api.verify(id);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  // Read the id from the URL on mount and whenever the query changes.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('id') ?? params.get('participant') ?? '';
    if (fromQuery) void lookup(fromQuery);
  }, [location, lookup]);

  const statusTone =
    result?.status === 'cancelled'
      ? 'border-red-500/50 bg-red-500/10 text-red-200'
      : 'border-[#22C55E]/50 bg-[#22C55E]/10 text-[#86EFAC]';


  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col relative overflow-x-hidden">
      <Navbar />
      <FloatingOrbs />

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 relative z-10 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-xl"
        >
          <div className="text-center mb-8">
            <h1
              className="font-heading font-black mb-3 text-white"
              style={{ fontSize: 'clamp(1.75rem, 6vw, 3rem)' }}
            >
              Verify a Pass
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Scan the QR code on an attendee pass, or enter the participant ID below.
            </p>
          </div>

          {/* Manual entry fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(participantId);
            }}
            className="glass-card p-5 sm:p-8 mb-6"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Participant ID or QR payload
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                <Search size={17} />
              </div>
              <input
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                className="w-full bg-[#0B0B0B]/60 border border-white/10 focus:border-[#22C55E] rounded-xl py-3.5 pl-11 pr-4 text-white outline-none transition-colors placeholder:text-gray-600 text-sm sm:text-base"
                placeholder="MIWC2026-000001"
                aria-label="Participant ID"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 px-7 py-3.5 rounded-full bg-[#22C55E] text-[#0B0B0B] font-bold hover:bg-[#16A34A] hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>
          </form>

          {loading && (
            <div className="glass-card p-8 text-center text-gray-400 text-sm">
              Looking up participant...
            </div>
          )}

          {!loading && error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-red-500/50 bg-red-500/10 p-8 text-center"
            >
              <XCircle size={44} className="mx-auto text-red-400 mb-4" />
              <h2 className="text-xl font-bold mb-2 text-red-200">Verification Failed</h2>
              <p className="text-sm text-red-200/80">{error}</p>
            </motion.div>
          )}


          {!loading && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-[#22C55E]/40 bg-[#22C55E]/10 overflow-hidden"
            >
              <div className="bg-[#22C55E] text-[#0B0B0B] px-6 py-4 flex items-center gap-3 font-heading font-black">
                <CheckCircle2 size={22} />
                {result.valid ? 'Verified Participant' : 'Cancelled Participant'}
              </div>

              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full border-2 border-[#22C55E] bg-black/40 flex items-center justify-center shrink-0">
                    <User size={26} className="text-[#22C55E]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading font-black text-lg sm:text-xl text-white truncate">
                      {result.full_name}
                    </div>
                    <div className="text-[#22C55E] font-mono text-sm">{result.participant_id}</div>
                  </div>
                </div>

                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <dt className="text-[#22C55E] font-semibold shrink-0">Email</dt>
                    <dd className="text-white text-right break-all">{result.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <dt className="text-[#22C55E] font-semibold shrink-0">Phone</dt>
                    <dd className="text-white text-right">{result.phone}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                    <dt className="text-[#22C55E] font-semibold shrink-0">Registered</dt>
                    <dd className="text-white text-right">{result.registered_on}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#22C55E] font-semibold shrink-0">Status</dt>
                    <dd>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone}`}
                      >
                        {result.status}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          )}

          {!loading && !error && !result && !searched && (
            <div className="glass-card p-8 text-center">
              <p className="text-gray-400 text-sm">
                Enter a participant ID above to check an attendee pass.
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} /> Back to Home
            </Link>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
