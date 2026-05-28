import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { travelApi, TRIP_TYPES, ACCOMMODATION_TYPES, TRANSPORT_TYPES, INTEREST_TAGS } from '../../../utils/travel';
import './travel.css';

const STEPS = [
  { key: 'personal', label: 'Vous' },
  { key: 'group', label: 'Groupe' },
  { key: 'voyage', label: 'Voyage' },
  { key: 'interests', label: 'Envies' },
  { key: 'accommodation', label: 'Hébergement' },
  { key: 'transport', label: 'Transport' },
  { key: 'services', label: 'Services' },
  { key: 'budget', label: 'Budget' },
];

const INITIAL_FORM = {
  // Personal
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country_of_residence: '',
  // Group
  adults_count: 2,
  children_count: 0,
  is_solo: false,
  // Voyage
  arrival_date: '',
  departure_date: '',
  destination_free_text: '',
  flexibility_days: 0,
  trip_type: '',
  // Interests
  interests: [],
  special_requests: '',
  // Accommodation
  accommodation_type: '',
  accommodation_notes: '',
  // Transport
  transport_type: '',
  needs_airport_transfer: true,
  // Services
  wants_guide: false,
  wants_driver: false,
  wants_activities: false,
  services_notes: '',
  // Budget
  budget_min: '',
  budget_max: '',
  budget_currency: 'XOF',
  how_did_you_find_us: '',
};

