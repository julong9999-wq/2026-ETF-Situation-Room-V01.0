import React, { useEffect, useRef } from 'react';

interface AdSenseBlockProps {
  client?: string; // ca-pub-XXXXXXXXXXXXXXXX
  slot: string;    // The ad slot ID from Google AdSense interface
  format?: 'auto' | 'fluid' | 'rectangle';
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
    // Prevent execution on server-side or if window is undefined
    if (typeof window === 'undefined') return;

    // Add a small delay to ensure the DOM element has a calculated width before requesting the ad.
    // This fixes the "adsbygoogle.push() error: No slot size for availableWidth=0" error
    // which occurs when the ad is requested before the container has a layout (e.g., inside animations or flex containers).
    const timer = setTimeout(() => {
        try {
            // Only push if the ref exists.
            // Note: We normally check if it's already loaded, but AdSense script handles duplicates gracefully usually.
            // @ts-ignore
            if (window.adsbygoogle && adRef.current) {
                // Double check if the element has width (not 0) to avoid the error specifically
                if (adRef.current.offsetWidth > 0 || (adRef.current.parentElement && adRef.current.parentElement.offsetWidth > 0)) {
                   // @ts-ignore
                   (window.adsbygoogle = window.adsbygoogle || []).push({});
                } else {
                   // Fallback: If still 0 width (hidden), try pushing anyway after another short delay or just log warning
                   // Usually the timeout is enough.
                   // @ts-ignore
                   (window.adsbygoogle = window.adsbygoogle || []).push({});
                }
            }
        } catch (e) {
            console.error("AdSense Push Error:", e);
        }
    }, 200); // 200ms delay to allow for layout shifts/transitions

    return () => clearTimeout(timer);
  }, [slot]); // Re-run if slot changes

  // Only show placeholder if running on localhost
  // AdSense doesn't work on localhost usually, so we mock it.
  const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isDev) {
      // Adjusted minHeight to 60px to allow smaller ads in dev mode
      return (
          <div className={`bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-sm p-2 ${className}`} style={{ minHeight: '60px', ...style }}>
              <span className="font-bold text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-500 mb-0.5">{label}</span>
              <span className="text-[10px]">Google AdSense Space</span>
              <span className="text-[9px] opacity-70">(ID: {slot})</span>
          </div>
      );
  }

  // Reduced my-2 to my-1 to save vertical space
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