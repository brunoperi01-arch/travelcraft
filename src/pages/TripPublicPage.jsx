import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchTripBySlug, sendFeedback } from "../lib/supabaseClient";
import TripMap, { DAY_COLORS, TYPES } from "../components/TripMap";
import { dayStats, googleMapsUrl } from "../lib/geo";

const PLANNER_EMAIL = "contact@votre-agence.fr"; // ← à personnaliser

function FeedbackButtons({ tripId, dayId, placeId }) {
  const [state, setState] = useState(null); // 'like' | 'dislike' | 'sent'
  const vote = async (liked) => {
    setState(liked ? "like" : "dislike");
    await sendFeedback({ trip_id: tripId, trip_day_id: dayId, place_id: placeId, liked });
  };
  if (state) return <span className="fb-done">{state === "like" ? "❤️ Merci !" : "Noté, merci !"}</span>;
  return (
    <span className="fb-btns">
      <button onClick={() => vote(true)} aria-label="J'ai aimé">👍</button>
      <button onClick={() => vote(false)} aria-label="Je n'ai pas aimé">👎</button>
    </span>
  );
}

function DayComment({ tripId, dayId }) {
  const [txt, setTxt] = useState(""); const [sent, setSent] = useState(false);
  if (sent) return <p className="fb-done">✓ Commentaire transmis à votre travel planner.</p>;
  return (
    <div className="day-comment">
      <textarea rows="2" placeholder="Une envie, une question sur cette journée ?"
        value={txt} onChange={(e) => setTxt(e.target.value)} />
      <button className="btn btn-ghost" disabled={!txt.trim()}
        onClick={async () => { await sendFeedback({ trip_id: tripId, trip_day_id: dayId, comment: txt }); setSent(true); }}>
        Envoyer
      </button>
    </div>
  );
}

export default function TripPublicPage() {
  const { slug } = useParams();
  const [trip, setTrip] = useState(undefined); // undefined = loading, null = introuvable
  const [activeDay, setActiveDay] = useState(0);
  const [rating, setRating] = useState(0); const [ratingSent, setRatingSent] = useState(false);

  useEffect(() => { fetchTripBySlug(slug).then(setTrip); }, [slug]);

  if (trip === undefined) return <div className="pub loading"><div className="compass" /><p>Votre voyage se prépare…</p></div>;
  if (trip === null) return (
    <div className="pub loading">
      <h1 className="disp">Voyage introuvable</h1>
      <p>Ce lien n'est plus valide ou le voyage n'est pas encore publié.<br />Contactez votre travel planner.</p>
    </div>
  );

  const days = trip.days || [];
  const shownDays = activeDay ? days.filter((d) => d.day_number === activeDay) : days;

  return (
    <div className="pub">
      {/* Hero */}
      <header className="pub-hero">
        <div className="eyebrow">Votre voyage sur mesure</div>
        <h1>{trip.title || trip.destination}</h1>
        <p className="it">
          {trip.start_date && new Date(trip.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          {trip.end_date && " – " + new Date(trip.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}{trip.number_of_people} voyageur{trip.number_of_people > 1 ? "s" : ""}
        </p>
        <div className="divider" />
      </header>

      {/* Carte globale */}
      {days.some((d) => (d.places || []).some((p) => p.latitude != null)) && (
        <section className="pub-section">
          <h2>La carte de votre voyage</h2>
          <div className="day-chips">
            <button className={`chip-day ${!activeDay ? "on" : ""}`} onClick={() => setActiveDay(0)}>Tout</button>
            {days.map((d) => (
              <button key={d.id} className={`chip-day ${activeDay === d.day_number ? "on" : ""}`}
                style={{ "--c": DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length] }}
                onClick={() => setActiveDay(activeDay === d.day_number ? 0 : d.day_number)}>
                J{d.day_number}
              </button>
            ))}
          </div>
          <TripMap days={days} dayFilter={activeDay} height={320} />
        </section>
      )}

      {/* Jours */}
      {shownDays.map((d) => {
        const st = dayStats(d.places);
        const gmaps = googleMapsUrl(d.places);
        return (
          <article key={d.id} className="pub-day">
            <div className="day-n" style={{ color: DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length] }}>Jour {d.day_number}</div>
            <h2 className="day-t">{d.title}</h2>
            {d.quote && <p className="day-s">{d.quote}</p>}
            {[["Matin", d.morning], ["Après-midi", d.afternoon], ["Soir", d.evening], ["À table", d.restaurant]]
              .filter(([, v]) => v).map(([l, v]) => (
                <div className="slot" key={l}><b>{l}</b><span>{v}</span></div>
              ))}
            {d.local_gem && <div className="pepite"><b>Pépite locale</b><br />{d.local_gem}</div>}
            {d.practical_tip && <p className="tip">💡 {d.practical_tip}</p>}

            {(d.places || []).length > 0 && (
              <>
                <div className="places-list">
                  {d.places.map((p) => (
                    <div className="place-row" key={p.link_id}>
                      <span className="place-ico">{TYPES[p.type]?.ico || "📍"}</span>
                      <span className="place-name">{p.name}{p.district ? <i> · {p.district}</i> : null}</span>
                      <FeedbackButtons tripId={trip.id} dayId={d.id} placeId={p.id} />
                    </div>
                  ))}
                </div>
                {(d.places || []).filter((p) => p.latitude != null).length > 1 && (
                  <TripMap days={[d]} height={200} />
                )}
                {st && <p className="stats">🚶 ~{st.km.toFixed(1)} km à pied · ⏱ ~{Math.round(st.min)} min de déplacement</p>}
                {gmaps && <a className="btn btn-gold" href={gmaps} target="_blank" rel="noreferrer">Ouvrir l'itinéraire dans Google Maps</a>}
              </>
            )}
            <DayComment tripId={trip.id} dayId={d.id} />
          </article>
        );
      })}

      {/* Note globale + contact */}
      <footer className="pub-foot">
        <h2>Votre avis compte</h2>
        {ratingSent ? <p className="fb-done">✓ Merci, votre note nourrit vos prochains voyages.</p> : (
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>
            ))}
            {rating > 0 && (
              <button className="btn btn-ink" onClick={async () => {
                await sendFeedback({ trip_id: trip.id, rating }); setRatingSent(true);
              }}>Envoyer ma note</button>
            )}
          </div>
        )}
        <a className="btn btn-ghost" href={`mailto:${PLANNER_EMAIL}?subject=Mon voyage ${encodeURIComponent(trip.destination)}`}>
          ✉ Contacter mon travel planner
        </a>
        <p className="rgpd">Vos retours (👍/👎, notes, commentaires) sont enregistrés pour personnaliser vos prochains
          voyages. Vous pouvez demander leur suppression à tout moment auprès de votre travel planner.</p>
      </footer>
    </div>
  );
}
