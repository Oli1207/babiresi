/**
 * ColocMatchesScreen — Liste des matchs (conversations)
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Settings, Users } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { colocApi } from '../../../utils/coloc';
import logoImage from '../../../assets/logo.png';
import './coloc.css';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return 'maintenant';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  return new Date(ts).toLocaleDateString('fr-CI');
}

export default function ColocMatchesScreen() {
  const user = useAuthStore(s => s.user);
  const isLoggedIn = !!user;
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    colocApi.getMatches()
      .then(r => setMatches(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

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

  return (
    <div className="coloc-screen">
      <div className="coloc-header">
        <Link to="/residences" className="coloc-home-btn" aria-label="Retour à l'app">
          <img src={logoImage} alt="Sostay" />
        </Link>
        <h1>Mes matchs</h1>
        <p>Discute avec tes futurs colocataires</p>
      </div>

      <div className="matches-screen">
        {loading ? (
          <div className="coloc-empty"><div className="loading-spinner" /></div>
        ) : matches.length === 0 ? (
          <div className="coloc-empty">
            <Users size={56} strokeWidth={1} color="#ccc" />
            <h3>Pas encore de match</h3>
            <p>Continue à swiper pour trouver ton colocataire idéal !</p>
            <Link to="/coloc" style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', padding:'10px 24px', borderRadius:10, fontWeight:700, textDecoration:'none', marginTop:8 }}>
              Swiper
            </Link>
          </div>
        ) : (
          matches.map(m => {
            const op = m.other_profile;
            return (
              <Link key={m.id} to={`/coloc/chat/${m.id}`} className="match-item">
                {op?.cover_photo || op?.photo ? (
                  <img src={op.cover_photo || op.photo} alt={op.name} className="match-item-avatar" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="match-item-avatar">{(op?.name || '?')[0].toUpperCase()}</div>
                )}
                <div className="match-item-info">
                  <div className="match-item-name">{op?.name}</div>
                  <div className="match-item-preview">
                    {m.last_message ? m.last_message.content : 'Vous avez matché ! Dis bonjour 👋'}
                  </div>
                </div>
                <div className="match-item-meta">
                  <span className="match-item-time">
                    {timeAgo(m.last_message?.created_at || m.matched_at)}
                  </span>
                  {m.unread_count > 0 && <span className="match-unread">{m.unread_count}</span>}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Bottom nav */}
      <div className="coloc-bottom-nav">
        <Link to="/coloc" className="coloc-nav-btn"><Heart size={20} /><span>Swipe</span></Link>
        <Link to="/coloc/matches" className="coloc-nav-btn active"><MessageCircle size={20} /><span>Matchs</span></Link>
        <Link to="/coloc/setup" className="coloc-nav-btn"><Settings size={20} /><span>Profil</span></Link>
      </div>
    </div>
  );
}
