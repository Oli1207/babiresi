/**
 * Écran de détail générique pour Guide, Restaurant, Activité, Chauffeur.
 * Paramètre URL : /services/:type/:id
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { servicesApi, formatFCFA, RESTAURANT_CATEGORIES, VEHICLE_TYPES } from '../../../utils/services';
import './services.css';

function ReviewsSection({ objectType, objectId }) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    servicesApi.reviews({ object_type: objectType, object_id: objectId })
      .then(r => setReviews(r.data.results || r.data))
      .catch(() => {});
  }, [objectType, objectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await servicesApi.postReview({ ...form, object_type: objectType, object_id: objectId });
      setReviews(prev => [res.data, ...prev]);
      setForm({ rating: 5, comment: '' });
      setFeedback('✅ Avis publié !');
    } catch (err) {
      setFeedback(err.response?.data?.detail || 'Erreur.');
    } finally {
      setSubmitting(false); }
  };

  return (
    <div className="reviews-section">
      <h3>Avis ({reviews.length})</h3>
      {isLoggedIn() && (
        <form onSubmit={handleSubmit} className="review-form">
          <div className="star-picker">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" className={`star-btn ${form.rating >= n ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, rating: n }))}>★</button>
            ))}
          </div>
          <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} placeholder="Partagez votre expérience..." rows={3} className="form-input" />
          {feedback && <p className={`form-${feedback.startsWith('✅') ? 'success' : 'error'}`}>{feedback}</p>}
          <button type="submit" disabled={submitting} className="btn-order" style={{ marginTop: 8 }}>Publier l'avis</button>
        </form>
      )}
      <div style={{ marginTop: 16 }}>
        {reviews.length === 0 ? <p className="no-data">Pas encore d'avis.</p> : reviews.map(r => (
          <div key={r.id} className="review-item">
            <div className="review-header">
              <span className="review-author">{r.author_name}</span>
              <span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            </div>
            <p className="review-comment">{r.comment}</p>
            <span className="review-date">{new Date(r.created_at).toLocaleDateString('fr-CI')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingForm({ type, itemId, item, onSuccess }) {
  const [form, setForm] = useState({ date: '', client_note: '' });
  // Guide-specific
  const [bookType, setBookType] = useState('half_day');
  const [nbDays, setNbDays] = useState(1);
  const [guests, setGuests] = useState(1);
  // Activity-specific
  const [nbPersons, setNbPersons] = useState(item?.min_persons || 1);
  // Driver-specific
  const [vehicleId, setVehicleId] = useState(item?.vehicles?.[0]?.id || '');
  const [withDriver, setWithDriver] = useState(true);
  const [endDate, setEndDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalGuide = () => {
    if (bookType === 'half_day') return item.half_day_price;
    if (bookType === 'full_day') return item.full_day_price;
    return (item.multi_day_price || item.full_day_price) * nbDays;
  };

  const totalActivity = () => item?.price_per_person ? item.price_per_person * nbPersons : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (type === 'guides') {
        await servicesApi.bookGuide(itemId, {
          date: form.date,
          type: bookType,
          nb_days: bookType === 'multi_day' ? nbDays : 1,
          guests_count: guests,
          client_note: form.client_note,
        });
      } else if (type === 'activities') {
        await servicesApi.bookActivity(itemId, {
          date: form.date,
          nb_persons: nbPersons,
          client_note: form.client_note,
        });
      } else if (type === 'drivers') {
        await servicesApi.bookVehicle(vehicleId, {
          with_driver: withDriver,
          start_date: form.date,
          end_date: endDate,
          pickup_location: '',
          client_note: form.client_note,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Erreur de réservation.');
    } finally {
      setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="booking-form">
      <div className="form-group">
        <label>{type === 'drivers' ? 'Date de début' : 'Date'}</label>
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="form-input" required />
      </div>

      {type === 'guides' && (
        <>
          <div className="form-group">
            <label>Type</label>
            <select value={bookType} onChange={e => setBookType(e.target.value)} className="form-input">
              <option value="half_day">Demi-journée — {formatFCFA(item?.half_day_price)}</option>
              <option value="full_day">Journée entière — {formatFCFA(item?.full_day_price)}</option>
              <option value="multi_day">Multi-jours — {formatFCFA(item?.multi_day_price || item?.full_day_price)}/j</option>
            </select>
          </div>
          {bookType === 'multi_day' && (
            <div className="form-group">
              <label>Nombre de jours</label>
              <input type="number" min={2} value={nbDays} onChange={e => setNbDays(Number(e.target.value))} className="form-input" />
            </div>
          )}
          <div className="form-group">
            <label>Nombre de personnes</label>
            <input type="number" min={1} value={guests} onChange={e => setGuests(Number(e.target.value))} className="form-input" />
          </div>
          <div className="booking-total">Total estimé : <strong>{formatFCFA(totalGuide())}</strong></div>
        </>
      )}

      {type === 'activities' && (
        <>
          <div className="form-group">
            <label>Nombre de personnes ({item?.min_persons}–{item?.max_persons})</label>
            <input type="number" min={item?.min_persons || 1} max={item?.max_persons} value={nbPersons} onChange={e => setNbPersons(Number(e.target.value))} className="form-input" />
          </div>
          <div className="booking-total">Total estimé : <strong>{formatFCFA(totalActivity())}</strong></div>
        </>
      )}

      {type === 'drivers' && (
        <>
          <div className="form-group">
            <label>Véhicule</label>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="form-input">
              {item?.vehicles?.map(v => (
                <option key={v.id} value={v.id}>{VEHICLE_TYPES[v.type] || v.type} — {v.brand} {v.model}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date de fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" required />
          </div>
          <div className="toggle-row" style={{ marginBottom: 10 }}>
            <span>Avec chauffeur</span>
            <button type="button" className={`toggle-btn ${withDriver ? 'active' : ''}`} onClick={() => setWithDriver(!withDriver)}>
              {withDriver ? 'Oui' : 'Non'}
            </button>
          </div>
        </>
      )}

      <div className="form-group">
        <label>Note (optionnel)</label>
        <textarea value={form.client_note} onChange={e => setForm(f => ({ ...f, client_note: e.target.value }))} rows={2} className="form-input" placeholder="Informations utiles pour le prestataire..." />
      </div>
      {error && <div className="form-error">{error}</div>}
      <button type="submit" disabled={submitting} className="btn-order" style={{ marginTop: 8 }}>
        {submitting ? 'Envoi...' : '✅ Confirmer la réservation'}
      </button>
    </form>
  );
}

export default function ServiceDetailScreen() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    const fetcher = {
      guides: () => servicesApi.guideDetail(id),
      restaurants: () => servicesApi.restaurantDetail(id),
      activities: () => servicesApi.activityDetail(id),
      drivers: () => servicesApi.driverDetail(id),
    }[type];
    if (!fetcher) { navigate('/services'); return; }
    fetcher().then(r => setItem(r.data)).catch(() => navigate('/services')).finally(() => setLoading(false));
  }, [type, id]);

  if (loading) return <div className="services-screen"><div className="loading-spinner" /></div>;
  if (!item) return null;

  const objectTypeMap = { guides: 'guide', restaurants: 'restaurant', activities: 'activity', drivers: 'driver' };
  const canBook = ['guides', 'activities', 'drivers'].includes(type);

  return (
    <div className="services-screen">
      <button onClick={() => navigate('/services')} className="btn-back-service">← Services</button>

      {/* Hero info */}
      <div className="service-detail-header">
        {(item.cover_image || item.user_photo || item.photo) && (
          <img src={item.cover_image || item.user_photo || item.photo} alt="" className="service-detail-cover" />
        )}
        <div className="service-detail-meta">
          <h1>{item.user_name || item.name || item.title}</h1>
          {item.rating_avg && (
            <div className="rating-row">
              <span className="stars-big">{'★'.repeat(Math.round(item.rating_avg))}</span>
              <span>{Number(item.rating_avg).toFixed(1)} ({item.total_reviews} avis)</span>
            </div>
          )}

          {/* Guide specifics */}
          {type === 'guides' && (
            <div className="service-chips">
              {item.is_verified && <span className="chip-verified">✅ Certifié</span>}
              {item.is_anglophone_certified && <span className="chip-verified">🇬🇧 Anglophone</span>}
              {item.languages?.map(l => <span key={l} className="chip">{l}</span>)}
            </div>
          )}

          {/* Restaurant specifics */}
          {type === 'restaurants' && (
            <div className="service-chips">
              <span className="chip">{RESTAURANT_CATEGORIES[item.category] || item.category}</span>
              <span className="chip">{item.price_range}</span>
              {item.address && <span className="chip">📍 {item.address}</span>}
            </div>
          )}

          {/* Activity specifics */}
          {type === 'activities' && (
            <div className="service-chips">
              <span className="chip">⏱ {item.duration_hours}h</span>
              <span className="chip">👥 {item.min_persons}–{item.max_persons} pers.</span>
              <span className="price-big">{formatFCFA(item.price_per_person)}/pers.</span>
            </div>
          )}

          {/* Driver specifics */}
          {type === 'drivers' && item.vehicles?.length > 0 && (
            <div className="vehicles-list">
              {item.vehicles.map(v => (
                <div key={v.id} className="vehicle-card">
                  {v.photo && <img src={v.photo} alt="" className="vehicle-photo" />}
                  <div>
                    <strong>{VEHICLE_TYPES[v.type] || v.type} — {v.brand} {v.model} ({v.year})</strong>
                    <p>👥 {v.capacity} pers. · {v.has_ac ? '❄️ Clim' : ''}</p>
                    <p className="price-big">Avec chauffeur : {formatFCFA(v.price_per_day_with_driver)}/j</p>
                    <p>Sans chauffeur : {formatFCFA(v.price_per_day_without_driver)}/j</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {(item.bio || item.description) && (
        <div className="service-section">
          <h3>À propos</h3>
          <p>{item.bio || item.description}</p>
        </div>
      )}

      {/* Restaurant images */}
      {type === 'restaurants' && item.images?.length > 0 && (
        <div className="service-section">
          <div className="img-gallery">
            {item.images.map(img => <img key={img.id} src={img.image} alt={img.caption || ''} className="gallery-img" />)}
          </div>
        </div>
      )}

      {/* Activity included */}
      {type === 'activities' && item.included_services?.length > 0 && (
        <div className="service-section">
          <h3>Inclus</h3>
          <ul>{item.included_services.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {/* Booking CTA */}
      {canBook && (
        <div className="service-section">
          {bookingSuccess ? (
            <div className="form-success">✅ Réservation envoyée ! Le prestataire vous contactera sous 24h.</div>
          ) : showBooking ? (
            <BookingForm type={type} itemId={id} item={item} onSuccess={() => { setShowBooking(false); setBookingSuccess(true); }} />
          ) : (
            <button className="btn-book" onClick={() => isLoggedIn() ? setShowBooking(true) : navigate('/login')}>
              📅 Réserver maintenant
            </button>
          )}
        </div>
      )}

      {/* Reviews */}
      <div className="service-section">
        <ReviewsSection objectType={objectTypeMap[type] || type} objectId={id} />
      </div>
    </div>
  );
}
