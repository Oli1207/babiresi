import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Upload, Video, Image, X } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { useAuthGate } from '../../../context/AuthGate';
import { vlogsApi, VLOG_CATEGORIES, AMBIANCES, REGIONS_CI } from '../../../utils/vlogs';
import apiInstance from '../../../utils/axios';
import './vlogs.css';

const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'babiresi_vlogs';
const CLOUDINARY_CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME    || '';

/* ── Map helpers ─────────────────────────────────────────── */
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function DraggableMarker({ lat, lng, onDrag }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return (
    <Marker
      draggable
      position={[lat, lng]}
      eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onDrag(p.lat, p.lng); } }}
    />
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function CreateVlogScreen() {
  const navigate  = useNavigate();
  const isLoggedIn = !!useAuthStore(s => s.user);
  const { openAuth } = useAuthGate();

  /* — media upload — */
  const fileInputRef   = useRef(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview,      setPreview]      = useState(null);

  /* — form — */
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    ambiance: '',
    region: '',
    tags: '',
    cloudinary_url: '',
    cloudinary_public_id: '',
    thumbnail_url: '',
    city: '',
    latitude:  null,
    longitude: null,
  });
  const setField = (name, value) => setForm(f => ({ ...f, [name]: value }));

  /* — geo — */
  const [addressQuery,    setAddressQuery]    = useState('');
  const [suggestions,     setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggest,  setLoadingSuggest]  = useState(false);
  const [loadingGeo,      setLoadingGeo]      = useState(false);
  const [geoError,        setGeoError]        = useState('');
  const [manualEdit,      setManualEdit]      = useState(false);
  const reverseTimer = useRef(null);
  const suggestTimer = useRef(null);
  const lastCoords   = useRef({ lat: null, lng: null });

  /* — submit — */
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const center = useMemo(() => ({
    lat: typeof form.latitude  === 'number' ? form.latitude  : 5.3599,
    lng: typeof form.longitude === 'number' ? form.longitude : -4.0082,
  }), [form.latitude, form.longitude]);

  /* close suggestions on outside click */
  useEffect(() => {
    const h = () => setShowSuggestions(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  /* ── Geo helpers ──────────────────────────────────────── */
  const reverseGeocode = async (lat, lng) => {
    try {
      const { data } = await apiInstance.post('utils/reverse-geocode/', { latitude: lat, longitude: lng });
      if (data?.warning === 'geocode_timeout') { setGeoError('Connexion lente – remplis la ville manuellement.'); return; }
      setForm(f => ({
        ...f,
        city: manualEdit ? f.city : (data?.city || f.city),
      }));
      if (!manualEdit && data?.city) setAddressQuery(data.city);
      setGeoError('');
    } catch {
      setGeoError('Impossible de récupérer la ville automatiquement.');
    }
  };

  const setCoordsAndFill = useCallback((lat, lng) => {
    setGeoError('');
    const prev  = lastCoords.current;
    const delta = prev.lat === null ? 999 : Math.abs(prev.lat - lat) + Math.abs(prev.lng - lng);
    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
    if (delta < 0.00015) return;
    lastCoords.current = { lat, lng };
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => reverseGeocode(lat, lng), 800);
  }, [manualEdit]); // eslint-disable-line

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée.'); return; }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setManualEdit(false); setCoordsAndFill(pos.coords.latitude, pos.coords.longitude); setLoadingGeo(false); },
      ()  => { setLoadingGeo(false); setGeoError('Autorisation refusée.'); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const searchPlaces = async (q) => {
    if (!q || q.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    setLoadingSuggest(true);
    try {
      const { data } = await apiInstance.get(`utils/search-places/?q=${encodeURIComponent(q)}&limit=6`);
      setSuggestions(data?.results || []);
      setShowSuggestions(true);
    } catch { setSuggestions([]); }
    finally { setLoadingSuggest(false); }
  };

  const pickSuggestion = (s) => {
    setManualEdit(false);
    setShowSuggestions(false);
    setCoordsAndFill(Number(s.latitude), Number(s.longitude));
    setForm(f => ({ ...f, city: s.city || s.area || f.city }));
    setAddressQuery(s.address_label || s.city || '');
  };

  /* ── Media upload ─────────────────────────────────────── */
  const uploadFile = (file) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setUploading(true);
    setUploadProgress(0);
    setError('');
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    data.append('resource_type', isVideo ? 'video' : 'image');

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        setPreview(URL.createObjectURL(file));
        setForm(f => ({
          ...f,
          cloudinary_url: res.secure_url,
          cloudinary_public_id: res.public_id,
          thumbnail_url: isVideo
            ? res.secure_url.replace('/upload/', '/upload/so_0,w_400/').replace(/\.[^.]+$/, '.jpg')
            : res.secure_url,
        }));
      } else {
        setError(`Erreur upload (${xhr.status}): ${xhr.responseText}`);
      }
    };
    xhr.onerror = () => { setUploading(false); setError('Erreur réseau lors de l\'upload.'); };
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
    xhr.send(data);
  };

  /* ── Submit ───────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())       { setError('Le titre est requis.'); return; }
    if (!form.cloudinary_url)     { setError('Ajoute une vidéo ou une image.'); return; }
    if (!form.category)           { setError('Choisis une catégorie.'); return; }
    if (typeof form.latitude !== 'number' || typeof form.longitude !== 'number') {
      setError('Place ta localisation sur la carte (clique ou utilise ta position).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_published: true,
      };
      await vlogsApi.create(payload);
      navigate('/vlogs/me');
    } catch (err) {
      setError(JSON.stringify(err?.response?.data || 'Erreur inconnue'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="create-vlog-screen">
        <div className="create-vlog-container" style={{ textAlign: 'center', paddingTop: 40 }}>
          <h2>Connexion requise</h2>
          <p>Connecte-toi pour poster un vlog et participer aux concours.</p>
          <button className="btn-submit-vlog" style={{ maxWidth: 240, margin: '12px auto 0' }}
                  onClick={() => openAuth('Connecte-toi pour poster un vlog')}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="create-vlog-screen">
      <div className="create-vlog-container create-vlog-wide">
        <h1 className="create-vlog-title">Poster un Vlog</h1>
        <p className="create-vlog-subtitle">Partage ton expérience en Côte d'Ivoire et gagne des points !</p>

        <form onSubmit={handleSubmit} className="create-vlog-form cvf-grid">

          {/* ── COLONNE GAUCHE ── */}
          <div className="cvf-left">

            {/* Upload média */}
            <div className="cvf-card">
              <h3 className="cvf-card-title"><Video size={16} /> Média (vidéo ou photo)</h3>
              <input
                type="file"
                ref={fileInputRef}
                accept="video/*,image/*"
                style={{ display: 'none' }}
                onChange={e => uploadFile(e.target.files?.[0])}
              />
              <div
                className={`upload-zone ${uploading ? 'uploading' : ''} ${form.cloudinary_url ? 'uploaded' : ''}`}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="upload-progress">
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                    <p>{uploadProgress}% uploadé…</p>
                  </div>
                ) : form.cloudinary_url ? (
                  <div className="upload-success">
                    {preview && preview.includes('blob') && (
                      form.cloudinary_url.includes('/video/') || form.cloudinary_url.match(/\.(mp4|mov|webm)/i)
                        ? <video src={preview} className="upload-preview" muted playsInline />
                        : <img src={preview} alt="preview" className="upload-preview" />
                    )}
                    <p>Média uploadé</p>
                    <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, cloudinary_url: '', cloudinary_public_id: '', thumbnail_url: '' })); setPreview(null); }}>
                      <X size={14} /> Changer
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <Upload size={32} strokeWidth={1.2} color="#aaa" />
                    <p>Clique pour choisir une vidéo ou image</p>
                    <small>MP4, MOV, WEBM, JPG, PNG · max 100MB</small>
                  </div>
                )}
              </div>
            </div>

            {/* Infos */}
            <div className="cvf-card">
              <h3 className="cvf-card-title">Informations</h3>

              <label className="cvf-label">Titre *</label>
              <input className="cvf-input" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Ex: Coucher de soleil sur la lagune" />

              <label className="cvf-label">Description</label>
              <textarea className="cvf-input" rows={3} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Raconte ton expérience…" />

              <div className="cvf-row">
                <div>
                  <label className="cvf-label">Catégorie *</label>
                  <select className="cvf-input" value={form.category} onChange={e => setField('category', e.target.value)}>
                    <option value="">-- Catégorie --</option>
                    {VLOG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cvf-label">Ambiance</label>
                  <select className="cvf-input" value={form.ambiance} onChange={e => setField('ambiance', e.target.value)}>
                    <option value="">-- Ambiance --</option>
                    {AMBIANCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              <label className="cvf-label">Région</label>
              <select className="cvf-input" value={form.region} onChange={e => setField('region', e.target.value)}>
                <option value="">-- Région --</option>
                {REGIONS_CI.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>

              <label className="cvf-label">Tags (séparés par des virgules)</label>
              <input className="cvf-input" value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="plage, famille, coucher de soleil" />
            </div>
          </div>

          {/* ── COLONNE DROITE : CARTE ── */}
          <div className="cvf-right">
            <div className="cvf-card">
              <div className="cvf-loc-header">
                <h3 className="cvf-card-title"><MapPin size={16} /> Localisation <span style={{ color: '#ef4444' }}>*</span></h3>
                <button type="button" className="cvf-gps-btn" onClick={useMyLocation} disabled={loadingGeo}>
                  <Navigation size={14} /> {loadingGeo ? 'Détection…' : 'Ma position'}
                </button>
              </div>
              <p className="cvf-loc-hint">Obligatoire — place le pin pour que ton vlog apparaisse sur la carte.</p>

              {geoError && <div className="cvf-geo-error">{geoError}</div>}

              {/* Search */}
              <div className="cvf-search-wrap" onClick={e => e.stopPropagation()}>
                <input
                  className="cvf-input"
                  value={addressQuery}
                  onChange={e => {
                    const v = e.target.value;
                    setAddressQuery(v);
                    setManualEdit(true);
                    if (suggestTimer.current) clearTimeout(suggestTimer.current);
                    suggestTimer.current = setTimeout(() => searchPlaces(v), 350);
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  placeholder="Rechercher un lieu…"
                />
                {loadingSuggest && <small className="cvf-searching">Recherche…</small>}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="cvf-suggestions">
                    {suggestions.map((s, i) => (
                      <button type="button" key={i} className="cvf-suggest-item" onClick={() => pickSuggestion(s)}>
                        <strong>{s.borough || s.area || s.city || 'Lieu'}</strong>
                        <small>{s.address_label}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Map */}
              <div className="cvf-map-wrap">
                <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                  {typeof form.latitude === 'number' && <Recenter lat={form.latitude} lng={form.longitude} />}
                  <MapClickHandler onPick={(lat, lng) => { setManualEdit(false); setCoordsAndFill(lat, lng); }} />
                  <DraggableMarker lat={form.latitude} lng={form.longitude} onDrag={(lat, lng) => { setManualEdit(false); setCoordsAndFill(lat, lng); }} />
                </MapContainer>
              </div>

              {form.city && (
                <div className="cvf-city-row">
                  <label className="cvf-label">Ville</label>
                  <input className="cvf-input" value={form.city} onChange={e => { setManualEdit(true); setField('city', e.target.value); }} placeholder="Abidjan" />
                </div>
              )}

              {typeof form.latitude === 'number' && (
                <div className="cvf-coords">
                  <span>Lat : {form.latitude.toFixed(5)}</span>
                  <span>Lng : {form.longitude.toFixed(5)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── FOOTER (pleine largeur, après la carte sur mobile) ── */}
          <div className="cvf-footer">
            {error && <div className="form-error">{error}</div>}
            <div className="points-hint">
              Ce vlog peut te rapporter des points : <strong>1pt/vue · 5pts/like · 10pts/commentaire · 15pts/partage</strong>
            </div>
            <button type="submit" disabled={submitting || uploading} className="btn-submit-vlog">
              {submitting ? 'Publication…' : 'Publier le Vlog'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
