import { Link } from 'wouter';
import { Globe, ExternalLink, Link2, MapPin, Mail, Phone } from 'lucide-react';

export default function Footer() {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  return (
    <footer className="bg-[#080808] border-t border-[#22C55E]/20 pt-12 sm:pt-16 pb-8 px-4 sm:px-6 relative z-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 mb-10 sm:mb-12">
        {/* Brand */}
        <div className="flex flex-col gap-4 sm:gap-6 sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt="Mowe Fitness Walk Logo"
              className="w-12 h-12 object-contain rounded-full bg-white"
            />
            <span className="text-white font-heading font-bold text-lg tracking-tight leading-tight">
              Mowe Fitness<br />Walk
            </span>
          </Link>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
            Promoting healthy living and community unity through the power of fitness. Join the movement.
          </p>
          <div className="flex items-center gap-3">
            {[
              { icon: Globe, href: 'https://x.com/MoweTwitta' },
              { icon: ExternalLink, href: '#' },
              { icon: Link2, href: '#' },
            ].map(({ icon: Icon, href }, i) => (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white hover:text-[#22C55E] hover:border-[#22C55E] transition-all"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-white font-heading font-bold text-base sm:text-lg mb-4 sm:mb-6">About</h3>
          <ul className="flex flex-col gap-3 text-gray-400">
            <li><Link href="/#about" className="hover:text-[#22C55E] transition-colors text-sm">About Us</Link></li>
            <li><Link href="/#about" className="hover:text-[#22C55E] transition-colors text-sm">Our Mission</Link></li>
            <li><Link href="/#about" className="hover:text-[#22C55E] transition-colors text-sm">Team</Link></li>
            <li><Link href="/#gallery" className="hover:text-[#22C55E] transition-colors text-sm">Gallery</Link></li>
          </ul>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-white font-heading font-bold text-base sm:text-lg mb-4 sm:mb-6">Quick Links</h3>
          <ul className="flex flex-col gap-3 text-gray-400">
            <li><Link href="/register" className="hover:text-[#22C55E] transition-colors text-sm">Register Now</Link></li>
            <li><Link href="/#event" className="hover:text-[#22C55E] transition-colors text-sm">Event Highlights</Link></li>
            <li><Link href="/#sponsors" className="hover:text-[#22C55E] transition-colors text-sm">Sponsors</Link></li>
            <li><a href="mailto:mowetwitter@gmail.com" className="hover:text-[#22C55E] transition-colors text-sm">Contact</a></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-white font-heading font-bold text-base sm:text-lg mb-4 sm:mb-6">Contact</h3>
          <ul className="flex flex-col gap-4 text-gray-400">
            <li className="flex items-start gap-3">
              <MapPin size={18} className="text-[#22C55E] shrink-0 mt-0.5" />
              <span className="text-sm">Mowe-Ibafo, Ogun State, Nigeria</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail size={18} className="text-[#22C55E] shrink-0" />
              <a href="mailto:mowetwitter@gmail.com" className="text-sm hover:text-[#22C55E] transition-colors">mowetwitter@gmail.com</a>
            </li>
            <li className="flex items-center gap-3">
              <Phone size={18} className="text-[#22C55E] shrink-0" />
              <span className="text-sm">+234 000 000 0000</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 sm:pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-500">
        <span>© 2026 Mowe Fitness Walk. All rights reserved.</span>
        <a
          href="https://olawunibabafemi.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-gray-500 hover:text-[#22C55E] transition-colors group"
        >
          <span>Developed by</span>
          <span className="font-semibold text-gray-400 group-hover:text-[#22C55E] transition-colors">
            FemTech Technologies
          </span>
          <ExternalLink size={11} className="opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>
    </footer>
  );
}