export default function PlanMyTripScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const user = useAuthStore(s => s.user);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    destination_free_text: searchParams.get('destination') || '',
    first_name: user?.full_name?.split(' ')[0] || '',
    last_name: user?.full_name?.split(' ').slice(1).join(' ') || '',
    email: user?.email || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) navigate('/login?next=/voyager');
  }, []);

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggleInterest = (interest) => setForm(f => ({
    ...f,
    interests: f.interests.includes(interest)
      ? f.interests.filter(i => i !== interest)
      : [...f.interests, interest],
  }));

  const validateStep = () => {
    const s = STEPS[step].key;
    if (s === 'personal' && (!form.first_name || !form.email || !form.phone)) {
      setError('Prénom, email et téléphone sont requis.');
      return false;
    }
    if (s === 'voyage' && (!form.arrival_date || !form.departure_date)) {
      setError('Dates d\'arrivée et de départ requises.');
      return false;
    }
    setError('');
    return true;
  };

  const nextStep = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const prevStep = () => { setStep(s => Math.max(s - 1, 0)); setError(''); };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await travelApi.createRequest(form);
      navigate(`/voyager/ma-demande/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Erreur. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="travel-screen">
      <div className="trip-planner">
        {/* Header */}
        <div className="planner-header">
          <h1>✈️ Planifie ton Séjour</h1>
          <p>Un conseiller expert en Côte d'Ivoire s'occupera de tout</p>
        </div>

        {/* Progress */}
        <div className="planner-progress">
          <div className="planner-progress-bar">
            <div className="planner-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="planner-steps">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`step-dot ${i < step ? 'done' : i === step ? 'current' : ''}`}>
                <span>{i < step ? '✓' : i + 1}</span>
              </div>
            ))}
          </div>
          <p className="step-label">{STEPS[step].label} — Étape {step + 1}/{STEPS.length}</p>
        </div>

        {/* Step content */}
        <div className="planner-body">
          {STEPS[step].key === 'personal' && (
            <div className="step-content">
              <h2>Qui êtes-vous ?</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Prénom *</label>
                  <input value={form.first_name} onChange={e => update('first_name', e.target.value)} className="form-input" placeholder="Marie" />
                </div>
                <div className="form-group">
                  <label>Nom</label>
                  <input value={form.last_name} onChange={e => update('last_name', e.target.value)} className="form-input" placeholder="Dupont" />
                </div>
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="form-input" placeholder="marie@exemple.com" />
              </div>
              <div className="form-group">
                <label>Téléphone *</label>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="form-input" placeholder="+33 6 12 34 56 78" />
              </div>
              <div className="form-group">
                <label>Pays de résidence</label>
                <input value={form.country_of_residence} onChange={e => update('country_of_residence', e.target.value)} className="form-input" placeholder="France" />
              </div>
            </div>
          )}

          {STEPS[step].key === 'group' && (
            <div className="step-content">
              <h2>Votre groupe</h2>
              <div className="toggle-row">
                <span>Je voyage seul(e)</span>
                <button
                  type="button"
                  className={`toggle-btn ${form.is_solo ? 'active' : ''}`}
                  onClick={() => update('is_solo', !form.is_solo)}
                >
                  {form.is_solo ? 'Oui' : 'Non'}
                </button>
              </div>
              {!form.is_solo && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Adultes</label>
                      <div className="counter">
                        <button type="button" onClick={() => update('adults_count', Math.max(1, form.adults_count - 1))}>−</button>
                        <span>{form.adults_count}</span>
                        <button type="button" onClick={() => update('adults_count', form.adults_count + 1)}>+</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Enfants</label>
                      <div className="counter">
                        <button type="button" onClick={() => update('children_count', Math.max(0, form.children_count - 1))}>−</button>
                        <span>{form.children_count}</span>
                        <button type="button" onClick={() => update('children_count', form.children_count + 1)}>+</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {STEPS[step].key === 'voyage' && (
            <div className="step-content">
              <h2>Votre voyage</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Arrivée *</label>
                  <input type="date" value={form.arrival_date} onChange={e => update('arrival_date', e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label>Départ *</label>
                  <input type="date" value={form.departure_date} onChange={e => update('departure_date', e.target.value)} className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label>Destination(s) souhaitée(s)</label>
                <input value={form.destination_free_text} onChange={e => update('destination_free_text', e.target.value)} className="form-input" placeholder="Abidjan, Grand-Bassam, parc de Taï..." />
              </div>
              <div className="form-group">
                <label>Flexibilité sur les dates</label>
                <select value={form.flexibility_days} onChange={e => update('flexibility_days', e.target.value)} className="form-input">
                  <option value={0}>Dates fixes</option>
                  <option value={2}>± 2 jours</option>
                  <option value={5}>± 5 jours</option>
                  <option value={7}>± 1 semaine</option>
                </select>
              </div>
              <div className="form-group">
                <label>Type de voyage</label>
                <div className="chip-grid">
                  {TRIP_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`chip ${form.trip_type === t.value ? 'active' : ''}`}
                      onClick={() => update('trip_type', form.trip_type === t.value ? '' : t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {STEPS[step].key === 'interests' && (
            <div className="step-content">
              <h2>Vos envies</h2>
              <p className="step-hint">Sélectionne ce qui t'intéresse (plusieurs choix possibles)</p>
              <div className="chip-grid">
                {INTEREST_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip ${form.interests.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleInterest(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Demandes particulières</label>
                <textarea
                  value={form.special_requests}
                  onChange={e => update('special_requests', e.target.value)}
                  rows={3}
                  className="form-input"
                  placeholder="Allergie alimentaire, mobilité réduite, occasion spéciale..."
                />
              </div>
            </div>
          )}

          {STEPS[step].key === 'accommodation' && (
            <div className="step-content">
              <h2>Hébergement</h2>
              <div className="chip-grid">
                {ACCOMMODATION_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`chip ${form.accommodation_type === t.value ? 'active' : ''}`}
                    onClick={() => update('accommodation_type', t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Précisions (équipements souhaités, localisation...)</label>
                <textarea
                  value={form.accommodation_notes}
                  onChange={e => update('accommodation_notes', e.target.value)}
                  rows={2}
                  className="form-input"
                  placeholder="Piscine, vue mer, centre-ville, quartier calme..."
                />
              </div>
            </div>
          )}

          {STEPS[step].key === 'transport' && (
            <div className="step-content">
              <h2>Transport</h2>
              <div className="chip-grid">
                {TRANSPORT_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`chip ${form.transport_type === t.value ? 'active' : ''}`}
                    onClick={() => update('transport_type', t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="toggle-row" style={{ marginTop: 16 }}>
                <span>Transfert aéroport inclus ?</span>
                <button
                  type="button"
                  className={`toggle-btn ${form.needs_airport_transfer ? 'active' : ''}`}
                  onClick={() => update('needs_airport_transfer', !form.needs_airport_transfer)}
                >
                  {form.needs_airport_transfer ? 'Oui' : 'Non'}
                </button>
              </div>
            </div>
          )}

          {STEPS[step].key === 'services' && (
            <div className="step-content">
              <h2>Services supplémentaires</h2>
              <div className="toggle-list">
                {[
                  { key: 'wants_guide', label: '🧭 Guide local certifié' },
                  { key: 'wants_driver', label: '🚗 Chauffeur privé' },
                  { key: 'wants_activities', label: '🎯 Activités & Excursions' },
                ].map(({ key, label }) => (
                  <div key={key} className="toggle-row">
                    <span>{label}</span>
                    <button
                      type="button"
                      className={`toggle-btn ${form[key] ? 'active' : ''}`}
                      onClick={() => update(key, !form[key])}
                    >
                      {form[key] ? 'Oui' : 'Non'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Autres souhaits</label>
                <textarea
                  value={form.services_notes}
                  onChange={e => update('services_notes', e.target.value)}
                  rows={2}
                  className="form-input"
                  placeholder="Séance photo, cours de cuisine locale, cours de surf..."
                />
              </div>
            </div>
          )}

          {STEPS[step].key === 'budget' && (
            <div className="step-content">
              <h2>Votre budget</h2>
              <p className="step-hint">Par personne, transport international non inclus</p>
              <div className="form-row">
                <div className="form-group">
                  <label>Budget minimum</label>
                  <input type="number" value={form.budget_min} onChange={e => update('budget_min', e.target.value)} className="form-input" placeholder="500 000" />
                </div>
                <div className="form-group">
                  <label>Budget maximum</label>
                  <input type="number" value={form.budget_max} onChange={e => update('budget_max', e.target.value)} className="form-input" placeholder="1 500 000" />
                </div>
              </div>
              <div className="form-group">
                <label>Devise</label>
                <select value={form.budget_currency} onChange={e => update('budget_currency', e.target.value)} className="form-input">
                  <option value="XOF">FCFA (XOF)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">Dollar ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Comment avez-vous connu Babiresi ?</label>
                <select value={form.how_did_you_find_us} onChange={e => update('how_did_you_find_us', e.target.value)} className="form-input">
                  <option value="">Choisir...</option>
                  <option value="social_media">Réseaux sociaux</option>
                  <option value="friend">Recommandation d'un ami</option>
                  <option value="google">Google</option>
                  <option value="travel_agency">Agence de voyage</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div className="planner-summary">
                <h3>Récap</h3>
                <div className="summary-row"><span>Groupe</span><span>{form.is_solo ? '1 personne' : `${form.adults_count} adulte(s)${form.children_count > 0 ? ` + ${form.children_count} enfant(s)` : ''}`}</span></div>
                {form.arrival_date && <div className="summary-row"><span>Arrivée</span><span>{form.arrival_date}</span></div>}
                {form.departure_date && <div className="summary-row"><span>Départ</span><span>{form.departure_date}</span></div>}
                {form.destination_free_text && <div className="summary-row"><span>Destination</span><span>{form.destination_free_text}</span></div>}
              </div>
            </div>
          )}

          {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        {/* Navigation */}
        <div className="planner-nav">
          {step > 0 && (
            <button onClick={prevStep} className="btn-prev">← Précédent</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={nextStep} className="btn-next">Suivant →</button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-submit-trip">
              {submitting ? 'Envoi...' : '🚀 Envoyer ma demande'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
