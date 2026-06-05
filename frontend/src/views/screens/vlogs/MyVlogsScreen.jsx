/**
 * MyVlogsScreen — profil vlog de l'utilisateur
 * Onglets : Mes vlogs · Aimés · Enregistrés
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Heart, Bookmark, Eye, Play, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { useAuthGate } from '../../../context/AuthGate';
import { vlogsApi } from '../../../utils/vlogs';
import './vlogs.css';

const TABS = [
  { key: 'mine',  label: 'Mes vlogs', Icon: Video },
  { key: 'liked', label: 'Aimés',     Icon: Heart },
  { key: 'saved', label: 'Enregistrés', Icon: Bookmark },
];

function VlogGridCard({ vlog }) {
  return (
    <Link to={`/vlogs/${vlog.id}`} className="myv-card">
      <div className="myv-thumb">
        {vlog.thumbnail_url
          ? <img src={vlog.thumbnail_url} alt={vlog.title} />
          : <div className="myv-thumb-empty"><Video size={28} strokeWidth={1.2} color="#bbb" /></div>}
        <span className="myv-play"><Play size={14} fill="#fff" /></span>
        <span className="myv-views"><Eye size={11} /> {vlog.views_count}</span>
      </div>
      <p className="myv-title">{vlog.title}</p>
      <div className="myv-stats">
        <span><Heart size={11} /> {vlog.likes_count}</span>
        <span><Bookmark size={11} /> {vlog.saves_count}</span>
      </div>
    </Link>
  );
}

export default function MyVlogsScreen() {
  const navigate = useNavigate();
  const isLoggedIn = !!useAuthStore(s => s.user);
  const { openAuth } = useAuthGate();
  const [tab, setTab]       = useState('mine');
  const [vlogs, setVlogs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    setLoading(true);
    vlogsApi.myActivity(tab)
      .then(r => setVlogs(r.data || []))
      .catch(() => setVlogs([]))
      .finally(() => setLoading(false));
  }, [tab, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="vlogs-screen">
        <div className="myv-empty" style={{ paddingTop: 60 }}>
          <Video size={48} strokeWidth={1} color="#ccc" />
          <h3>Connexion requise</h3>
          <p>Connecte-toi pour voir tes vlogs, tes likes et tes favoris.</p>
          <button className="btn-create-vlog" onClick={() => openAuth('Connecte-toi pour voir ton espace vlog')}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vlogs-screen">
      <div className="myv-wrap">
        <div className="myv-header">
          <h1>Mon espace vlog</h1>
        </div>

        {/* Tabs */}
        <div className="myv-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`myv-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <t.Icon size={15} strokeWidth={1.8} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="myv-empty"><div className="loading-spinner" /></div>
        ) : vlogs.length === 0 ? (
          <div className="myv-empty">
            {tab === 'mine'  && <><Video size={44} strokeWidth={1} color="#ccc" /><p>Tu n'as pas encore posté de vlog.</p><Link to="/vlogs/create" className="btn-create-vlog">Poster mon premier vlog</Link></>}
            {tab === 'liked' && <><Heart size={44} strokeWidth={1} color="#ccc" /><p>Aucun vlog aimé pour l'instant.</p></>}
            {tab === 'saved' && <><Bookmark size={44} strokeWidth={1} color="#ccc" /><p>Aucun vlog enregistré pour l'instant.</p></>}
          </div>
        ) : (
          <div className="myv-grid">
            {vlogs.map(v => <VlogGridCard key={v.id} vlog={v} />)}
          </div>
        )}
      </div>
    </div>
  );
}
