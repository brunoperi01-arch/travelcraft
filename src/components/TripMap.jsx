import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const DAY_COLORS = ["#C49A58", "#C75B3F", "#2E6B64", "#7B4B6E", "#3E5F8A", "#6E7B3F", "#9A4A30", "#4A6B8A"];
export const TYPES = {
  restaurant: { label: "Restaurant", ico: "🍽" }, vue: { label: "Point de vue", ico: "🌅" },
  balade: { label: "Balade", ico: "🚶" }, musee: { label: "Musée", ico: "🏛" },
  bar: { label: "Bar", ico: "🍸" }, pepite: { label: "Pépite", ico: "✦" },
};
const MOMENTS = { matin: "Matin", am: "Après-midi", soir: "Soir", table: "À table", pepite: "Pépite" };

const popupHTML = (p, day) => `
  <div style="font-family:'Albert Sans',sans-serif">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#C49A58;font-weight:700">
      Jour ${day} · ${MOMENTS[p.moment] || ""} ${TYPES[p.type] ? "· " + TYPES[p.type].ico : ""}</div>
    <div style="font-family:'Fraunces',serif;font-size:15px;color:#0F2E2C">${p.name}</div>
    <div style="font-size:12.5px;margin-top:4px;line-height:1.45">
      ${p.district ? "Quartier : " + p.district + "<br/>" : ""}${p.address || ""}
      ${p.custom_note ? "<br/>💡 " + p.custom_note : ""}</div>
  </div>`;

/**
 * Carte du voyage.
 * @param days   [{day_number, places:[{name, latitude, longitude, moment, type, ...}]}]
 * @param dayFilter   0 = tous les jours
 * @param typeFilter  "" = tous les types
 * @param height
 */
export default function TripMap({ days = [], dayFilter = 0, typeFilter = "", height = 380 }) {
  const ref = useRef(null), mapRef = useRef(null), layerRef = useRef(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const m = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap · © CARTO", maxZoom: 19,
    }).addTo(m);
    m.setView([45, 5], 4);
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const m = mapRef.current, g = layerRef.current;
    if (!m || !g) return;
    g.clearLayers();
    const fitPts = [];
    days
      .filter((d) => !dayFilter || d.day_number === dayFilter)
      .forEach((d) => {
        const color = DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length];
        const pts = (d.places || []).filter(
          (p) => p.latitude != null && (!typeFilter || p.type === typeFilter)
        );
        pts.forEach((p) => {
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 6px;background:${color};
              display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;
              border:2px solid #fff;box-shadow:0 2px 6px rgba(15,46,44,.35);font-family:sans-serif">
              J${d.day_number}-${p.order}</div>`,
            iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
          });
          L.marker([p.latitude, p.longitude], { icon }).addTo(g).bindPopup(popupHTML(p, d.day_number), { maxWidth: 240 });
          fitPts.push([p.latitude, p.longitude]);
        });
        if (pts.length > 1)
          L.polyline(pts.map((p) => [p.latitude, p.longitude]),
            { color, weight: 2.5, dashArray: "7 7", opacity: 0.85 }).addTo(g);
      });
    if (fitPts.length === 1) m.setView(fitPts[0], 14);
    else if (fitPts.length) m.fitBounds(fitPts, { padding: [34, 34], maxZoom: 15 });
    setTimeout(() => m.invalidateSize(), 120);
  }, [days, dayFilter, typeFilter]);

  return <div ref={ref} style={{ height, width: "100%", borderRadius: 12, border: "1px solid #E3DCCD", zIndex: 0 }} />;
}
