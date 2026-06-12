import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import TripMap, { TYPES } from "../../components/TripMap";
import { analyzeTrip } from "../../lib/geo";
import { useSession, Login } from "./AdminDashboard";

const EMPTY_DAY = { title: "", quote: "", morning: "", afternoon: "", evening: "", restaurant: "", local_gem: "", practical_tip: "" };
const EMPTY_PLACE = { name: "", type: "balade", district: "", address: "", latitude: "", longitude: "" };

export default function AdminTrip() {
  const session = useSession();
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [days, setDays] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [dayForm, setDayForm] = useState(EMPTY_DAY);
  const [placeForm, setPlaceForm] = useState(EMPTY_PLACE);
  const [linkDay, setLinkDay] = useState("");
  const [linkMoment, setLinkMoment] = useState("matin");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data: t } = await supabase.from("trips").select("*").eq("id", id).single();
    const { data: d } = await supabase.from("trip_days").select("*").eq("trip_id", id).order("day_number");
    const dayIds = (d || []).map((x) => x.id);
    let links = [];
    if (dayIds.length) {
      const { data: l } = await supabase.from("trip_day_places")
        .select("*, place:places(*)").in("trip_day_id", dayIds).order("order_index");
      links = l || [];
    }
    const { data: fb } = await supabase.from("client_feedback")
      .select("*, place:places(name)").eq("trip_id", id).order("created_at", { ascending: false });
    setTrip(t);
    setDays((d || []).map((x) => ({
      ...x,
      places: links.filter((l) => l.trip_day_id === x.id)
        .map((l) => ({ ...l.place, moment: l.moment, order: l.order_index, link_id: l.id })),
    })));
    setFeedback(fb || []);
  };
  useEffect(() => { if (session) load(); }, [session, id]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (!trip) return null;

  const addDay = async () => {
    const day_number = (days[days.length - 1]?.day_number || 0) + 1;
    const { error } = await supabase.from("trip_days").insert({ ...dayForm, trip_id: id, day_number });
    setMsg(error ? error.message : `Jour ${day_number} ajouté ✓`);
    setDayForm(EMPTY_DAY); load();
  };

  const addPlaceAndLink = async () => {
    if (!placeForm.name || !linkDay) { setMsg("Nom du lieu et jour requis."); return; }
    const { data: place, error } = await supabase.from("places").insert({
      ...placeForm,
      latitude: placeForm.latitude === "" ? null : parseFloat(placeForm.latitude),
      longitude: placeForm.longitude === "" ? null : parseFloat(placeForm.longitude),
    }).select().single();
    if (error) { setMsg(error.message); return; }
    const day = days.find((d) => d.id === linkDay);
    await supabase.from("trip_day_places").insert({
      trip_day_id: linkDay, place_id: place.id, moment: linkMoment,
      order_index: (day?.places?.length || 0) + 1,
    });
    setMsg(`« ${place.name} » ajouté au jour ${day?.day_number} ✓`);
    setPlaceForm(EMPTY_PLACE); load();
  };

  const removeLink = async (link_id) => { await supabase.from("trip_day_places").delete().eq("id", link_id); load(); };
  const issues = analyzeTrip(days);

  return (
    <div className="admin">
      <Link to="/admin" className="btn btn-ghost" style={{ marginBottom: 16 }}>← Tableau de bord</Link>
      <div className="eyebrow">{trip.is_published ? "Publié" : "Brouillon"} · /trip/{trip.public_slug}</div>
      <h1 className="disp">{trip.title || trip.destination}</h1>
      {msg && <div className="ok">{msg}</div>}

      <div className="admin-grid">
        <section className="card">
          <h2>Ajouter une journée</h2>
          {Object.entries({ title: "Titre", quote: "Sous-titre émotionnel", morning: "Matin", afternoon: "Après-midi", evening: "Soir", restaurant: "Restaurant", local_gem: "Pépite locale", practical_tip: "Conseil pratique" })
            .map(([k, label]) => (
              <div className="field" key={k}><label>{label}</label>
                <input value={dayForm[k]} onChange={(e) => setDayForm({ ...dayForm, [k]: e.target.value })} /></div>
            ))}
          <button className="btn btn-ink" onClick={addDay}>Ajouter le jour {(days[days.length - 1]?.day_number || 0) + 1}</button>
        </section>

        <section className="card">
          <h2>Ajouter un lieu</h2>
          <div className="field"><label>Nom *</label><input value={placeForm.name} onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })} /></div>
          <div className="row2">
            <div className="field"><label>Type</label>
              <select value={placeForm.type} onChange={(e) => setPlaceForm({ ...placeForm, type: e.target.value })}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.ico} {v.label}</option>)}
              </select></div>
            <div className="field"><label>Quartier</label><input value={placeForm.district} onChange={(e) => setPlaceForm({ ...placeForm, district: e.target.value })} /></div>
          </div>
          <div className="field"><label>Adresse</label><input value={placeForm.address} onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })} /></div>
          <div className="row2">
            <div className="field"><label>Latitude</label><input value={placeForm.latitude} onChange={(e) => setPlaceForm({ ...placeForm, latitude: e.target.value })} placeholder="38.7117 (optionnel)" /></div>
            <div className="field"><label>Longitude</label><input value={placeForm.longitude} onChange={(e) => setPlaceForm({ ...placeForm, longitude: e.target.value })} placeholder="-9.1296" /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Jour *</label>
              <select value={linkDay} onChange={(e) => setLinkDay(e.target.value)}>
                <option value="">—</option>
                {days.map((d) => <option key={d.id} value={d.id}>Jour {d.day_number} — {d.title}</option>)}
              </select></div>
            <div className="field"><label>Moment</label>
              <select value={linkMoment} onChange={(e) => setLinkMoment(e.target.value)}>
                {["matin", "am", "soir", "table", "pepite"].map((m) => <option key={m}>{m}</option>)}
              </select></div>
          </div>
          <button className="btn btn-gold" onClick={addPlaceAndLink}>Ajouter au voyage</button>
        </section>
      </div>

      {days.length > 0 && (
        <>
          <h2 style={{ margin: "26px 0 10px" }}>Carte & cohérence</h2>
          <TripMap days={days} height={340} />
          {issues.length === 0
            ? <div className="ok">✓ Aucun doublon, journées équilibrées, trajets cohérents.</div>
            : issues.map((i, k) => <div key={k} className="warn">{i.msg}</div>)}

          <h2 style={{ margin: "26px 0 10px" }}>Journées</h2>
          {days.map((d) => (
            <div key={d.id} className="card" style={{ marginBottom: 10 }}>
              <b>Jour {d.day_number} — {d.title}</b>
              {(d.places || []).map((p) => (
                <div key={p.link_id} className="place-row">
                  <span>{TYPES[p.type]?.ico} {p.name} <i className="muted">({p.moment}{p.latitude == null ? " · 📍 coordonnées à compléter" : ""})</i></span>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => removeLink(p.link_id)}>retirer</button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {feedback.length > 0 && (
        <>
          <h2 style={{ margin: "26px 0 10px" }}>Feedback client ({feedback.length})</h2>
          {feedback.map((f) => (
            <div key={f.id} className="card" style={{ marginBottom: 8, fontSize: 13.5 }}>
              {f.liked === true && "👍 "}{f.liked === false && "👎 "}
              {f.rating && "★".repeat(f.rating) + " "}
              {f.place?.name && <b>{f.place.name} — </b>}
              {f.comment}
              <span className="muted" style={{ float: "right" }}>{new Date(f.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
