import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, makeSlug } from "../../lib/supabaseClient";

/* ── Auth gate ───────────────────────────────────────────── */
export function useSession() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

export function Login() {
  const [email, setEmail] = useState(""); const [pwd, setPwd] = useState(""); const [err, setErr] = useState("");
  const go = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) setErr(error.message);
  };
  return (
    <div className="admin login">
      <div className="card" style={{ maxWidth: 380, margin: "12vh auto" }}>
        <div className="eyebrow">TravelCraft · Atelier</div>
        <h1 className="disp" style={{ fontSize: 26, margin: "6px 0 18px" }}>Espace travel planner</h1>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Mot de passe</label><input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-ink" onClick={go}>Entrer dans l'atelier</button>
      </div>
    </div>
  );
}

/* ── Dashboard admin : clients + voyages ─────────────────── */
export default function AdminDashboard() {
  const session = useSession();
  const nav = useNavigate();
  const [clients, setClients] = useState([]);
  const [trips, setTrips] = useState([]);
  const [cForm, setCForm] = useState({ first_name: "", last_name: "", email: "", travel_style: "", budget_level: "confort", pace: "equilibre" });
  const [tForm, setTForm] = useState({ client_id: "", destination: "", title: "", start_date: "", end_date: "", number_of_people: 2 });
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("trips").select("*, client:clients(first_name,last_name)").order("created_at", { ascending: false }),
    ]);
    setClients(c || []); setTrips(t || []);
  };
  useEffect(() => { if (session) load(); }, [session]);

  if (session === undefined) return null;
  if (!session) return <Login />;

  const addClient = async () => {
    if (!cForm.first_name) return;
    const { error } = await supabase.from("clients").insert(cForm);
    setMsg(error ? error.message : `Client ${cForm.first_name} créé ✓`);
    setCForm({ first_name: "", last_name: "", email: "", travel_style: "", budget_level: "confort", pace: "equilibre" });
    load();
  };

  const addTrip = async () => {
    if (!tForm.client_id || !tForm.destination) return;
    const slug = makeSlug(tForm.destination);
    const { data, error } = await supabase.from("trips")
      .insert({ ...tForm, public_slug: slug }).select().single();
    if (error) { setMsg(error.message); return; }
    nav(`/admin/trip/${data.id}`);
  };

  const togglePublish = async (t) => {
    await supabase.from("trips").update({ is_published: !t.is_published }).eq("id", t.id);
    load();
  };

  return (
    <div className="admin">
      <header className="admin-top">
        <div><div className="eyebrow">Atelier</div><h1 className="disp">Tableau de bord</h1></div>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </header>
      {msg && <div className="ok">{msg}</div>}

      <div className="admin-grid">
        <section className="card">
          <h2>Nouveau client</h2>
          <div className="row2">
            <div className="field"><label>Prénom *</label><input value={cForm.first_name} onChange={(e) => setCForm({ ...cForm, first_name: e.target.value })} /></div>
            <div className="field"><label>Nom</label><input value={cForm.last_name} onChange={(e) => setCForm({ ...cForm, last_name: e.target.value })} /></div>
          </div>
          <div className="field"><label>Email</label><input value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} /></div>
          <div className="field"><label>Style de voyage</label><input placeholder="slow travel, gastronomie…" value={cForm.travel_style} onChange={(e) => setCForm({ ...cForm, travel_style: e.target.value })} /></div>
          <div className="row2">
            <div className="field"><label>Budget</label>
              <select value={cForm.budget_level} onChange={(e) => setCForm({ ...cForm, budget_level: e.target.value })}>
                {["eco", "confort", "premium", "luxe"].map((b) => <option key={b}>{b}</option>)}
              </select></div>
            <div className="field"><label>Rythme</label>
              <select value={cForm.pace} onChange={(e) => setCForm({ ...cForm, pace: e.target.value })}>
                {["detendu", "equilibre", "intense"].map((b) => <option key={b}>{b}</option>)}
              </select></div>
          </div>
          <button className="btn btn-ink" onClick={addClient}>Créer le client</button>
        </section>

        <section className="card">
          <h2>Nouveau voyage</h2>
          <div className="field"><label>Client *</label>
            <select value={tForm.client_id} onChange={(e) => setTForm({ ...tForm, client_id: e.target.value })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select></div>
          <div className="field"><label>Destination *</label><input value={tForm.destination} onChange={(e) => setTForm({ ...tForm, destination: e.target.value })} placeholder="Lisbonne, Portugal" /></div>
          <div className="field"><label>Titre affiché</label><input value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} placeholder="Lisbonne & Côte Vicentine" /></div>
          <div className="row2">
            <div className="field"><label>Début</label><input type="date" value={tForm.start_date} onChange={(e) => setTForm({ ...tForm, start_date: e.target.value })} /></div>
            <div className="field"><label>Fin</label><input type="date" value={tForm.end_date} onChange={(e) => setTForm({ ...tForm, end_date: e.target.value })} /></div>
          </div>
          <button className="btn btn-gold" onClick={addTrip}>Créer & composer →</button>
        </section>
      </div>

      <h2 style={{ margin: "26px 0 10px" }}>Voyages</h2>
      {trips.map((t) => (
        <div key={t.id} className="trip-row">
          <div style={{ flex: 1 }}>
            <Link to={`/admin/trip/${t.id}`} className="disp" style={{ fontSize: 16 }}>{t.title || t.destination}</Link>
            <div className="muted">{t.client?.first_name} {t.client?.last_name} · /trip/{t.public_slug}</div>
          </div>
          {t.is_published && (
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(`${location.origin}/trip/${t.public_slug}`); setMsg("Lien privé copié ✓"); }}>
              Copier le lien privé
            </button>
          )}
          <button className={`btn ${t.is_published ? "btn-ghost" : "btn-gold"}`} onClick={() => togglePublish(t)}>
            {t.is_published ? "Dépublier" : "Publier"}
          </button>
        </div>
      ))}
    </div>
  );
}
