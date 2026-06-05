/**
 * ColocSetupScreen — Création / édition du profil coloc
 * Upload photos via Cloudinary (preset existant)
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Home, Upload, X, Trash2, Heart, MessageCircle, Settings } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { colocApi, ZONES_ABIDJAN, INTERESTS, LIFESTYLE_OPTIONS } from '../../../utils/coloc';
import './coloc.css';

const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'babiresi_vlogs';
const CLOUDINARY_CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME    || '';

export default function ColocSetupScreen() {
  const user = useAuthStore(s => s.user);
  const isLoggedIn = !!user;
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [form, setForm] = useState({
    profile_type: 'looking',
    bio: '', age: '', occupation: '', gender: '',
    budget_min: '', budget_max: '',
    place_zone: '', place_description: '', place_rent_total: '', place_rent_share: '',
    preferred_zones: [], move_in_date: '', gender_pref: 'any',
    lifestyle: {}, interests: [],
  });
  const [photos,    setPhotos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    colocApi.getMyProfile()
      .then(r => {
        const d = r.data;
        setForm({
          profile_type: d.profile_type || 'looking',
          bio: d.bio || '', age: d.age || '', occupation: d.occupation || '', gender: d.gender || '',
          budget_min: d.budget_min || '', budget_max: d.budget_max || '',
          place_zone: d.place_zone || '', place_description: d.place_description || '',
          place_rent_total: d.place_rent_total || '', place_rent_share: d.place_rent_share || '',
          preferred_zones: d.preferred_zones || [], move_in_date: d.move_in_date || '',
          gender_pref: d.gender_pref || 'any',
          lifestyle: d.lifestyle || {}, interests: d.interests || [],
        });
        setPhotos(d.photos || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  /* ── Toggle helpers ── */
  const toggleInterest = (i) => {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(i)
        ? f.interests.filter(x => x !== i)
        : f.interests.length < 8 ? [...f.interests, i] : f.interests,
    }));
  };
  const toggleZone = (z) => {
    setForm(f => ({
      ...f,
      preferred_zones: f.preferred_zones.includes(z)
        ? f.preferred_zones.filter(x => x !== z)
        : [...f.preferred_zones, z],
    }));
  };
  const setLifestyle = (key, val) => {
    setForm(f => ({ ...f, lifestyle: { ...f.lifestyle, [key]: val } }));
  };

  /* ── Photo upload ── */
  const uploadPhoto = (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    data.append('resource_type', 'image');

    const xhr = new XMLHttpRequest();
    xhr.onload = async () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        try {
          const r = await colocApi.addPhoto({
            cloudinary_url: res.secure_url,
            cloudinary_public_id: res.public_id,
            is_cover: photos.length === 0,
          });
          setPhotos(p => [...p, r.data]);
        } catch { setError('Erreur lors de l\'ajout de la photo.'); }
      } else {
        setError(`Erreur upload (${xhr.status}).`);
      }
      setUploading(false);
    };
    xhr.onerror = () => { setUploading(false); setError('Erreur réseau.'); };
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
    xhr.send(data);
  };

  const deletePhoto = async (id) => {
    try { await colocApi.deletePhoto(id); setPhotos(p => p.filter(x => x.id !== id)); } catch {}
  };

  /* ── Save ── */
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age) : null,
        budget_min: parseInt(form.budget_min) || 0,
        budget_max: parseInt(form.budget_max) || 0,
        place_rent_total: parseInt(form.place_rent_total) || 0,
        place_rent_share: parseInt(form.place_rent_share) || 0,
        move_in_date: form.move_in_date || null,
      };
      await colocApi.updateProfile(payload);
      setSaved(true);
      setTimeout(() => navigate('/coloc'), 1200);
    } catch (e) {
      setError(JSON.stringify(e?.response?.data || 'Erreur'));
    } finally { setSaving(false); }
  };

  if (!isLoggedIn) {
    return (
      <div className="coloc-screen">
        <div className="coloc-empty" style={{ paddingTop: 80 }}>
          <h3>Connexion requise</h3>
          <Link to="/login" style={{ color: '#764ba2', fontWeight: 700 }}>Se connecter</Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="coloc-screen"><div className="coloc-empty"><div className="loading-spinner" /></div></div>;

  return (
    <div className="coloc-screen">
      <div className="coloc-header">
        <h1>Mon profil coloc</h1>
        <p>Plus ton profil est complet, meilleurs sont tes matchs</p>
      </div>

      <div className="coloc-setup">

        {/* Type */}
        <div className="setup-step">
          <h3>Je suis…</h3>
          <div className="type-selector">
            <div
              className={`type-card ${form.profile_type === 'looking' ? 'selected' : ''}`}
              onClick={() => set('profile_type', 'looking')}
            >
              <div className="type-card-icon"><Users size={32} strokeWidth={1.5} color="#764ba2" style={{ margin: '0 auto' }} /></div>
              <h4>Je cherche</h4>
              <p>Une coloc à partager</p>
            </div>
            <div
              className={`type-card ${form.profile_type === 'has_place' ? 'selected' : ''}`}
              onClick={() => set('profile_type', 'has_place')}
            >
              <div className="type-card-icon"><Home size={32} strokeWidth={1.5} color="#667eea" style={{ margin: '0 auto' }} /></div>
              <h4>J'ai une place</h4>
              <p>Je cherche un coloc</p>
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="setup-step">
          <h3>Photos</h3>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(e.target.files?.[0])} />
          <div className="chips-wrap" style={{ gap: 10 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: 'relative' }}>
                <img src={p.cloudinary_url} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 12 }} />
                <button
                  onClick={() => deletePhoto(p.id)}
                  style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} />
                </button>
                {p.is_cover && <span style={{ position: 'absolute', bottom: 4, left: 4, background: '#764ba2', color: '#fff', fontSize: '.6rem', padding: '1px 6px', borderRadius: 6 }}>Principale</span>}
              </div>
            ))}
            {photos.length < 6 && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ width: 90, height: 90, border: '2px dashed #ccc', borderRadius: 12, background: '#fafafa', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#999' }}
              >
                <Upload size={22} />
                <span style={{ fontSize: '.7rem' }}>{uploading ? '…' : 'Ajouter'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Infos */}
        <div className="setup-step">
          <h3>À propos de moi</h3>
          <label className="setup-label">Bio</label>
          <textarea className="setup-input" rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Parle un peu de toi, ton style de vie…" />
          <div className="setup-grid">
            <div>
              <label className="setup-label">Âge</label>
              <input className="setup-input" type="number" value={form.age} onChange={e => set('age', e.target.value)} placeholder="24" />
            </div>
            <div>
              <label className="setup-label">Genre</label>
              <select className="setup-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">-- Choisir --</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>
          <label className="setup-label">Occupation</label>
          <input className="setup-input" value={form.occupation} onChange={e => set('occupation', e.target.value)} placeholder="Étudiant, Développeur, Freelance…" />
        </div>

        {/* Budget / Place */}
        {form.profile_type === 'looking' ? (
          <div className="setup-step">
            <h3>Mon budget</h3>
            <div className="setup-grid">
              <div>
                <label className="setup-label">Min (FCFA/mois)</label>
                <input className="setup-input" type="number" value={form.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder="40000" />
              </div>
              <div>
                <label className="setup-label">Max (FCFA/mois)</label>
                <input className="setup-input" type="number" value={form.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder="80000" />
              </div>
            </div>
            <label className="setup-label">Zones préférées</label>
            <div className="chips-wrap">
              {ZONES_ABIDJAN.map(z => (
                <span
                  key={z.value}
                  className={`chip-select ${form.preferred_zones.includes(z.value) ? 'selected' : ''}`}
                  onClick={() => toggleZone(z.value)}
                >
                  {z.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="setup-step">
            <h3>Mon logement</h3>
            <label className="setup-label">Quartier</label>
            <select className="setup-input" value={form.place_zone} onChange={e => set('place_zone', e.target.value)}>
              <option value="">-- Choisir --</option>
              {ZONES_ABIDJAN.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
            <label className="setup-label">Description</label>
            <textarea className="setup-input" rows={2} value={form.place_description} onChange={e => set('place_description', e.target.value)} placeholder="2 chambres, salon, cuisine équipée…" />
            <div className="setup-grid">
              <div>
                <label className="setup-label">Loyer total (FCFA)</label>
                <input className="setup-input" type="number" value={form.place_rent_total} onChange={e => set('place_rent_total', e.target.value)} placeholder="120000" />
              </div>
              <div>
                <label className="setup-label">Part du coloc (FCFA)</label>
                <input className="setup-input" type="number" value={form.place_rent_share} onChange={e => set('place_rent_share', e.target.value)} placeholder="60000" />
              </div>
            </div>
          </div>
        )}

        {/* Préférences */}
        <div className="setup-step">
          <h3>Mes préférences</h3>
          <label className="setup-label">Coloc préféré</label>
          <select className="setup-input" value={form.gender_pref} onChange={e => set('gender_pref', e.target.value)}>
            <option value="any">Peu importe</option>
            <option value="male">Homme</option>
            <option value="female">Femme</option>
          </select>
          <label className="setup-label">Date d'emménagement souhaitée</label>
          <input className="setup-input" type="date" value={form.move_in_date} onChange={e => set('move_in_date', e.target.value)} />
        </div>

        {/* Lifestyle */}
        <div className="setup-step">
          <h3>Style de vie</h3>
          <div className="lifestyle-grid">
            {Object.entries(LIFESTYLE_OPTIONS).map(([key, cfg]) => (
              <div key={key} className="lifestyle-row">
                <label className="setup-label">{cfg.label}</label>
                <div className="lifestyle-opts">
                  {cfg.options.map(o => (
                    <div
                      key={o.v}
                      className={`lifestyle-opt ${form.lifestyle[key] === o.v ? 'selected' : ''}`}
                      onClick={() => setLifestyle(key, o.v)}
                    >
                      {o.l}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intérêts */}
        <div className="setup-step">
          <h3>Centres d'intérêt <span style={{ fontWeight: 400, color: '#999', fontSize: '.8rem' }}>({form.interests.length}/8)</span></h3>
          <div className="chips-wrap">
            {INTERESTS.map(i => (
              <span
                key={i}
                className={`chip-select ${form.interests.includes(i) ? 'selected' : ''}`}
                onClick={() => toggleInterest(i)}
              >
                {i}
              </span>
            ))}
          </div>
        </div>

        {error && <div className="rs-error" style={{ marginBottom: 12 }}>{error}</div>}
        {saved ? (
          <div style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700, padding: 12 }}>Profil enregistré ✓</div>
        ) : (
          <button className="setup-save-btn" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}
          </button>
        )}
      </div>

      {/* Bottom nav */}
      <div className="coloc-bottom-nav">
        <Link to="/coloc" className="coloc-nav-btn"><Heart size={20} /><span>Swipe</span></Link>
        <Link to="/coloc/matches" className="coloc-nav-btn"><MessageCircle size={20} /><span>Matchs</span></Link>
        <Link to="/coloc/setup" className="coloc-nav-btn active"><Settings size={20} /><span>Profil</span></Link>
      </div>
    </div>
  );
}
