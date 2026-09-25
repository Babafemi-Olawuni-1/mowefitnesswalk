import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  User, Mail, Phone, UploadCloud,
  CheckCircle2, AlertCircle, Calendar, ArrowLeft
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FloatingOrbs } from '@/components/FloatingOrbs';
import { api, ApiError, downloadBlob, type RegisterResult } from '@/lib/api';

export default function Register() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; photo?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegisterResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setPhoto(file);
        setErrors(prev => ({ ...prev, photo: undefined }));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
      setErrors(prev => ({ ...prev, photo: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Valid email is required';
    if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 7) newErrors.phone = 'Valid phone number required';
    if (!photo) newErrors.photo = 'Passport photograph is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const fd = new FormData();
      fd.append('full_name', formData.name.trim());
      fd.append('email', formData.email.trim().toLowerCase());
      fd.append('phone', formData.phone.trim());
      if (photo) fd.append('photo', photo);

      const data = await api.register(fd);
      setRegistrationResult(data);
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        // The server returns field keys that match this form's state.
        if (error.errors) setErrors(error.errors as typeof errors);
        else setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Network error. Please check your connection and try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full bg-[#0B0B0B]/60 border ${hasError ? 'border-red-500' : 'border-white/10 focus:border-[#22C55E]'} rounded-xl py-3.5 pl-11 pr-10 text-white outline-none transition-colors placeholder:text-gray-600 text-sm sm:text-base`;

  const downloadPass = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Unable to download pass.');
      const blob = await response.blob();
      downloadBlob(blob, url.split('/').pop() ?? 'attendee-pass.jpg');
    } catch (error) {
      setErrors({ general: 'Could not download pass. Please try again later.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col relative overflow-x-hidden">
      <Navbar />
      <FloatingOrbs />

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 relative z-10 w-full">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-xl sm:max-w-2xl"
            >
              <div className="text-center mb-8 sm:mb-10">
                <h1
                  className="font-heading font-black mb-3 text-white"
                  style={{ fontSize: 'clamp(1.75rem, 6vw, 3rem)' }}
                >
                  Register for the Walk
                </h1>
                <p className="text-gray-400 text-sm sm:text-base">Join the movement and secure your spot today.</p>
              </div>

              <form
                data-form-id="fitness-walk-registration"
                onSubmit={handleSubmit}
                className="glass-card p-5 sm:p-8 md:p-10"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="space-y-5 sm:space-y-6">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                        <User size={17} />
                      </div>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={inputClass(!!errors.name)}
                        placeholder="John Doe"
                      />
                      {!errors.name && formData.name.length > 2 && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#22C55E]">
                          <CheckCircle2 size={17} />
                        </div>
                      )}
                    </div>
                    {errors.name && (
                      <p className="mt-1.5 text-red-400 text-xs sm:text-sm flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                        <Mail size={17} />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={inputClass(!!errors.email)}
                        placeholder="john@example.com"
                      />
                      {!errors.email && /^\S+@\S+\.\S+$/.test(formData.email) && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#22C55E]">
                          <CheckCircle2 size={17} />
                        </div>
                      )}
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-red-400 text-xs sm:text-sm flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
                        <Phone size={17} />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={inputClass(!!errors.phone)}
                        placeholder="+234 000 000 0000"
                      />
                      {!errors.phone && formData.phone.replace(/\D/g, '').length >= 10 && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#22C55E]">
                          <CheckCircle2 size={17} />
                        </div>
                      )}
                    </div>
                    {errors.phone && (
                      <p className="mt-1.5 text-red-400 text-xs sm:text-sm flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.phone}
                      </p>
                    )}
                  </div>

                  {/* Passport Photograph */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Passport Photograph</label>

                    {photo ? (
                      <div className="flex flex-col items-center justify-center p-5 sm:p-6 border border-white/10 rounded-xl bg-[#0B0B0B]/30">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-[#22C55E] mb-3 sm:mb-4 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                          <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs sm:text-sm text-gray-300 mb-2 sm:mb-3 font-medium text-center truncate max-w-full px-4">{photo.name}</span>
                        <button
                          type="button"
                          onClick={() => setPhoto(null)}
                          className="text-red-400 text-xs sm:text-sm hover:text-red-300 bg-red-400/10 px-4 py-1.5 rounded-full transition-colors"
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`cursor-pointer flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed rounded-xl transition-all text-center ${
                          errors.photo
                            ? 'border-red-500 bg-red-500/5'
                            : isDragging
                            ? 'border-[#22C55E] bg-[#22C55E]/10'
                            : 'border-[#22C55E]/50 hover:border-[#22C55E] hover:bg-[#22C55E]/5'
                        }`}
                      >
                        <UploadCloud size={36} className={`mb-3 ${errors.photo ? 'text-red-400' : 'text-[#22C55E]'}`} />
                        <p className="text-gray-300 mb-1 font-medium text-sm sm:text-base">
                          {isDragging ? 'Drop your photo here' : 'Drag & drop your photo here'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">or tap to browse from your device</p>
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    {errors.photo && (
                      <p className="mt-1.5 text-red-400 text-xs sm:text-sm flex items-center gap-1">
                        <AlertCircle size={13} /> {errors.photo}
                      </p>
                    )}
                  </div>

                  {/* General error */}
                  {errors.general && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                      <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-red-400 text-sm">{errors.general}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#22C55E] text-[#0B0B0B] py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg neon-glow hover:bg-[#16A34A] hover:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[52px]"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-2 border-[#0B0B0B] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Complete Registration'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm sm:max-w-xl glass-card p-8 sm:p-12 text-center mx-4 sm:mx-0"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 sm:w-24 sm:h-24 bg-[#22C55E]/20 text-[#22C55E] rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
              >
                <CheckCircle2 size={40} />
              </motion.div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold mb-3 sm:mb-4">
                Registration Successful! 🎉
              </h2>

              {registrationResult?.participant_id && (
                <div className="mb-5 inline-block bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl px-5 py-3">
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Your Participant ID</p>
                  <p className="text-[#22C55E] font-heading font-black text-xl">{registrationResult.participant_id}</p>
                </div>
              )}

              <p className="text-gray-300 text-sm sm:text-base mb-7 sm:mb-8 leading-relaxed">
                Welcome, <strong className="text-white">{formData.name}</strong>! Your attendee pass has been generated and sent to{' '}
                <strong className="text-[#22C55E]">{formData.email}</strong>.
              </p>

              <div className="flex flex-col gap-3 w-full">
                {registrationResult?.pass_url && (
                  <button
                    type="button"
                    onClick={() => downloadPass(registrationResult.pass_url!)}
                    className="w-full px-7 py-3.5 rounded-full bg-[#22C55E] text-[#0B0B0B] font-bold hover:bg-[#16A34A] hover:text-white transition-colors flex items-center justify-center gap-2 text-base neon-glow"
                  >
                    ⬇ Download Attendee Pass
                  </button>
                )}
                {registrationResult?.verify_url && (
                  <a
                    href={registrationResult.verify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-7 py-3 rounded-full border border-[#22C55E]/50 text-[#22C55E] hover:border-[#22C55E] transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    🔍 View Verification Page
                  </a>
                )}
                <Link
                  href="/"
                  className="w-full px-7 py-3 rounded-full border border-white/20 hover:border-white/50 text-white font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <ArrowLeft size={16} /> Back to Home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
