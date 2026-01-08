import React, { useEffect, useRef } from 'react';

interface AdSenseBlockProps {
  client?: string; // ca-pub-XXXXXXXXXXXXXXXX
  slot: string;    // The ad slot ID from Google AdSense interface
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical';
  responsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
  label?: string; // e.g. "Advertisement"
}

const AdSenseBlock: React.FC<AdSenseBlockProps> = ({
  client = "ca-pub-5925575464455571", // Real Publisher ID
  slot,
  format = "auto",
  responsive = true,
  style = { display: "block" },
  className = "",
  label = "贊助商廣告"
}) => {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper to push ad safely
    const pushAd = () => {
         try {
            // @ts-ignore
            if (window.adsbygoogle && adRef.current) {
                // Critical check: Ensure element is actually visible in the DOM layout
                const rect = adRef.current.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(adRef.current).display !== 'none';
                
                if (isVisible) {
                   // @ts-ignore
                   (window.adsbygoogle = window.adsbygoogle || []).push({});
                } else {
                   // If not visible yet, maybe wait a bit? (Optional logic, usually IntersectionObserver handles this)
                   // console.warn("AdBlock skipped push: Element has 0 dimensions.");
                }
            }
        } catch (e) {
            console.error("AdSense Push Error:", e);
        }
    };

    // Use IntersectionObserver to wait until element is visible/has dimensions
    if ('IntersectionObserver' in window && adRef.current) {
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            // Trigger when element intersects viewport (implies it is not display:none)
            if (entry.isIntersecting && entry.intersectionRatio > 0) {
                // Small delay to ensure layout is final
                setTimeout(() => {
                     // Double check dimensions inside timeout before pushing
                     if(adRef.current && adRef.current.offsetWidth > 0) {
                         pushAd();
                     }
                }, 200);
                observer.disconnect(); // Only load once
            }
        });
        observer.observe(adRef.current);
        return () => observer.disconnect();
    } else {
        // Fallback for environments without IntersectionObserver
        const timer = setTimeout(pushAd, 1000);
        return () => clearTimeout(timer);
    }

  }, [slot]);

  const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isDev) {
      return (
          <div className={`bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-sm p-2 ${className}`} style={{ minHeight: '60px', ...style }}>
              <span className="font-bold text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 mb-0.5">{label}</span>
              <span className="text-[10px]">Google AdSense Space</span>
              <span className="text-[9px] opacity-70">(ID: {slot})</span>
          </div>
      );
  }

  return (
    <div className={`overflow-hidden my-1 ${className}`}>
        {label && <div className="text-[9px] text-gray-300 text-center mb-0.5 transform scale-90 origin-bottom">{label}</div>}
        <ins
            ref={adRef}
            className="adsbygoogle"
            style={style}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive={responsive ? "true" : "false"}
        ></ins>
    </div>
  );
};

export default AdSenseBlock;