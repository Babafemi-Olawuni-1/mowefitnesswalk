import { useEffect, useRef, useState, useCallback } from 'react';
import {
  api,
  apiFetch,
  ApiError,
  extractParticipantId,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  setUnauthorizedHandler,
  downloadBlob,
  type Sponsor,
  type VerifyResult,
  type GalleryItem,
  type AdminUser,
} from '@/lib/api';

type DashboardStats = {
  total?: number;
  today?: number;
  verified?: number;
  week_chart?: Array<{ d: string; cnt: number }>;
};

type Participant = {
  id: number;
  participant_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  registered_at?: string;
};

export default function AdminPage() {
  // No prefilled credentials. The administrator types their own.
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('general');
  const [galleryStatus, setGalleryStatus] = useState('active');
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [editingGalleryId, setEditingGalleryId] = useState<number | null>(null);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super' | 'admin'>('admin');
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailTarget, setEmailTarget] = useState<'all' | 'registered' | 'verified'>('all');
  const [emailSending, setEmailSending] = useState(false);

  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerRunningRef = useRef(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualParticipantId, setManualParticipantId] = useState('');
  const [scanStatus, setScanStatus] = useState('');

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setStats(null);
    setParticipants([]);
    setSponsors([]);
    setVerificationResult(null);
  }, []);

  // A 401 anywhere in the app drops straight back to the login screen
  // instead of leaving the dashboard spinning.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setError('Your session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.dashboard();
      setStats(data.stats ?? null);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(e instanceof Error ? e.message : 'Unable to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchParticipants = useCallback(async () => {
    try {
      const data = await api.participants();
      setParticipants((data?.data ?? []) as Participant[]);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(e instanceof Error ? e.message : 'Unable to load participants');
      }
    }
  }, []);

  const fetchSponsors = useCallback(async () => {
    try {
      setSponsors(await api.adminSponsors());
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(e instanceof Error ? e.message : 'Unable to load sponsors');
      }
    }
  }, []);

  const fetchGallery = useCallback(async () => {
    try {
      setGalleryItems(await api.adminGallery());
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        setError(e instanceof Error ? e.message : 'Unable to load gallery');
      }
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    try {
      setAdmins(await api.adminAdmins());
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        // Not super admin - this is fine, just don't show the section
        console.log('Not super admin or no access');
      }
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    await Promise.all([fetchDashboard(), fetchParticipants(), fetchSponsors(), fetchGallery(), fetchAdmins()]);
  }, [fetchDashboard, fetchParticipants, fetchSponsors, fetchGallery, fetchAdmins]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);

    try {
      const data = await api.login(loginEmail.trim(), loginPassword);
      setStoredToken(data.token);
      setToken(data.token);
      setLoginPassword('');
      await loadAdminData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSponsorCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!businessName.trim()) {
      setError('Business name is required.');
      return;
    }

    const form = new FormData();
    form.append('business_name', businessName.trim());
    form.append('website_url', websiteUrl.trim());
    form.append('whatsapp', whatsapp.trim());
    form.append('priority', String(Number(priority) || 0));
    form.append('status', status);
    if (logoFile) form.append('logo', logoFile);

    try {
      await api.createSponsor(form);

      setBusinessName('');
      setWebsiteUrl('');
      setWhatsapp('');
      setPriority('0');
      setStatus('active');
      setLogoFile(null);
      setError('');
      await fetchSponsors();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create sponsor');
    }
  };

  const handleSponsorDelete = async (id: number) => {
    if (!confirm('Delete this sponsor?')) return;
    try {
      await api.deleteSponsor(id);
      await fetchSponsors();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete sponsor');
    }
  };

  const handleGalleryCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryFile) {
      setError('Please select an image.');
      return;
    }

    const form = new FormData();
    form.append('image', galleryFile);
    if (galleryCaption.trim()) form.append('caption', galleryCaption.trim());
    form.append('category', galleryCategory);
    form.append('status', galleryStatus);

    try {
      await api.createGalleryItem(form);
      setGalleryCaption('');
      setGalleryCategory('general');
      setGalleryStatus('active');
      setGalleryFile(null);
      setEditingGalleryId(null);
      await fetchGallery();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload image');
    }
  };

  const handleGalleryUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGalleryId === null) return;

    const form = new FormData();
    if (galleryFile) form.append('image', galleryFile);
    if (galleryCaption.trim()) form.append('caption', galleryCaption.trim());
    form.append('category', galleryCategory);
    form.append('status', galleryStatus);

    try {
      await api.updateGalleryItem(editingGalleryId, form);
      setGalleryCaption('');
      setGalleryCategory('general');
      setGalleryStatus('active');
      setGalleryFile(null);
      setEditingGalleryId(null);
      await fetchGallery();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update image');
    }
  };

  const handleGalleryDelete = async (id: number) => {
    if (!confirm('Delete this gallery image?')) return;
    try {
      await api.deleteGalleryItem(id);
      await fetchGallery();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete image');
    }
  };

  const startEditGallery = (item: GalleryItem) => {
    setEditingGalleryId(item.id);
    setGalleryCaption(item.caption ?? '');
    setGalleryCategory(item.category ?? 'general');
    setGalleryStatus(item.status ?? 'active');
    setGalleryFile(null);
  };

  const handleAdminCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword || !newAdminName) {
      setError('All fields are required.');
      return;
    }
    if (newAdminPassword.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    try {
      await api.createAdmin({ email: newAdminEmail, password: newAdminPassword, name: newAdminName, role: newAdminRole });
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminName('');
      setNewAdminRole('admin');
      setShowAdminModal(false);
      await fetchAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create admin');
    }
  };

  const handleAdminDelete = async (id: string) => {
    if (!confirm('Delete this admin? This cannot be undone.')) return;
    try {
      await api.deleteAdmin(id);
      await fetchAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to delete admin');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailMessage.trim()) {
      setError('Subject and message are required.');
      return;
    }
    setEmailSending(true);
    try {
      const result = await api.sendEmail({ subject: emailSubject, message: emailMessage, target: emailTarget });
      setEmailSubject('');
      setEmailMessage('');
      setError(`Email sent to ${result.sent} participant(s). Failed: ${result.failed}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const exportCsv = async (type: 'participants' | 'sponsors' | 'contacts') => {
    try {
      const blob = await apiFetch<Blob>(`/admin/export/${type}`);
      downloadBlob(blob, `${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to export CSV');
    }
  };

  /**
   * Accepts a bare participant id, the current verify URL, or the legacy
   * verify.php URL. The scanner used to hand us the whole URL, which is why
   * scanning never worked; extractParticipantId fixes that.
   */
  const verifyParticipant = async (rawPayload: string) => {
    const participantId = extractParticipantId(rawPayload);

    if (!participantId) {
      setVerificationResult(null);
      setScanStatus('Unrecognised QR code. Expected a participant ID.');
      return;
    }

    setScanStatus('Checking participant...');
    try {
      const data = await api.verify(participantId);
      setVerificationResult(data);
      setManualParticipantId(participantId);
      setScanStatus('Participant verified');
    } catch (e) {
      setVerificationResult(null);
      setScanStatus(e instanceof Error ? e.message : 'Verification failed');
    }
  };

  const stopScanner = useCallback(() => {
    scannerRunningRef.current = false;
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }
    setScannerActive(false);
  }, []);

  // Release the camera when the admin logs out or navigates away.
  useEffect(() => stopScanner, [stopScanner]);

  const startScanner = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanStatus('Camera is not available in this browser. Use the ID box below.');
      return;
    }

    // Secure context check: getUserMedia is blocked on plain http://
    if (!window.isSecureContext) {
      setScanStatus('Camera requires HTTPS. Use the ID box below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      scannerStreamRef.current = stream;
      scannerRunningRef.current = true;
      setScannerActive(true);

      const video = scannerVideoRef.current;
      if (video) {
        video.srcObject = stream;
        // Must be muted+playsInline or iOS Safari refuses to play.
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        try {
          await video.play();
        } catch {
          // Some browsers resolve play() late; the stream still works.
        }
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        // Safari and Firefox do not ship BarcodeDetector. Rather than a
        // dead camera, stop the stream and point at the manual fallback.
        stopScanner();
        setScanStatus(
          'Live QR detection is not supported in this browser. Type the participant ID below.'
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      let consecutiveErrors = 0;

      const tick = async () => {
        if (!scannerRunningRef.current || !scannerVideoRef.current) return;

        try {
          const results = await detector.detect(scannerVideoRef.current);
          consecutiveErrors = 0;

          if (results && results.length > 0) {
            // rawValue is the full verification URL, not the bare id.
            // verifyParticipant() extracts the id.
            const payload = results[0].rawValue;
            stopScanner();
            await verifyParticipant(payload);
            return;
          }
        } catch {
          // A single undecodable frame is normal. Keep going, but bail out
          // if the camera has genuinely gone away.
          consecutiveErrors += 1;
          if (consecutiveErrors > 20) {
            stopScanner();
            setScanStatus('Camera stopped responding. Use the ID box below.');
            return;
          }
        }

        if (scannerRunningRef.current) {
          window.setTimeout(tick, 400);
        }
      };

      void tick();
    } catch (e) {
      stopScanner();
      setScanStatus(
        e instanceof Error ? e.message : 'Unable to open camera. Use the ID box below.'
      );
    }
  };

  useEffect(() => {
    if (token) {
      void loadAdminData();
    }
  }, [token, loadAdminData]);

  const statTotal = Number(stats?.total ?? participants.length ?? 0);
  const statVerified = Number(stats?.verified ?? 0);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white">
      <header className="border-b border-white/10 bg-black/30">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#22C55E]">Mowe Fitness Walk</div>
            <h1 className="text-2xl font-black font-heading">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {token ? (
              <button className="px-5 py-2 rounded-full border border-white/10 hover:bg-white/10" onClick={logout}>Logout</button>
            ) : (
              <span className="text-xs text-gray-400">Authentication required</span>
            )}
          </div>
        </div>
      </header>

      {!token ? (
        <section className="max-w-xl mx-auto px-4 py-20">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6">Admin Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm mb-2 text-gray-300">Email</label>
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm mb-2 text-gray-300">Password</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
              </div>
              {error && <div className="rounded-xl border border-red-500/60 bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</div>}
              <button disabled={loginLoading} className="w-full rounded-full bg-[#22C55E] text-[#0B0B0B] font-black py-3 hover:bg-[#16A34A] hover:text-white transition-colors">
                {loginLoading ? 'Signing In...' : 'Login'}
              </button>
            </form>
          </div>
        </section>
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-10">
          {error && (
            <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-5 py-3 text-sm text-red-200 mb-6">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs uppercase text-gray-400">Total Registrations</div>
              <div className="text-4xl font-black mt-3 text-white">{statTotal}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs uppercase text-gray-400">Verified</div>
              <div className="text-4xl font-black mt-3 text-[#22C55E]">{statVerified}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs uppercase text-gray-400">Sponsors</div>
              <div className="text-4xl font-black mt-3 text-white">{sponsors.length}</div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black">Participants</h2>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/10" onClick={() => exportCsv('participants')}>Export CSV</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Email</th>
                      <th className="py-3 pr-4">Phone</th>
                      <th className="py-3 pr-4">ID</th>
                      <th className="py-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-4 font-bold text-white">{p.full_name}</td>
                        <td className="py-3 pr-4 text-gray-300">{p.email}</td>
                        <td className="py-3 pr-4 text-gray-300">{p.phone}</td>
                        <td className="py-3 pr-4 text-gray-300">{p.participant_id}</td>
                        <td className="py-3 pr-4">
                          <span className="rounded-full bg-[#22C55E]/20 border border-[#22C55E]/30 px-3 py-1 text-xs text-[#A7F3D0]">{p.status ?? 'registered'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black">Add Sponsor</h2>
                <button className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/10" onClick={() => exportCsv('sponsors')}>Export Sponsors CSV</button>
              </div>

              <form onSubmit={handleSponsorCreate} className="space-y-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Business Name</span>
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Website URL</span>
                  <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">WhatsApp</span>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs uppercase tracking-widest text-gray-400">Priority</span>
                    <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-widest text-gray-400">Status</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3">
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Sponsor Logo</span>
                  <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                </label>

                <button className="w-full rounded-full bg-[#22C55E] text-[#0B0B0B] font-black py-3 hover:bg-[#16A34A] hover:text-white transition-colors">Save Sponsor</button>
              </form>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6 mt-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black">Participant Verification</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-5">
                <div className="bg-black rounded-2xl border border-white/10 overflow-hidden">
                  <div className="min-h-[260px] flex items-center justify-center bg-black">
                    {scannerActive ? (
                      <video ref={scannerVideoRef} className="w-full h-[260px] object-cover" playsInline muted />
                    ) : (
                      <div className="text-gray-500 text-sm">Camera is off</div>
                    )}
                  </div>
                  <div className="p-3 flex gap-2">
                    <button type="button" onClick={startScanner} className="flex-1 rounded-full bg-[#22C55E] text-[#0B0B0B] font-black py-2 hover:bg-[#16A34A] hover:text-white transition-colors">
                      {scannerActive ? 'Scanning...' : 'Open Camera'}
                    </button>
                    {scannerActive && (
                      <button type="button" onClick={stopScanner} className="flex-1 rounded-full border border-white/10 hover:bg-white/10 py-2">
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs uppercase tracking-widest text-gray-400">Participant ID / QR payload</span>
                    <input value={manualParticipantId} onChange={(e) => setManualParticipantId(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" placeholder="MIWC2026-000001" />
                  </label>

                  <button type="button" onClick={() => verifyParticipant(manualParticipantId)} className="w-full rounded-full bg-white text-[#0B0B0B] font-black py-3 hover:bg-[#22C55E] hover:text-[#0B0B0B] transition-colors">
                    Verify Participant
                  </button>

                  {scanStatus && (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300">
                      {scanStatus}
                    </div>
                  )}

                  {verificationResult && (
                    <div className="rounded-2xl border border-[#22C55E]/40 bg-[#22C55E]/10 p-4">
                      <div className="text-sm text-gray-400">Verified participant</div>
                      <div className="mt-2 font-black text-white text-xl">{verificationResult.full_name}</div>
                      <div className="mt-1 text-sm text-gray-300">{verificationResult.email}</div>
                      <div className="mt-1 text-sm text-gray-300">{verificationResult.phone}</div>
                      <div className="mt-1 text-xs uppercase text-[#86EFAC]">{verificationResult.status}</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black">Sponsors</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {sponsors.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-widest text-gray-500">#{s.id}</span>
                      <span className="rounded-full px-2 py-1 bg-green-500/15 text-green-300 text-[10px]">{s.status ?? 'active'}</span>
                    </div>
                    {s.logo_url && <img src={s.logo_url} alt={s.business_name} className="h-16 object-contain rounded-lg border border-white/10 bg-white" />}
                    <div className="mt-3 font-bold text-white">{s.business_name}</div>
                    {s.website_url && <a href={s.website_url} target="_blank" className="text-sm text-[#22C55E] hover:text-[#86EFAC]">Visit website</a>}
                    <button onClick={() => handleSponsorDelete(s.id)} className="mt-3 w-full rounded-full border border-red-500/50 text-red-300 py-2 hover:bg-red-500/10 transition-colors text-sm">Delete Sponsor</button>
                  </div>
                ))}
              </div>
            </section>
          </section>

          {/* Gallery */}
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6 mt-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black">Gallery</h2>
              </div>
              <form onSubmit={editingGalleryId ? handleGalleryUpdate : handleGalleryCreate} className="space-y-4 mb-6">
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Image</span>
                  <input type="file" accept="image/*" onChange={(e) => setGalleryFile(e.target.files?.[0] ?? null)} required={!editingGalleryId} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                  {editingGalleryId && <p className="text-xs text-gray-500 mt-1">Leave empty to keep current image</p>}
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Caption</span>
                  <input value={galleryCaption} onChange={(e) => setGalleryCaption(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" placeholder="Optional caption" />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs uppercase tracking-widest text-gray-400">Category</span>
                    <input value={galleryCategory} onChange={(e) => setGalleryCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" placeholder="general" />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-widest text-gray-400">Status</span>
                    <select value={galleryStatus} onChange={(e) => setGalleryStatus(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3">
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                </div>
                <button type="submit" className="w-full rounded-full bg-[#22C55E] text-[#0B0B0B] font-black py-3 hover:bg-[#16A34A] hover:text-white transition-colors">
                  {editingGalleryId ? 'Update Image' : 'Add Image'}
                </button>
                {editingGalleryId && (
                  <button type="button" onClick={() => { setEditingGalleryId(null); setGalleryCaption(''); setGalleryCategory('general'); setGalleryStatus('active'); setGalleryFile(null); }} className="w-full rounded-full border border-white/10 hover:bg-white/10 py-3">Cancel Edit</button>
                )}
              </form>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 flex flex-col">
                    <img src={item.image_url} alt={item.caption ?? ''} className="h-32 object-cover rounded-lg border border-white/10" />
                    <div className="mt-3 flex-1">
                      {item.caption && <div className="font-bold text-white text-sm">{item.caption}</div>}
                      <div className="text-xs text-gray-400 mt-1">{item.category ?? 'general'} · {item.status ?? 'active'}</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => startEditGallery(item)} className="flex-1 rounded-full border border-white/10 hover:bg-white/10 py-2 text-sm">Edit</button>
                      <button onClick={() => handleGalleryDelete(item.id)} className="flex-1 rounded-full border border-red-500/50 text-red-300 py-2 hover:bg-red-500/10 transition-colors text-sm">Delete</button>
                    </div>
                  </div>
                ))}
                {galleryItems.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">No gallery images yet</div>
                )}
              </div>
            </section>

            {/* Admin Users (super only) */}
            {admins.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-black">Admin Users</h2>
                  <button onClick={() => setShowAdminModal(true)} className="px-4 py-2 rounded-full bg-[#22C55E] text-[#0B0B0B] font-black hover:bg-[#16A34A] hover:text-white transition-colors">Add Admin</button>
                </div>
                <div className="space-y-3">
                  {admins.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{a.name}</div>
                        <div className="text-sm text-gray-400">{a.email}</div>
                        <span className="rounded-full px-2 py-1 bg-[#22C55E]/20 border border-[#22C55E]/30 text-xs text-[#A7F3D0] ml-2">{a.role}</span>
                      </div>
                      {a.id !== token && (
                        <button onClick={() => handleAdminDelete(a.id)} className="rounded-full border border-red-500/50 text-red-300 px-4 py-2 hover:bg-red-500/10 transition-colors text-sm">Delete</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Email Broadcast */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 mt-6">
              <h2 className="text-2xl font-black mb-5">Send Email to Participants</h2>
              <form onSubmit={handleSendEmail} className="space-y-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Subject</span>
                  <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} required className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Message</span>
                  <textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} required rows={6} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-widest text-gray-400">Target</span>
                  <select value={emailTarget} onChange={(e) => setEmailTarget(e.target.value as 'all' | 'registered' | 'verified')} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3">
                    <option value="all">All Participants</option>
                    <option value="registered">Registered Only</option>
                    <option value="verified">Verified Only</option>
                  </select>
                </label>
                <button type="submit" disabled={emailSending} className="w-full rounded-full bg-[#22C55E] text-[#0B0B0B] font-black py-3 hover:bg-[#16A34A] hover:text-white transition-colors disabled:opacity-50">
                  {emailSending ? 'Sending...' : 'Send Email'}
                </button>
              </form>
            </section>

            {/* Add Admin Modal */}
            {showAdminModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 w-full max-w-md">
                  <h3 className="text-2xl font-black mb-5">Create Admin</h3>
                  <form onSubmit={handleAdminCreate} className="space-y-4">
                    <label className="block">
                      <span className="text-xs uppercase tracking-widest text-gray-400">Name</span>
                      <input value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} required className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-widest text-gray-400">Email</span>
                      <input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} required className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-widest text-gray-400">Password (min 12 chars)</span>
                      <input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} required minLength={12} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3" />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-widest text-gray-400">Role</span>
                      <select value={newAdminRole} onChange={(e) => setNewAdminRole(e.target.value as 'super' | 'admin')} className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3">
                        <option value="admin">Admin</option>
                        <option value="super">Super Admin</option>
                      </select>
                    </label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setShowAdminModal(false)} className="flex-1 rounded-full border border-white/10 hover:bg-white/10 py-3">Cancel</button>
                      <button type="submit" className="flex-1 rounded-full bg-[#22C55E] text-[#0B0B0B] font-black py-3 hover:bg-[#16A34A] hover:text-white transition-colors">Create Admin</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
        </main>
      )}
    </div>
  );
}
