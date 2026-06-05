/**
 * ColocProfileScreen — Vue détaillée d'un profil coloc
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, Heart, X, Home, Users } from 'lucide-react';
import { colocApi, fmtBudget, ZONES_ABIDJAN, LIFESTYLE_OPTIONS } from '../../../utils/coloc';
import './coloc.css';

function lifestyleLabel(key, val) {
  const cfg = LIFESTYLE_OPTIONS[key];
  if (!cfg) return val;
  return cfg.options.find(o => o.v === val)?.l || val;
}

export default function ColocProfileScreen() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    colocApi.getProfile(profileId)
      .then(r => setProfile(r.data))
      .catch(() => navigate('/coloc'))
      .finally(() => setLoading(false));
  }, [profileId]);

  const swipe = async (liked) => {
    try {
      const r = await colocApi.swipe(profileId, liked);
      if (r.data.matched) navigate('/coloc/matches');
      else navigate('/coloc');
    } catch { navigate('/coloc'); }
  };

  if (loading) return <div className="coloc-screen"><div className="coloc-empty"><div className="loading-spinner" /></div></div>;
  if (!profile) return null;

  const photos = profile.photos || [];

  return (
    <div className="coloc-screen" style={{ paddingBottom: 100 }}>
      {/* Photo carousel */}
      <div style={{ position: 'relative', height: 420, background: '#000' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,.5)', border: 'none', color: '#fff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={20} />
        </button>

        {photos.length > 0 ? (
          <>
            <img src={photos[photoIdx]?.cloudinary_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {photos.length > 1 && (
              <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', gap: 4, padding: '0 16px', zIndex: 5 }}>
                {photos.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,.4)' }} />
                ))}
              </div>
            )}
            {/* Tap zones */}
            <div onClick={() => setPhotoIdx(i => Math.max(0, i - 1))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', cursor: 'pointer' }} />
            <div onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', cursor: 'pointer' }} />
          </>
        ) : (
          <div className="coloc-card-photo-placeholder" style={{ height: '100%' }}>
            <Users size={80} strokeWidth={1} color="#ccc" />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
            {profile.user_name}{profile.age ? `, ${profile.age}` : ''}
          </h1>
          {profile.is_verified && <span style={{ color: '#16a34a' }}>✓</span>}
          {profile.compatibility != null && (
            <span style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: '.8rem', fontWeight: 700 }}>
              {profile.compatibility}% compatible
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: '#666', fontSize: '.88rem', marginBottom: 14 }}>
          {profile.occupation && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Briefcase size={15} /> {profile.occupation}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {profile.profile_type === 'has_place' ? <Home size={15} /> : <Users size={15} />}
            {profile.profile_type === 'has_place' ? 'A une place' : 'Cherche une coloc'}
          </span>
        </div>

        {profile.bio && <p style={{ color: '#444', lineHeight: 1.6, marginBottom: 20 }}>{profile.bio}</p>}

        {/* Budget / Logement */}
        <div className="setup-step" style={{ marginBottom: 16 }}>
          {profile.profile_type === 'has_place' ? (
            <>
              <h3>Le logement</h3>
              {profile.place_zone && <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px' }}><MapPin size={15} color="#764ba2" /> {ZONES_ABIDJAN.find(z => z.value === profile.place_zone)?.label}</p>}
              {profile.place_description && <p style={{ color: '#666', fontSize: '.88rem', margin: '0 0 8px' }}>{profile.place_description}</p>}
              <p style={{ fontWeight: 700, color: '#764ba2' }}>Part demandée : {Number(profile.place_rent_share).toLocaleString('fr-CI')} FCFA/mois</p>
            </>
          ) : (
            <>
              <h3>Recherche</h3>
              <p style={{ fontWeight: 700, color: '#764ba2', margin: '0 0 8px' }}>{fmtBudget(profile.budget_min, profile.budget_max)}</p>
              {profile.preferred_zones?.length > 0 && (
                <div className="chips-wrap">
                  {profile.preferred_zones.map(z => (
                    <span key={z} className="chip-select selected" style={{ cursor: 'default' }}>
                      {ZONES_ABIDJAN.find(x => x.value === z)?.label || z}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Lifestyle */}
        {profile.lifestyle && Object.keys(profile.lifestyle).length > 0 && (
          <div className="setup-step" style={{ marginBottom: 16 }}>
            <h3>Style de vie</h3>
            <div className="chips-wrap">
              {Object.entries(profile.lifestyle).map(([k, v]) => v && (
                <span key={k} className="chip-select" style={{ cursor: 'default' }}>
                  {LIFESTYLE_OPTIONS[k]?.label}: {lifestyleLabel(k, v)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {profile.interests?.length > 0 && (
          <div className="setup-step">
            <h3>Centres d'intérêt</h3>
            <div className="chips-wrap">
              {profile.interests.map(i => (
                <span key={i} className="chip-select selected" style={{ cursor: 'default' }}>{i}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons fixed */}
      <div style={{ position: 'fixed', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 24, zIndex: 50 }}>
        <button className="coloc-btn-pass" onClick={() => swipe(false)}><X size={28} /></button>
        <button className="coloc-btn-like" onClick={() => swipe(true)}><Heart size={30} fill="currentColor" /></button>
      </div>
    </div>
  );
}
