/**
 * ColocScreen — Feed de swipe Tinder pour colocataires
 * Swipe droite = like, gauche = pass
 * 15 swipes/jour gratuits
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, X, Info, Users, Home, MessageCircle, Settings } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { colocApi, fmtBudget, ZONES_ABIDJAN } from '../../../utils/coloc';
import { useAuthGate } from '../../../context/AuthGate';
import logoImage from '../../../assets/logo.png';
import './coloc.css';

/* ── Helper ── */
function fmtZones(zones) {
  if (!zones?.length) return '';
  return zones.slice(0, 2).map(z => ZONES_ABIDJAN.find(x => x.value === z)?.label || z).join(', ');
}

/* ── Match Modal ── */
function MatchModal({ match, onChat, onSkip }) {
  return (
    <div className="match-modal-backdrop">
      <div className="match-modal">
        <div className="match-modal-emoji">🎉</div>
        <h2>C'est un match !</h2>
        <p>Vous vous êtes likés mutuellement.<br />Commencez à discuter !</p>
        <button className="btn-match-chat" onClick={onChat}>
          <MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Envoyer un message
        </button>
        <button className="btn-match-later" onClick={onSkip}>Continuer à swiper</button>
      </div>
    </div>
  );
}

/* ── Single Coloc Card (swipeable) ── */
function ColocCard({ profile, onLike, onPass, isTop, stackIndex }) {
  const cardRef    = useRef(null);
  const startRef   = useRef(null);
  const currentRef = useRef({ x: 0, y: 0 });
  const [hint, setHint] = useState(null); // 'like' | 'nope' | null

  const applyTransform = (x, y) => {
    if (!cardRef.current) return;
    const rotate = x * 0.08;
    cardRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
    // hint opacity
    const threshold = 60;
    if (x > threshold) {
      cardRef.current.querySelector('.card-hint-like').style.opacity = Math.min((x - threshold) / 80, 1);
      cardRef.current.querySelector('.card-hint-nope').style.opacity = 0;
    } else if (x < -threshold) {
      cardRef.current.querySelector('.card-hint-nope').style.opacity = Math.min((-x - threshold) / 80, 1);
      cardRef.current.querySelector('.card-hint-like').style.opacity = 0;
    } else {
      cardRef.current.querySelector('.card-hint-like').style.opacity = 0;
      cardRef.current.querySelector('.card-hint-nope').style.opacity = 0;
    }
  };

  const resetTransform = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = 'transform .3s ease';
    cardRef.current.style.transform  = '';
    setTimeout(() => {
      if (cardRef.current) cardRef.current.style.transition = '';
    }, 300);
  };

  const flyOut = (direction) => {
    if (!cardRef.current) return;
    const x = direction === 'like' ? 800 : -800;
    cardRef.current.style.transition = 'transform .35s ease, opacity .35s';
    cardRef.current.style.transform  = `translate(${x}px, 20px) rotate(${direction === 'like' ? 20 : -20}deg)`;
    cardRef.current.style.opacity    = '0';
    setTimeout(() => { direction === 'like' ? onLike() : onPass(); }, 320);
  };

  /* Touch / Mouse handlers */
  const onPointerDown = (e) => {
    if (!isTop) return;
    startRef.current = { x: e.clientX || e.touches?.[0]?.clientX, y: e.clientY || e.touches?.[0]?.clientY };
    if (cardRef.current) cardRef.current.style.transition = '';
  };

  const onPointerMove = (e) => {
    if (!startRef.current || !isTop) return;
    const x = (e.clientX || e.touches?.[0]?.clientX) - startRef.current.x;
    const y = (e.clientY || e.touches?.[0]?.clientY) - startRef.current.y;
    currentRef.current = { x, y };
    applyTransform(x, y);
  };

  const onPointerUp = () => {
    if (!startRef.current) return;
    startRef.current = null;
    const { x } = currentRef.current;
    if (x > 100)       flyOut('like');
    else if (x < -100) flyOut('nope');
    else               resetTransform();
  };

  const coverPhoto = profile.photos?.find(p => p.is_cover)?.cloudinary_url
    || profile.photos?.[0]?.cloudinary_url;

  const stackClass = isTop ? 'card-top' : stackIndex === 1 ? 'card-1' : 'card-2';

  return (
    <div
      ref={cardRef}
      className={`coloc-card ${stackClass}`}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
    >
      {/* Swipe hints */}
      <div className="card-swipe-hint like card-hint-like">LIKE</div>
      <div className="card-swipe-hint nope card-hint-nope">NOPE</div>

      {/* Type badge */}
      <span className={`card-type-badge ${profile.profile_type === 'has_place' ? 'has-place' : ''}`}>
        {profile.profile_type === 'has_place' ? <Home size={11} style={{ marginRight: 3 }} /> : <Users size={11} style={{ marginRight: 3 }} />}
        {profile.profile_type === 'has_place' ? 'A une place' : 'Cherche'}
      </span>

      {/* Compat badge */}
      {profile.compatibility != null && (
        <span className="compat-badge">{profile.compatibility}% compat.</span>
      )}

      {/* Photo */}
      {coverPhoto ? (
        <img src={coverPhoto} alt={profile.user_name} className="coloc-card-photo" draggable="false" />
      ) : (
        <div className="coloc-card-photo-placeholder">
          <Users size={64} strokeWidth={1} color="#ccc" />
        </div>
      )}

      {/* Gradient + info */}
      <div className="coloc-card-gradient" />
      <div className="coloc-card-info">
        <div className="coloc-card-name">
          {profile.user_name}{profile.age ? `, ${profile.age}` : ''}
          {profile.is_verified && ' ✓'}
        </div>
        <div className="coloc-card-meta">
          {profile.occupation && <span>{profile.occupation}</span>}
          <span className="coloc-card-budget">
            {profile.profile_type === 'has_place'
              ? `${Number(profile.place_rent_share).toLocaleString('fr-CI')} FCFA/mois`
              : fmtBudget(profile.budget_min, profile.budget_max)}
          </span>
        </div>
        <div className="coloc-card-tags">
          {profile.profile_type === 'has_place' && profile.place_zone && (
            <span className="coloc-card-tag">
              {ZONES_ABIDJAN.find(z => z.value === profile.place_zone)?.label || profile.place_zone}
            </span>
          )}
          {profile.profile_type === 'looking' && profile.preferred_zones?.slice(0, 2).map(z => (
            <span key={z} className="coloc-card-tag">
              {ZONES_ABIDJAN.find(x => x.value === z)?.label || z}
            </span>
          ))}
          {profile.interests?.slice(0, 3).map(i => (
            <span key={i} className="coloc-card-tag">{i}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Screen ── */
export default function ColocScreen() {
  const user = useAuthStore(s => s.user);
  const isLoggedIn = !!user;
  const { openAuth } = useAuthGate();
  const navigate = useNavigate();

  const [profiles,    setProfiles]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [swipesLeft,  setSwipesLeft]  = useState(null);
  const [isPremium,   setIsPremium]   = useState(false);
  const [freeLimit,   setFreeLimit]   = useState(15);
  const [matchModal,  setMatchModal]  = useState(null); // { matchId }
  const [quotaDone,   setQuotaDone]   = useState(false);
  const [myProfile,   setMyProfile]   = useState(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadFeed();
    colocApi.getMyProfile()
      .then(r => setMyProfile(r.data))
      .catch(() => {});
  }, [isLoggedIn]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const r = await colocApi.getFeed();
      setProfiles(r.data.profiles || []);
      setSwipesLeft(r.data.swipes_left);
      setIsPremium(r.data.is_premium);
      setFreeLimit(r.data.free_limit || 15);
      setQuotaDone(r.data.swipes_left === 0 && !r.data.is_premium);
    } catch {}
    finally { setLoading(false); }
  };

  const swipe = async (liked) => {
    if (!profiles.length) return;
    const target = profiles[0];
    try {
      const r = await colocApi.swipe(target.id, liked);
      setSwipesLeft(r.data.swipes_left);
      if (r.data.quota_exceeded) { setQuotaDone(true); return; }
      if (r.data.matched) setMatchModal({ matchId: r.data.match_id, name: target.user_name });
      setProfiles(prev => prev.slice(1));
    } catch (e) {
      if (e?.response?.status === 429) setQuotaDone(true);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="coloc-screen">
        <div className="coloc-empty" style={{ paddingTop: 80 }}>
          <Users size={56} strokeWidth={1} color="#764ba2" />
          <h3>Trouve ta coloc idéale</h3>
          <p>Connecte-toi pour swiper des profils et trouver ton futur colocataire.</p>
          <button onClick={() => openAuth('Connecte-toi pour trouver ta coloc')} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', border:'none', padding:'12px 28px', borderRadius:12, fontWeight:700, cursor:'pointer', marginTop:8 }}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="coloc-screen">
      {/* Header */}
      <div className="coloc-header">
        <Link to="/carte" className="coloc-home-btn" aria-label="Retour à l'app">
          <img src={logoImage} alt="Sostay" />
        </Link>
        <h1>Coloc</h1>
        <p>Trouve ton futur colocataire à Abidjan</p>
        {swipesLeft !== null && !isPremium && (
          <div className={`swipe-counter ${swipesLeft === 0 ? 'done' : swipesLeft <= 3 ? 'low' : ''}`}>
            <Heart size={12} /> {swipesLeft} / {freeLimit} swipes aujourd'hui
          </div>
        )}
        {isPremium && (
          <div className="swipe-counter">⭐ Premium — swipes illimités</div>
        )}
      </div>

      {/* Quota dépassé */}
      {quotaDone && (
        <div className="coloc-quota-card">
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏰</div>
          <h3>Limite atteinte</h3>
          <p>Tu as utilisé tes {freeLimit} swipes gratuits d'aujourd'hui. Reviens demain ou passe en premium pour swiper sans limite.</p>
          <button className="btn-premium" onClick={() => {}}>
            ⭐ Passer en Premium
          </button>
        </div>
      )}

      {/* Feed */}
      {!quotaDone && (
        <>
          {loading ? (
            <div className="coloc-empty"><div className="loading-spinner" /></div>
          ) : profiles.length === 0 ? (
            <div className="coloc-empty">
              <Users size={56} strokeWidth={1} color="#ccc" />
              <h3>Plus de profils pour l'instant</h3>
              <p>Reviens plus tard ou élargis tes critères dans tes paramètres.</p>
              <button onClick={loadFeed} style={{ background:'#764ba2', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontWeight:700, cursor:'pointer', marginTop:8 }}>
                Recharger
              </button>
            </div>
          ) : (
            <div className="card-stack-wrap">
              {/* Afficher max 3 cartes pour l'effet stack */}
              {profiles.slice(0, 3).reverse().map((p, i) => {
                const realIdx = Math.min(profiles.slice(0, 3).length - 1 - i, 2);
                const isTop   = realIdx === 0;
                return (
                  <ColocCard
                    key={p.id}
                    profile={p}
                    isTop={isTop}
                    stackIndex={realIdx}
                    onLike={() => swipe(true)}
                    onPass={() => swipe(false)}
                  />
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          {!loading && profiles.length > 0 && (
            <div className="coloc-actions">
              <button className="coloc-btn-pass" onClick={() => swipe(false)} title="Passer">
                <X size={28} />
              </button>
              <button className="coloc-btn-info" onClick={() => navigate(`/coloc/profiles/${profiles[0]?.id}`)} title="Voir le profil">
                <Info size={22} />
              </button>
              <button className="coloc-btn-like" onClick={() => swipe(true)} title="Liker">
                <Heart size={30} fill="currentColor" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Match modal */}
      {matchModal && (
        <MatchModal
          match={matchModal}
          onChat={() => { navigate(`/coloc/matches`); setMatchModal(null); }}
          onSkip={() => setMatchModal(null)}
        />
      )}

      {/* Bottom nav */}
      <div className="coloc-bottom-nav">
        <Link to="/coloc" className="coloc-nav-btn active">
          <Heart size={20} />
          <span>Swipe</span>
        </Link>
        <Link to="/coloc/matches" className="coloc-nav-btn">
          <MessageCircle size={20} />
          <span>Matchs</span>
        </Link>
        <Link to="/coloc/setup" className="coloc-nav-btn">
          <Settings size={20} />
          <span>Profil</span>
        </Link>
      </div>
    </div>
  );
}
