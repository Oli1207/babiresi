/**
 * RegisterServiceScreen — Inscription prestataire
 *
 * Permet à n'importe quel utilisateur connecté de s'inscrire comme :
 *   - Guide touristique
 *   - Artisan
 *   - Restaurateur
 *   - Organisateur d'activités
 *
 * Utilise LocationPicker (Yango-style) pour la localisation.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, Palette, Utensils, Zap, CheckCircle, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import LocationPicker from '../../components/LocationPicker';
import apiInstance from '../../../utils/axios';
import './RegisterService.css';

/* ── Config par type ─────────────────────────────────────── */
const SERVICE_TYPES = {
  guide: {
    label: 'Guide touristique',
    icon: <Compass size={28} strokeWidth={1.6} />,
    color: '#22c55e',
    endpoint: 'services/guides/me/',
    description: 'Accompagne les voyageurs à travers la Côte d\'Ivoire',
    fields: [
      { name: 'bio',            label: 'Présentation',   type: 'textarea', placeholder: 'Parle de ton expérience, tes spécialités...' },
      { name: 'specialties',    label: 'Spécialités',    type: 'text',     placeholder: 'Nature, Culture, Gastronomie...' },
      { name: 'languages',      label: 'Langues',        type: 'text',     placeholder: 'Français, English, Dioula...' },
      { name: 'half_day_price', label: 'Prix demi-journée (FCFA)', type: 'number', placeholder: '25000' },
      { name: 'full_day_price', label: 'Prix journée complète (FCFA)', type: 'number', placeholder: '45000' },
    ],
  },
  artisan: {
    label: 'Artisan',
    icon: <Palette size={28} strokeWidth={1.6} />,
    color: '#a16207',
    endpoint: 'services/artisans/me/',
    description: 'Vends ton art et savoir-faire ivoirien',
    fields: [
      { name: 'craft_type', label: 'Type d\'artisanat', type: 'text', placeholder: 'Tissu, Sculpture, Poterie, Bijoux...' },
      { name: 'bio',        label: 'Présentation',      type: 'textarea', placeholder: 'Ton histoire, ta formation...' },
      { name: 'story',      label: 'Histoire de ton art', type: 'textarea', placeholder: 'Comment as-tu commencé ?' },
      { name: 'location',   label: 'Adresse boutique',  type: 'text', placeholder: 'Marché de Cocody, Abidjan' },
    ],
  },
  restaurant: {
    label: 'Restaurant / Maquis',
    icon: <Utensils size={28} strokeWidth={1.6} />,
    color: '#ef4444',
    endpoint: 'services/restaurants/me/',
    description: 'Fais découvrir ta cuisine aux voyageurs',
    fields: [
      { name: 'name',             label: 'Nom du restaurant',  type: 'text',     placeholder: 'Maquis Chez Adjoa' },
      { name: 'description',      label: 'Description',        type: 'textarea', placeholder: 'Cuisine locale, ambiance...' },
      { name: 'address',          label: 'Adresse',            type: 'text',     placeholder: 'Rue, quartier...' },
      { name: 'phone',            label: 'Téléphone',          type: 'tel',      placeholder: '+225 07...' },
      { name: 'category',         label: 'Catégorie',          type: 'select',
        options: [
          { value: 'maquis',         label: 'Maquis / Grillade' },
          { value: 'gastronomique',  label: 'Gastronomique' },
          { value: 'fast_food',      label: 'Fast food' },
          { value: 'café',           label: 'Café / Snack' },
          { value: 'bar',            label: 'Bar / Lounge' },
        ]
      },
      { name: 'signature_dishes', label: 'Plats signature',    type: 'text',     placeholder: 'Attiéké poisson, Aloco...' },
      { name: 'opening_hours',    label: 'Horaires',           type: 'text',     placeholder: 'Lun-Sam 9h-22h' },
    ],
  },
  activity: {
    label: 'Activité / Excursion',
    icon: <Zap size={28} strokeWidth={1.6} />,
    color: '#8b5cf6',
    endpoint: 'services/activities/me/',
    description: 'Propose des expériences uniques aux touristes',
    fields: [
      { name: 'title',            label: 'Nom de l\'activité', type: 'text',     placeholder: 'Kayak sur la lagune' },
      { name: 'description',      label: 'Description',        type: 'textarea', placeholder: 'Décris l\'expérience...' },
      { name: 'category',         label: 'Catégorie',          type: 'select',
        options: [
          { value: 'excursion',   label: 'Excursion' },
          { value: 'sport',       label: 'Sport / Aventure' },
          { value: 'culture',     label: 'Culture' },
          { value: 'gastronomie', label: 'Gastronomie' },
          { value: 'bien_etre',   label: 'Bien-être' },
        ]
      },
      { name: 'price_per_person', label: 'Prix / personne (FCFA)', type: 'number', placeholder: '15000' },
      { name: 'duration_hours',   label: 'Durée (heures)',      type: 'number', placeholder: '3' },
      { name: 'min_persons',      label: 'Min personnes',       type: 'number', placeholder: '1' },
      { name: 'max_persons',      label: 'Max personnes',       type: 'number', placeholder: '10' },
      { name: 'meeting_point',    label: 'Point de rendez-vous', type: 'text',  placeholder: 'Pont de Gaulle, Plateau' },
    ],
  },
};

