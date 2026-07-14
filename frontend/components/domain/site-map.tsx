'use client';

import { useEffect, useRef } from 'react';

type Punch = {
  id: string;
  punchDate: string;
  checkInAt?: string;
  isGpsAnomaly: boolean;
  user: { firstName: string; lastName: string };
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
};

interface SiteMapProps {
  latitude: number;
  longitude: number;
  gpsRadiusMeters: number;
  siteName: string;
  punches?: Punch[];
}

declare global {
  interface Window {
    L: any;
  }
}

export function SiteMap({ latitude, longitude, gpsRadiusMeters, siteName, punches = [] }: SiteMapProps) {
  const mapRef   = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    function initMap() {
      const L = window.L;
      if (!L || !mapRef.current) return;

      // Destroy previous instance
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(
        [latitude, longitude],
        16,
      );
      leafletRef.current = map;

      // Tile layer — OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // GPS radius circle
      L.circle([latitude, longitude], {
        radius: gpsRadiusMeters,
        color: '#1E5AAB',
        fillColor: '#3B82F6',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);

      // Site center marker
      const siteIcon = L.divIcon({
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:#1E5AAB;border:3px solid #fff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          font-size:16px;color:white;
        ">🏗</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([latitude, longitude], { icon: siteIcon })
        .addTo(map)
        .bindPopup(`<strong>${siteName}</strong><br>Centre du site<br>Rayon : ${gpsRadiusMeters} m`);

      // Punch markers
      for (const punch of punches) {
        const lat = punch.checkInLatitude;
        const lng = punch.checkInLongitude;
        if (lat == null || lng == null) continue;

        const isAnomaly = punch.isGpsAnomaly;
        const color = isAnomaly ? '#DC2626' : '#16A34A';
        const bg    = isAnomaly ? '#FEE2E2' : '#DCFCE7';
        const emoji = isAnomaly ? '⚠️' : '✅';

        const icon = L.divIcon({
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:${bg};border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 4px rgba(0,0,0,0.25);
            font-size:13px;
          ">${emoji}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const dateStr = new Date(punch.punchDate).toLocaleDateString('fr-FR');
        const timeStr = punch.checkInAt
          ? new Date(punch.checkInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '—';

        L.marker([Number(lat), Number(lng)], { icon })
          .addTo(map)
          .bindPopup(
            `<strong>${punch.user.firstName} ${punch.user.lastName}</strong><br>
             ${dateStr} à ${timeStr}<br>
             <span style="color:${color};font-weight:600">${isAnomaly ? '⚠ Anomalie GPS' : '✓ Position OK'}</span>`,
          );
      }
    }

    // Load Leaflet CSS if not already loaded
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (window.L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, [latitude, longitude, gpsRadiusMeters, siteName, punches.length]);

  return (
    <div
      ref={mapRef}
      style={{ height: '360px', width: '100%', borderRadius: '8px', zIndex: 0 }}
      aria-label={`Carte du site ${siteName}`}
    />
  );
}
