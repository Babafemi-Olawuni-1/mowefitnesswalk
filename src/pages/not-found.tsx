import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0B0B0B] text-white">
      <div className="glass-card p-12 text-center max-w-lg mx-4">
        <h1 className="text-6xl font-heading font-black mb-4 text-[#22C55E]">404</h1>
        <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="bg-[#22C55E] text-[#0B0B0B] px-8 py-3 rounded-full font-bold inline-flex items-center hover:bg-[#16A34A] hover:text-white transition-all">
          Return Home
        </Link>
      </div>
    </div>
  );
}
