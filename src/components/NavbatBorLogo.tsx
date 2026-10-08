import React from 'react';

interface NavbatBorLogoProps {
  /**
   * 'card' - Full square/rounded card with blue background, circle emblem, wordmark & tagline (like the user image)
   * 'horizontal' - Emblem on left, wordmark + tagline on right (ideal for Navbar and headers)
   * 'icon' - Just the circular building + leaf emblem (ideal for avatars, buttons, favicon)
   * 'emblem-card' - Blue badge with just the circular emblem
   */
  variant?: 'card' | 'horizontal' | 'icon' | 'emblem-card';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showTagline?: boolean;
  lightText?: boolean;
}

export const NavbatBorLogo: React.FC<NavbatBorLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showTagline = true,
  lightText = false
}) => {
  // Dimension mapping
  let iconPixelSize = 40;
  if (typeof size === 'number') {
    iconPixelSize = size;
  } else {
    switch (size) {
      case 'xs': iconPixelSize = 24; break;
      case 'sm': iconPixelSize = 32; break;
      case 'md': iconPixelSize = 42; break;
      case 'lg': iconPixelSize = 56; break;
      case 'xl': iconPixelSize = 96; break;
    }
  }

  // The official NavbatBor circular building + leaf emblem SVG
  const renderEmblem = (isInvertColor: boolean = false) => {
    const primaryColor = isInvertColor ? '#0066FF' : '#ffffff';
    const cutoutColor = isInvertColor ? '#ffffff' : '#0066FF';

    return (
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Circular Ring */}
        <circle cx="100" cy="100" r="76" stroke={primaryColor} strokeWidth="9.5" />

        {/* Building Rooftop Towers / Vents */}
        <path d="M103 48 L103 68 L114 68 L114 54 Z" fill={primaryColor} />
        <path d="M117 40 L117 68 L128 68 L128 47 Z" fill={primaryColor} />

        {/* Left Building Facade */}
        <path d="M54 60 L97 49 L97 122 L54 110 Z" fill={primaryColor} />

        {/* Windows on Left Facade (2 columns x 4 rows) */}
        {/* Col 1 */}
        <rect x="60" y="68" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />
        <rect x="60" y="79" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />
        <rect x="60" y="90" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />
        <rect x="60" y="101" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />

        {/* Col 2 */}
        <rect x="74" y="65" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />
        <rect x="74" y="76" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />
        <rect x="74" y="87" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />
        <rect x="74" y="98" width="6.5" height="7.5" rx="1" fill={cutoutColor} transform="skewY(14)" />

        {/* Right Building Facade & Connecting Roof Angle */}
        <path d="M97 49 L132 60 L132 94 L154 92 L154 80 L97 49 Z" fill={primaryColor} />
        {/* Right Forward Arrow / Shadow Element */}
        <polygon points="113,84 154,92 113,115" fill={primaryColor} />

        {/* Main Curved Leaf Underneath */}
        <path
          d="M60 114 C75 142, 115 152, 155 106 C138 136, 92 142, 60 114 Z"
          fill={primaryColor}
        />
        {/* Inner Curved Leaf Body */}
        <path
          d="M68 110 C82 135, 118 142, 152 108 C135 128, 98 132, 68 110 Z"
          fill={primaryColor}
        />
      </svg>
    );
  };

  // 1. Just the icon emblem
  if (variant === 'icon') {
    return (
      <div
        style={{ width: iconPixelSize, height: iconPixelSize }}
        className={`shrink-0 flex items-center justify-center ${className}`}
      >
        {renderEmblem(lightText)}
      </div>
    );
  }

  // 2. Emblem inside official blue square badge
  if (variant === 'emblem-card') {
    return (
      <div
        style={{ width: iconPixelSize, height: iconPixelSize }}
        className={`shrink-0 rounded-2xl bg-[#0066FF] p-1.5 flex items-center justify-center shadow-md shadow-[#0066FF]/25 overflow-hidden ${className}`}
      >
        {renderEmblem(false)}
      </div>
    );
  }

  // 3. Full Official Card: Blue Square with Center Emblem, Wordmark and Tagline (Exact user uploaded logo)
  if (variant === 'card') {
    return (
      <div
        className={`bg-[#0066FF] text-white rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xl shadow-[#0066FF]/30 select-none ${className}`}
        style={{ minWidth: 240 }}
      >
        <div className="w-24 h-24 sm:w-28 sm:h-28 mb-4">
          {renderEmblem(false)}
        </div>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none">
          NavbatBor
        </div>
        {showTagline && (
          <p className="text-xs sm:text-sm font-medium text-white/90 mt-2 tracking-wide">
            Navbat kutmang. Vaqtingizni qadrlang.
          </p>
        )}
      </div>
    );
  }

  // 4. Horizontal Variant (Header / Navbar / Mobile)
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official Blue Emblem Badge */}
      <div
        style={{ width: iconPixelSize, height: iconPixelSize }}
        className="shrink-0 rounded-xl bg-[#0066FF] p-1 flex items-center justify-center shadow-md shadow-[#0066FF]/25 transition-transform duration-200 group-hover:scale-105"
      >
        {renderEmblem(false)}
      </div>

      {/* Brand Text & Tagline */}
      <div className="text-left">
        <div className={`font-black tracking-tight text-lg sm:text-xl leading-tight ${lightText ? 'text-white' : 'text-slate-900'}`}>
          Navbat<span className={lightText ? 'text-blue-300' : 'text-[#0066FF]'}>Bor</span>
        </div>
        {showTagline && (
          <p className={`text-[10px] font-medium leading-none mt-0.5 ${lightText ? 'text-white/80' : 'text-slate-500'}`}>
            Navbat kutmang. Vaqtingizni qadrlang.
          </p>
        )}
      </div>
    </div>
  );
};
