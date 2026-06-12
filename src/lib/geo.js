/* Distances, temps à pied, analyse de cohérence — pur JS, zéro API */

const R = 6371, rad = (x) => (x * Math.PI) / 180;
export const haversine = (a, b) => {
  const dLa = rad(b.latitude - a.latitude), dLo = rad(b.longitude - a.longitude);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const WALK_FACTOR = 1.35;   // détour réel des rues vs vol d'oiseau
export const WALK_KMH = 4.5;

export function dayStats(places) {
  const pts = (places || []).filter((p) => p.latitude != null && p.longitude != null);
  if (pts.length < 2) return null;
  let km = 0, maxLeg = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = haversine(pts[i], pts[i + 1]) * WALK_FACTOR;
    km += d; maxLeg = Math.max(maxLeg, d);
  }
  return { km, min: (km / WALK_KMH) * 60, maxLeg, dispersed: km > 9 || maxLeg > 4 };
}

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/* Analyse complète : doublons, surcharge, dispersion, coords/adresses manquantes, restaurants en double */
export function analyzeTrip(days) {
  const issues = [];
  const seen = {}, restos = {};
  (days || []).forEach((d) => (d.places || []).forEach((p) => {
    const k = norm(p.name);
    if (!k) return;
    (seen[k] = seen[k] || { name: p.name, days: new Set() }).days.add(d.day_number);
    if (p.type === "restaurant") (restos[k] = restos[k] || { name: p.name, days: new Set() }).days.add(d.day_number);
  }));
  Object.values(seen).filter((v) => v.days.size > 1).forEach((v) =>
    issues.push({ type: "doublon", msg: `« ${v.name} » apparaît aux jours ${[...v.days].join(" et ")}. Garder ou proposer une alternative ?` }));
  Object.values(restos).filter((v) => v.days.size > 1).forEach((v) =>
    issues.push({ type: "resto", msg: `Restaurant en doublon : « ${v.name} » (jours ${[...v.days].join(", ")}).` }));
  (days || []).forEach((d) => {
    const pl = d.places || [];
    if (pl.length > 6) issues.push({ type: "charge", msg: `Jour ${d.day_number} : ${pl.length} étapes — journée probablement trop chargée.` });
    const st = dayStats(pl);
    if (st?.dispersed) issues.push({ type: "dispersion", msg: `Jour ${d.day_number} : ~${st.km.toFixed(1)} km à pied — journée géographiquement dispersée.` });
    const noCoord = pl.filter((p) => p.latitude == null);
    if (noCoord.length) issues.push({ type: "coords", msg: `Jour ${d.day_number} : coordonnées à compléter — ${noCoord.map((p) => p.name).join(", ")}.` });
    const noAddr = pl.filter((p) => !p.address);
    if (noAddr.length) issues.push({ type: "adresse", msg: `Jour ${d.day_number} : adresse manquante — ${noAddr.map((p) => p.name).join(", ")}.` });
  });
  return issues;
}

/* Lien Google Maps : itinéraire du jour, dans l'ordre */
export function googleMapsUrl(places) {
  const pts = (places || []).filter((p) => p.latitude != null);
  if (!pts.length) return null;
  return "https://www.google.com/maps/dir/" + pts.map((p) => `${p.latitude},${p.longitude}`).join("/");
}
