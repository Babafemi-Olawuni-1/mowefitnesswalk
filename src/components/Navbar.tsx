import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/#about' },
    { label: 'Event', href: '/#event' },
    { label: 'Gallery', href: '/#gallery' },
    { label: 'Sponsors', href: '/#sponsors' },
    { label: 'Admin', href: '/admin' },
  ];

  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-[#0B0B0B]/95 backdrop-blur-md border-b border-white/10 shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 relative z-50 shrink-0">
          <img
            src={logoSrc}
            alt="Mowe-Ibafo X Community Logo"
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-full bg-white"
          />
          <span className="text-white font-heading font-bold text-sm sm:text-lg leading-tight tracking-tight max-w-[140px] sm:max-w-none">
            Mowe-Ibafo X<br className="sm:hidden" /><span className="hidden sm:inline"> </span>Community
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/register"
            className="bg-[#22C55E] text-[#0B0B0B] px-5 py-2 rounded-full font-bold text-sm neon-glow transition-all hover:bg-[#16A34A] hover:text-white whitespace-nowrap"
          >
            Register Now
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white relative z-50 p-2 -mr-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#0B0B0B]/98 backdrop-blur-xl z-40 flex flex-col items-center justify-center gap-6 px-6"
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-2xl font-heading font-bold text-white hover:text-[#22C55E] transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/register"
              onClick={() => setIsMobileMenuOpen(false)}
              className="bg-[#22C55E] text-[#0B0B0B] px-10 py-4 rounded-full font-black text-xl neon-glow mt-4 hover:bg-[#16A34A] hover:text-white transition-all"
            >
              Register Now
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