/* ── Step 1 — Choix du type ──────────────────────────────── */
function TypeSelector({ onSelect }) {
  return (
    <div className="rs-screen">
      <div className="rs-container">
        <h1 className="rs-title">Rejoindre Babiresi</h1>
        <p className="rs-subtitle">Choisis comment tu veux contribuer</p>
        <div className="rs-type-grid">
          {Object.entries(SERVICE_TYPES).map(([key, cfg]) => (
            <button key={key} className="rs-type-card" onClick={() => onSelect(key)} style={{ '--accent': cfg.color }}>
              <span className="rs-type-icon" style={{ color: cfg.color, background: cfg.color + '18' }}>
                {cfg.icon}
              </span>
              <h3>{cfg.label}</h3>
              <p>{cfg.description}</p>
              <span className="rs-type-arrow"><ChevronRight size={18} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 2 — Formulaire + carte ─────────────────────────── */
function ServiceForm({ type, config }) {
  const navigate = useNavigate();
  const [form,     setForm]     = useState({});
  const [location, setLocation] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  const setField = (name, val) => setForm(f => ({ ...f, [name]: val }));

  /* Charger le profil existant au montage */
  useEffect(() => {
    apiInstance.get(config.endpoint)
      .then(r => {
        setForm(r.data || {});
        if (r.data?.latitude && r.data?.longitude) {
          setLocation({ lat: r.data.latitude, lng: r.data.longitude, address: '' });
        }
      })
      .catch(() => {});
  }, [config.endpoint]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      if (location?.lat) { payload.latitude  = location.lat; }
      if (location?.lng) { payload.longitude = location.lng; }

      await apiInstance.patch(config.endpoint, payload);
      setSaved(true);
      setTimeout(() => navigate('/services'), 1800);
    } catch (err) {
      setError(JSON.stringify(err?.response?.data || 'Erreur'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rs-screen">
      <div className="rs-container rs-form-layout">

        {/* Colonne gauche — champs */}
        <div className="rs-form-left">
          <div className="rs-form-header" style={{ borderColor: config.color }}>
            <span style={{ color: config.color }}>{config.icon}</span>
            <div>
              <h2>{config.label}</h2>
              <p>{config.description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rs-fields">
            {config.fields.map(field => (
              <div key={field.name} className="rs-field">
                <label className="rs-label">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="rs-input"
                    rows={3}
                    value={form[field.name] || ''}
                    onChange={e => setField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="rs-input"
                    value={form[field.name] || ''}
                    onChange={e => setField(field.name, e.target.value)}
                  >
                    <option value="">-- Choisir --</option>
                    {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    className="rs-input"
                    type={field.type}
                    value={form[field.name] || ''}
                    onChange={e => setField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}

            {error && <div className="rs-error">{error}</div>}

            {saved ? (
              <div className="rs-success">
                <CheckCircle size={20} /> Profil enregistré ! Redirection…
              </div>
            ) : (
              <button type="submit" className="rs-submit" disabled={loading} style={{ background: config.color }}>
                {loading ? 'Enregistrement…' : 'Enregistrer mon profil'}
              </button>
            )}
          </form>
        </div>

        {/* Colonne droite — carte */}
        <div className="rs-form-right">
          <h3 className="rs-map-title">
            <span style={{ color: config.color }}>📍</span> Ma localisation
          </h3>
          <p className="rs-map-hint">Déplace la carte pour positionner ton activité exactement. Les voyageurs te trouveront sur la carte.</p>
          <LocationPicker
            value={location}
            onChange={setLocation}
            height="380px"
            required
          />
        </div>

      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function RegisterServiceScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);

  const typeParam = searchParams.get('type');
  const [selectedType, setSelectedType] = useState(typeParam || null);

  if (!isLoggedIn) {
    return (
      <div className="rs-screen">
        <div className="rs-container" style={{ textAlign: 'center', paddingTop: 60 }}>
          <h2>Connexion requise</h2>
          <p>Connecte-toi pour devenir prestataire sur Babiresi.</p>
          <button className="rs-submit" onClick={() => navigate('/login')} style={{ background: '#f97316', maxWidth: 200 }}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  if (!selectedType) {
    return <TypeSelector onSelect={setSelectedType} />;
  }

  const config = SERVICE_TYPES[selectedType];
  if (!config) return <TypeSelector onSelect={setSelectedType} />;

  return <ServiceForm type={selectedType} config={config} />;
}
