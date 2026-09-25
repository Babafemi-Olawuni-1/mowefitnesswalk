import React from 'react';

export function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="orb bg-[#22C55E]/20 w-[300px] h-[300px] md:w-[500px] md:h-[500px] top-[-10%] left-[-10%]" style={{ animationDelay: '0s' }} />
      <div className="orb bg-[#86EFAC]/10 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bottom-[10%] right-[-5%]" style={{ animationDelay: '2s' }} />
      <div className="orb bg-[#22C55E]/15 w-[200px] h-[200px] md:w-[300px] md:h-[300px] top-[40%] left-[60%]" style={{ animationDelay: '4s' }} />
    </div>
  );
}
