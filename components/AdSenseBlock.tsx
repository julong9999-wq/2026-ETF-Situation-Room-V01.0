import React, { useEffect } from 'react';

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
  client = "ca-pub-XXXXXXXXXXXXXXXX", // Default placeholder
  slot,
  format = "auto",
  responsive = true,
  style = { display: "block" },
  className = "",
  label = "贊助商廣告"
}) => {

  useEffect(() => {
    try {
      // @ts-ignore
      if (window.adsbygoogle) {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.error("AdSense Push Error:", e);
    }
  }, []); // Run once on mount

  // If running on localhost or no real ID provided, we show a mock placeholder for UI testing
  const isDev = window.location.hostname === 'localhost' || client === "ca-pub-XXXXXXXXXXXXXXXX";

  if (isDev) {
      return (
          <div className={`bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-sm p-4 ${className}`} style={{ minHeight: '100px', ...style }}>
              <span className="font-bold text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-500 mb-1">{label}</span>
              <span className="text-xs">Google AdSense Space</span>
              <span className="text-[10px] opacity-70 mt-1">(ID: {slot})</span>
          </div>
      );
  }

  return (
    <div className={`overflow-hidden my-2 ${className}`}>
        {label && <div className="text-[10px] text-gray-400 text-center mb-1">{label}</div>}
        <ins
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
