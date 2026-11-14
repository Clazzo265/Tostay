import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  aspectClassName = 'aspect-[4/3]',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`relative overflow-hidden bg-slate-900 flex flex-col items-center justify-center text-center p-4 ${aspectClassName} ${className}`}
        role="img"
        aria-label={alt}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #38bdf8 0%, transparent 50%), linear-gradient(135deg, #0a192f 0%, #1e293b 100%)',
          }}
        />
        <Building2 className="relative z-10 w-8 h-8 text-sky-400 mb-2" />
        <span className="relative z-10 text-xs font-medium text-slate-200 line-clamp-2 max-w-[14rem]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${aspectClassName} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300"
      />
    </div>
  );
};
