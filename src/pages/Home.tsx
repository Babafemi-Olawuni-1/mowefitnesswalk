import { useEffect, useState, useRef } from 'react';
import { Link } from 'wouter';
import { motion, useInView } from 'framer-motion';
import {
  Heart, Users, Activity, Handshake,
  ChevronDown, Calendar, ArrowRight,
  ClipboardList, Zap, MapPin, Droplets, Dumbbell, Network,
  Home as HomeIcon, Sun, Star, Gift
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { FloatingOrbs } from '@/components/FloatingOrbs';
import { api, type Sponsor } from '@/lib/api';

// Animation variants
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } }
};
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } }
};
const slideInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};
const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

// Sponsor type

// Counter Hook
function useCounter(end: number, duration: number = 2000, inView: boolean = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let startTime: number | null = null;
    let animationFrame: number;
    const updateCounter = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      const easeOut = 1 - Math.pow(1 - percentage, 3);
      setCount(Math.floor(easeOut * end));
      if (percentage < 1) animationFrame = requestAnimationFrame(updateCounter);
    };
    animationFrame = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, inView]);

  return count;
}

function AnimatedCounter({ end, suffix = '', label }: { end: number; suffix?: string; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const count = useCounter(end, 2000, isInView);
  return (
    <div ref={ref} className="flex flex-col items-center py-6 sm:py-0">
      <div className="text-4xl sm:text-5xl md:text-7xl font-heading font-black heading-gradient mb-2">
        {count}{suffix}
      </div>
      <div className="text-gray-400 font-medium text-xs sm:text-sm uppercase tracking-wider text-center">
        {label}
      </div>
    </div>
  );
}

export default function Home() {
  const [sponsors, setSponsors] = useState<Sponsor[]>(
    Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      business_name: `Sponsor ${i + 1}`,
      logo_url: `https://via.placeholder.com/200x80/111111/22C55E?text=Sponsor+${i + 1}`,
      website_url: null,
      status: 'inactive',
    }))
  );

  useEffect(() => {
    if (window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }

    const fetchSponsors = async () => {
      try {
        const data = await api.sponsors();
        if (Array.isArray(data)) {
          setSponsors(
            data.map((s, i) => ({
              id: s.id ?? i,
              business_name: s.business_name ?? `Sponsor ${i + 1}`,
              logo_url: s.logo_url ?? null,
              website_url: s.website_url ?? null,
              status: s.status ?? 'active',
            }))
          );
        }
      } catch (error) {
        console.warn('Failed to load sponsors:', error);
      }
    };

    fetchSponsors();
  }, []);

  const timeline = [
    { icon: ClipboardList, title: 'Registration', desc: 'Complete your registration online before the event' },
    { icon: Zap, title: 'Warm-Up Session', desc: 'Group warm-up exercises led by fitness instructors' },
    { icon: MapPin, title: 'Fitness Walk', desc: 'Community walk through scenic Mowe-Ibafo routes' },
    { icon: Droplets, title: 'Hydration Break', desc: 'Refreshments and hydration station midway' },
    { icon: Dumbbell, title: 'Exercise Session', desc: 'Group exercise activities and fitness challenges' },
    { icon: Network, title: 'Networking', desc: 'Meet, connect, and share with fellow participants' },
  ];

  const communityPhoto = `${import.meta.env.BASE_URL}community-photo.png`;
  const base = import.meta.env.BASE_URL;

  const gallery = [
    communityPhoto,
    `${base}image_1785705882829.png`,
    `${base}image_1785705891923.png`,
    `${base}image_1785705906146.png`,
    `${base}image_1785705918083.png`,
    `${base}image_1785705932140.png`,
    `${base}image_1785705945199.png`,
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
    'https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee?w=600&q=80',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80',
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80',
    'https://images.unsplash.com/photo-1486218119243-13301ef32b27?w=600&q=80',
  ];

  // sponsors are loaded from the API into state above

  const aboutImageSrc = communityPhoto;

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white overflow-x-hidden">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80')` }}
        />
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(11,11,11,0.75) 0%, rgba(11,11,11,0.55) 50%, rgba(11,11,11,0.92) 100%)' }}
        />
        <FloatingOrbs />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col items-center text-center px-4 sm:px-6 w-full max-w-5xl mx-auto py-16 sm:py-20"
        >
          {/* Badge */}
          <motion.div
            variants={fadeInUp}
            className="mb-5 sm:mb-6 px-4 py-1.5 glass-card rounded-full border border-[#22C55E]/50 text-xs sm:text-sm font-medium text-[#22C55E] uppercase tracking-widest inline-flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            2026 Event
          </motion.div>

          {/* Main heading — fluid sizing prevents overflow on all screens */}
          <motion.h1
            variants={fadeInUp}
            className="font-heading font-black leading-none mb-5 sm:mb-6 tracking-tighter w-full"
            style={{ fontSize: 'clamp(2rem, 8vw, 7rem)' }}
          >
            <span className="block text-white">MOWE FITNESS</span>
            <span className="block text-white">WALK</span>
            <span className="block heading-gradient">2026</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-gray-300 text-base sm:text-lg md:text-xl max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          >
            Promote healthy living, community unity, wellness, and active lifestyles. Join hundreds of neighbors for the most anticipated fitness event of the year.
          </motion.p>

          {/* Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 w-full max-w-sm sm:max-w-none"
          >
            <Link
              href="/register"
              className="bg-[#22C55E] text-[#0B0B0B] hover:bg-[#16A34A] hover:text-white transition-all w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg neon-glow flex items-center justify-center gap-2"
            >
              Register Now <ArrowRight size={18} />
            </Link>
            <a
              href="#about"
              className="glass-card text-[#22C55E] border border-[#22C55E]/30 hover:border-[#22C55E] transition-all w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full font-bold text-base sm:text-lg flex items-center justify-center"
            >
              Learn More
            </a>
          </motion.div>

          {/* Date badge */}
          <motion.div
            variants={fadeInUp}
            className="glass-card px-5 py-2.5 rounded-full flex items-center gap-3"
          >
            <Calendar className="text-[#22C55E] shrink-0" size={18} />
            <span className="font-medium text-sm sm:text-base">Date: Coming Soon</span>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-400 animate-bounce"
        >
          <ChevronDown size={28} />
        </motion.div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-16 sm:py-24 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="mb-10 sm:mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-4">
              About the{' '}
              <span className="text-[#22C55E] border-b-4 border-[#22C55E]">Mowe Fitness</span>{' '}
              Walk
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-12 sm:mb-20">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={slideInLeft}
              className="space-y-4 sm:space-y-6 text-gray-300 text-base sm:text-lg leading-relaxed order-2 lg:order-1"
            >
              <p>
                The Mowe Fitness Walk community is a vibrant, growing movement dedicated to fostering deep connections and promoting health across our neighborhoods. We believe that a united community is a strong community, and fitness is the universal language that brings us together.
              </p>
              <p>
                Our annual Fitness Walk is more than just exercise — it is a celebration of life, endurance, and togetherness. By walking side by side, we break down barriers, create lasting networks, and build a culture of wellness that extends far beyond the finish line.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={slideInRight}
              className="relative order-1 lg:order-2"
            >
              <div className="absolute inset-0 bg-[#22C55E] blur-[80px] sm:blur-[100px] opacity-15 rounded-full" />
              <img
                src={aboutImageSrc}
                alt="Mowe-Ibafo X Community"
                className="relative z-10 w-full h-56 sm:h-72 md:h-[380px] lg:h-[420px] object-cover rounded-2xl border border-[#22C55E]/30 neon-glow"
                loading="lazy"
                onError={(e) => {
                  // Fallback image if Twitter URL doesn't load
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80';
                }}
              />
            </motion.div>
          </div>

          {/* Icon cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {[
              { icon: Heart, title: 'Healthy Living', desc: 'Promoting wellness through regular physical activity' },
              { icon: Users, title: 'Community Unity', desc: 'Bringing neighborhoods together as one' },
              { icon: Activity, title: 'Fitness', desc: 'Building strength, endurance, and healthy habits' },
              { icon: Handshake, title: 'Networking', desc: 'Connect with like-minded health enthusiasts' },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="glass-card p-6 sm:p-8 group hover:-translate-y-2 transition-transform duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] hover:border-[#22C55E]/50"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#22C55E]/10 flex items-center justify-center mb-5 sm:mb-6 group-hover:bg-[#22C55E]/20 transition-colors">
                  <card.icon className="text-[#22C55E]" size={24} />
                </div>
                <h3 className="text-lg sm:text-xl font-heading font-bold mb-2 sm:mb-3">{card.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm sm:text-base">{card.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── WHY PARTICIPATE ── */}
      <section
        className="py-16 sm:py-24 px-4 sm:px-6 relative z-10"
        style={{ background: 'linear-gradient(135deg, #0a1a0f 0%, #0B0B0B 50%, #0a1a0f 100%)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-3 sm:mb-4">Why Participate?</h2>
            <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
              Discover the incredible benefits of joining the largest fitness walk in the community.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border border-white/10 rounded-2xl mb-12 sm:mb-20">
            <AnimatedCounter end={500} suffix="+" label="Participants Expected" />
            <AnimatedCounter end={10} suffix="km" label="Walk Distance" />
            <AnimatedCounter end={100} suffix="%" label="Free Entry" />
          </div>

          {/* Benefit cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {[
              { icon: Heart, title: 'Improve Your Health' },
              { icon: Users, title: 'Meet New People' },
              { icon: HomeIcon, title: 'Community Bonding' },
              { icon: Sun, title: 'Outdoor Exercise' },
              { icon: Star, title: 'Fun Activities' },
              { icon: Gift, title: 'Exciting Giveaways' },
            ].map((benefit, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="glass-card p-5 sm:p-6 flex items-center gap-4 sm:gap-6 group hover:-translate-y-2 transition-transform duration-300 hover:border-[#22C55E]/40"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="text-[#22C55E] shrink-0">
                  <benefit.icon size={36} />
                </div>
                <h3 className="text-base sm:text-lg font-heading font-bold">{benefit.title}</h3>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── EVENT HIGHLIGHTS ── */}
      <section id="event" className="py-16 sm:py-24 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold">Event Highlights</h2>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="relative lg:hidden">
            <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#22C55E]/10 via-[#22C55E]/50 to-[#22C55E]/10" />
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="flex flex-col gap-8 relative z-10"
            >
              {timeline.map((item, i) => (
                <motion.div key={i} variants={fadeInUp} className="flex gap-5 items-start">
                  <div className="w-14 h-14 shrink-0 rounded-full bg-[#0B0B0B] border-2 border-[#22C55E] flex items-center justify-center neon-glow z-10">
                    <item.icon className="text-[#22C55E]" size={22} />
                  </div>
                  <div className="pt-1">
                    <h4 className="text-lg font-bold font-heading mb-1">{item.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Desktop: horizontal timeline */}
          <div className="hidden lg:block relative">
            <div className="absolute top-[28px] left-0 right-0 h-0.5 bg-gradient-to-r from-[#0B0B0B] via-[#22C55E] to-[#0B0B0B] opacity-40" />
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={staggerContainer}
              className="flex justify-between gap-4 relative z-10"
            >
              {timeline.map((item, i) => (
                <motion.div key={i} variants={fadeInUp} className="flex flex-col items-center text-center flex-1 px-2">
                  <div className="w-14 h-14 shrink-0 rounded-full bg-[#0B0B0B] border-2 border-[#22C55E] flex items-center justify-center neon-glow z-10 mb-5">
                    <item.icon className="text-[#22C55E]" size={24} />
                  </div>
                  <h4 className="text-base font-bold font-heading mb-2">{item.title}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section id="gallery" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#080808] relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-3 sm:mb-4">Gallery</h2>
            <p className="text-gray-400 text-base sm:text-lg">Moments from our community</p>
          </div>

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6 mb-10 sm:mb-16">
            {gallery.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.08, 0.5), duration: 0.5 }}
                className="overflow-hidden rounded-xl inline-block w-full border border-white/5 hover:border-[#22C55E]/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300 group"
              >
                <img
                  src={img}
                  alt={`Community moment ${i + 1}`}
                  className="w-full h-auto transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <button className="px-7 py-3 rounded-full border border-[#22C55E] text-[#22C55E] font-medium hover:bg-[#22C55E] hover:text-[#0B0B0B] transition-all text-sm sm:text-base">
              View More
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-28 px-4 sm:px-6 relative overflow-hidden z-10">
        <FloatingOrbs />
        <div
          className="max-w-4xl mx-auto text-center relative z-10 glass-card p-8 sm:p-14 md:p-20"
          style={{ borderColor: 'rgba(34,197,94,0.2)' }}
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-black mb-4 sm:mb-6 heading-gradient"
            style={{ fontSize: 'clamp(2.2rem, 7vw, 5rem)' }}
          >
            Join the Movement
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base sm:text-xl text-gray-300 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Be part of an unforgettable day of fitness, connection, and community pride. Lace up your shoes and take the first step.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link
              href="/register"
              className="inline-block bg-[#22C55E] text-[#0B0B0B] px-8 sm:px-12 py-4 sm:py-5 rounded-full font-black text-lg sm:text-2xl neon-glow hover:bg-[#16A34A] hover:text-white transition-all transform hover:scale-105"
            >
              Register Now
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── SPONSORS ── */}
      <section id="sponsors" className="py-16 sm:py-24 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold mb-3 sm:mb-4">Our Sponsors</h2>
            <p className="text-gray-400 text-base sm:text-lg">Proudly supported by</p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {sponsors.map((sponsor, i) => (
              sponsor.website_url ? (
                <motion.a
                  key={sponsor.id}
                  href={sponsor.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variants={fadeInUp}
                  className="glass-card p-5 sm:p-8 flex items-center justify-center hover:border-[#22C55E]/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] transition-all group"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <img
                    src={sponsor.logo_url ?? ''}
                    alt={sponsor.business_name}
                    className="w-full max-w-[140px] sm:max-w-[200px] opacity-70 group-hover:opacity-100 transition-opacity filter grayscale group-hover:grayscale-0"
                    loading="lazy"
                  />
                </motion.a>
              ) : (
                <motion.div
                  key={sponsor.id}
                  variants={fadeInUp}
                  className="glass-card p-5 sm:p-8 flex items-center justify-center border border-white/10 bg-white/5 opacity-80"
                  style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <img
                    src={sponsor.logo_url ?? ''}
                    alt={sponsor.business_name}
                    className="w-full max-w-[140px] sm:max-w-[200px] opacity-70 transition-opacity filter grayscale"
                    loading="lazy"
                  />
                </motion.div>
              )
            ))}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
