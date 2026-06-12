import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/* Slug privé difficile à deviner : lisbonne-2026-x7f92kd1 */
export function makeSlug(destination) {
  const base = (destination || "voyage")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-")[0];
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  return `${base}-${new Date().getFullYear()}-${rand}`;
}

/* Charge un voyage publié complet via son slug (page client) */
export async function fetchTripBySlug(slug) {
  const { data: trip, error } = await supabase
    .from("trips").select("*").eq("public_slug", slug).eq("is_published", true).single();
  if (error || !trip) return null;

  const { data: days } = await supabase
    .from("trip_days").select("*").eq("trip_id", trip.id).order("day_number");

  const dayIds = (days || []).map((d) => d.id);
  let links = [];
  if (dayIds.length) {
    const { data } = await supabase
      .from("trip_day_places")
      .select("*, place:places(*)")
      .in("trip_day_id", dayIds)
      .order("order_index");
    links = data || [];
  }
  return {
    ...trip,
    days: (days || []).map((d) => ({
      ...d,
      places: links.filter((l) => l.trip_day_id === d.id)
        .map((l) => ({ ...l.place, moment: l.moment, order: l.order_index, custom_note: l.custom_note, link_id: l.id })),
    })),
  };
}

export async function sendFeedback({ trip_id, trip_day_id = null, place_id = null, liked = null, rating = null, comment = null }) {
  return supabase.from("client_feedback").insert({ trip_id, trip_day_id, place_id, liked, rating, comment });
}
