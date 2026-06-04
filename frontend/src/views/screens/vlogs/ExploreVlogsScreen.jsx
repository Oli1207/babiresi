import { useEffect, useRef, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Compass, Zap, Palette, Home, Star, MapPin, X,
  Heart, MessageCircle, Bookmark, Share2, VolumeX, Volume2,
  Search, Flame, Trash2, SlidersHorizontal, RefreshCw,
  Music, Plus, Film, Video, ArrowLeft, Send,
} from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { useVlogStore } from '../../../store/vlogs';
import { vlogsApi, VLOG_CATEGORIES, REGIONS_CI, AMBIANCES, formatFCFA } from '../../../utils/vlogs';
import { servicesApi } from '../../../utils/services';
import apiInstance from '../../../utils/axios';
import './vlogs.css';

/* ─────────────────────────────────────────────────────────────
   Body scroll lock
───────────────────────────────────────────────────────────── */
function useLockBodyScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
}

/* ─────────────────────────────────────────────────────────────
   Context drawer cards
───────────────────────────────────────────────────────────── */
const TYPE_ICON = {
  guides:     <Compass  size={24} strokeWidth={1.4} color="#aaa" />,
  activities: <Zap      size={24} strokeWidth={1.4} color="#aaa" />,
  artisans:   <Palette  size={24} strokeWidth={1.4} color="#aaa" />,
  listings:   <Home     size={24} strokeWidth={1.4} color="#aaa" />,
};

function DrawerCard({ item, type, onNavigate }) {
  const navigate = useNavigate();

  const getHref = () => {
    if (type === 'guides')     return `/services/guides/${item.id}`;
    if (type === 'activities') return `/services/activities/${item.id}`;
    if (type === 'artisans')   return `/services/artisans/${item.id}`;
    if (type === 'listings')   return `/listing/${item.id}`;
    return '/';
  };

  const thumb = item.cover_image || item.user_photo || item.photo
    || (item.images?.[0]?.image_url) || null;

  const title = item.user_name || item.title || item.name || '—';

  const sub = type === 'guides'
    ? `À partir de ${formatFCFA(item.half_day_price || 0)}`
    : type === 'activities'
    ? `${formatFCFA(item.price_per_person || 0)}/pers.`
    : type === 'artisans'
    ? (item.craft_type || '')
    : type === 'listings'
    ? `${formatFCFA(item.price_per_night || 0)}/nuit`
    : '';

  return (
    <button
      className="ctx-card"
      onClick={() => { onNavigate(); navigate(getHref()); }}
    >
      <div className="ctx-card-img">
        {thumb
          ? <img src={thumb} alt={title} />
          : <span className="ctx-card-placeholder">
              {TYPE_ICON[type] || <Home size={24} strokeWidth={1.4} color="#aaa" />}
            </span>
        }
      </div>
      <div className="ctx-card-info">
        <p className="ctx-card-title">{title}</p>
        <p className="ctx-card-sub">{sub}</p>
        {item.rating_avg && (
          <p className="ctx-card-rating">
            <Star size={11} fill="#f59e0b" color="#f59e0b" />
            {' '}{Number(item.rating_avg).toFixed(1)}
          </p>
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mini-drawer
───────────────────────────────────────────────────────────── */
function ContextDrawer({ data, onClose }) {
  const navigate = useNavigate();
  if (!data) return null;

  const viewAllHref = {
    guides:     '/services?tab=guides',
    activities: '/services?tab=activities',
    artisans:   '/services?tab=artisans',
    listings:   '/',
  }[data.type] || '/';

  return (
    <div className="ctx-drawer open">
      {/* Handle */}
      <div className="ctx-drawer-handle" />

      {/* Header */}
      <div className="ctx-drawer-header">
        <span className="ctx-drawer-icon">{data.icon}</span>
        <div>
          <p className="ctx-drawer-title">{data.label}</p>
          {data.sublabel && (
            <p className="ctx-drawer-sub">
              <MapPin size={11} /> {data.sublabel}
            </p>
          )}
        </div>
        <button className="ctx-drawer-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Cards row */}
      <div className="ctx-cards-row">
        {data.items.map(item => (
          <DrawerCard
            key={item.id}
            item={item}
            type={data.type}
            onNavigate={onClose}
          />
        ))}
      </div>

      {/* View all */}
      <button
        className="ctx-view-all"
        onClick={() => { onClose(); navigate(viewAllHref); }}
      >
        Voir tout → {data.label}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Comments bottom-sheet drawer (TikTok-style inline)
───────────────────────────────────────────────────────────── */
function CommentsDrawer({ vlogId, commentCount, onNewComment, onClose }) {
  const { isLoggedIn } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState('');
  const [posting,  setPosting]  = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    vlogsApi.getComments(vlogId)
      .then(r => setComments(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vlogId]);

  const post = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const r = await vlogsApi.postComment(vlogId, text.trim());
      setComments(c => [r.data, ...c]);
      setText('');
      onNewComment?.();
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
    finally { setPosting(false); }
  };

  return (
    <>
      <div className="cmt-backdrop" onClick={onClose} />
      <div className="cmt-drawer">
        <div className="cmt-handle" />
        <div className="cmt-header">
          <span>{commentCount} commentaire{commentCount !== 1 ? 's' : ''}</span>
          <button className="cmt-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="cmt-list" ref={listRef}>
          {loading ? (
            <p className="cmt-empty">Chargement…</p>
          ) : comments.length === 0 ? (
            <p className="cmt-empty">Sois le premier à commenter ✍️</p>
          ) : comments.map(c => (
            <div key={c.id} className="cmt-item">
              <div className="cmt-avatar">{(c.author_name || c.user?.full_name || '?')[0].toUpperCase()}</div>
              <div className="cmt-body">
                <span className="cmt-author">{c.author_name || c.user?.full_name}</span>
                <p className="cmt-text">{c.message || c.content}</p>
              </div>
            </div>
          ))}
        </div>
        {isLoggedIn ? (
          <div className="cmt-input-row">
            <input
              className="cmt-input"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Ajouter un commentaire…"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && post()}
              maxLength={500}
            />
            <button className="cmt-send" onClick={post} disabled={!text.trim() || posting}>
              <Send size={17} />
            </button>
          </div>
        ) : (
          <p className="cmt-login-hint">Connecte-toi pour commenter</p>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Single TikTok item
───────────────────────────────────────────────────────────── */
function TikTokItem({ vlog, onLike, onSave, isActive }) {
  const videoRef       = useRef(null);
  const fetchedRef     = useRef(false);
  const timersRef      = useRef([]);
  const viewCountedRef = useRef(false);   // ← vue déjà comptée pour ce vlog
  const imageTimerRef  = useRef(null);    // ← timer pour images
  const navigate       = useNavigate();

  /* — playback — */
  const [muted,        setMuted]        = useState(true);
  const [playing,      setPlaying]      = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [cmtCount,     setCmtCount]     = useState(vlog.comments_count || 0);

  /* ── Enregistrer une vue ── */
  const registerView = useCallback((pct = 100) => {
    if (viewCountedRef.current) return;
    viewCountedRef.current = true;
    vlogsApi.registerView(vlog.id, pct).catch(() => {});
  }, [vlog.id]);

  /* ── Vue vidéo : déclenche à 50% du temps écoulé ── */
  const handleTimeUpdate = useCallback(() => {
    if (viewCountedRef.current || !videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    if (!duration) return;
    const pct = (currentTime / duration) * 100;
    if (pct >= 50) registerView(Math.round(pct));
  }, [registerView]);

  /* ── Vue image/no-media : déclenche après 3s d'affichage ── */
  useEffect(() => {
    if (vlog.cloudinary_url) return;   // vidéo gérée par onTimeUpdate
    if (isActive && !viewCountedRef.current) {
      imageTimerRef.current = setTimeout(() => registerView(100), 3000);
    }
    return () => { if (imageTimerRef.current) clearTimeout(imageTimerRef.current); };
  }, [isActive, vlog.cloudinary_url, registerView]);

  /* — context notifications — */
  const [contextItems,  setContextItems]  = useState([]);
  const [notifIdx,      setNotifIdx]      = useState(0);
  const [notifVisible,  setNotifVisible]  = useState(false);
  const [drawerData,    setDrawerData]    = useState(null);

  /* ── auto-play/pause ── */
  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setPlaying(false);
      setNotifVisible(false);
      setDrawerData(null);
    }
  }, [isActive]);

  /* ── tap to play/pause ── */
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else         { videoRef.current.play();  setPlaying(true);  }
  };

  /* ── fetch context services once when first active ── */
  useEffect(() => {
    if (!isActive || fetchedRef.current) return;
    if (!vlog.region && !vlog.city && !vlog.destination_slug) return;
    fetchedRef.current = true;

    const dest  = vlog.destination_slug || null;
    const city  = vlog.city
      || REGIONS_CI.find(r => r.value === vlog.region)?.label
      || '';

    Promise.allSettled([
      dest ? servicesApi.guides({ destination: dest })     : Promise.resolve({ data: [] }),
      dest ? servicesApi.activities({ destination: dest }) : Promise.resolve({ data: [] }),
      dest ? servicesApi.artisans({ destination: dest })   : Promise.resolve({ data: [] }),
      city ? apiInstance.get('listings/', { params: { city, page_size: 5 } })
           : Promise.resolve({ data: { results: [] } }),
    ]).then(([gR, aR, arR, lR]) => {
      const items = [];

      const guides = gR.status === 'fulfilled' ? (gR.value.data || []).slice(0, 5) : [];
      if (guides.length)
        items.push({
          type: 'guides',
          icon: <Compass size={16} strokeWidth={1.6} />,
          label: `${guides.length} guide${guides.length > 1 ? 's' : ''} certifié${guides.length > 1 ? 's' : ''}`,
          sublabel: city, items: guides,
        });

      const activities = aR.status === 'fulfilled' ? (aR.value.data || []).slice(0, 5) : [];
      if (activities.length)
        items.push({
          type: 'activities',
          icon: <Zap size={16} strokeWidth={1.6} />,
          label: `${activities.length} activité${activities.length > 1 ? 's' : ''}`,
          sublabel: city, items: activities,
        });

      const artisans = arR.status === 'fulfilled' ? (arR.value.data || []).slice(0, 5) : [];
      if (artisans.length)
        items.push({
          type: 'artisans',
          icon: <Palette size={16} strokeWidth={1.6} />,
          label: `${artisans.length} artisan${artisans.length > 1 ? 'aux' : ''}`,
          sublabel: city, items: artisans,
        });

      const listingsRaw = lR.status === 'fulfilled'
        ? (lR.value.data?.results || lR.value.data || []).slice(0, 5) : [];
      if (listingsRaw.length) {
        const minPrice = Math.min(...listingsRaw.map(l => l.price_per_night || Infinity));
        items.push({
          type: 'listings',
          icon: <Home size={16} strokeWidth={1.6} />,
          label: `${listingsRaw.length} logement${listingsRaw.length > 1 ? 's' : ''}`,
          sublabel: minPrice < Infinity ? `dès ${formatFCFA(minPrice)}/nuit` : city,
          items: listingsRaw,
        });
      }

      setContextItems(items);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  /* ── notification rotation ── */
  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!isActive || contextItems.length === 0 || drawerData) return;

    let idx = 0;

    const cycle = () => {
      setNotifIdx(idx);
      setNotifVisible(true);

      const hideT = setTimeout(() => {
        setNotifVisible(false);
        idx = (idx + 1) % contextItems.length;
        const gapT = setTimeout(cycle, 2200);
        timersRef.current.push(gapT);
      }, 5000);
      timersRef.current.push(hideT);
    };

    const startT = setTimeout(cycle, 5000);
    timersRef.current.push(startT);

    return () => timersRef.current.forEach(clearTimeout);
  }, [isActive, contextItems, drawerData]);

  /* ── open drawer on notif tap ── */
  const handleNotifTap = () => {
    timersRef.current.forEach(clearTimeout);
    setNotifVisible(false);
    setDrawerData(contextItems[notifIdx]);
  };

  /* ── close drawer → restart rotation ── */
  const closeDrawer = () => { setDrawerData(null); };

  const categoryLabel = VLOG_CATEGORIES.find(c => c.value === vlog.category)?.label || vlog.category;

  return (
    <div className="tt-item">

      {/* ── Video / Thumb ── */}
      {vlog.cloudinary_url ? (
        <video
          ref={videoRef}
          src={vlog.cloudinary_url}
          poster={vlog.thumbnail_url || undefined}
          muted={muted}
          loop
          playsInline
          className="tt-video"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : vlog.thumbnail_url ? (
        <img
          src={vlog.thumbnail_url}
          alt={vlog.title}
          className="tt-video"
          onClick={() => navigate(`/vlogs/${vlog.id}`)}
        />
      ) : (
        <div className="tt-no-media" onClick={() => navigate(`/vlogs/${vlog.id}`)}>
          <Film size={48} strokeWidth={1.2} color="#555" />
        </div>
      )}

      {/* ── Play indicator ── */}
      {!playing && (
        <div className="tt-pause-indicator" onClick={togglePlay}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="white" opacity="0.85">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      )}

      {/* ── Gradients ── */}
      <div className="tt-gradient-top" />
      <div className="tt-gradient-bottom" />

      {/* ─────────────────────────────────────────────────
          CONTEXT NOTIFICATION PILL
      ───────────────────────────────────────────────── */}
      {contextItems[notifIdx] && (
        <button
          className={`ctx-notif ${notifVisible ? 'visible' : ''}`}
          onClick={handleNotifTap}
        >
          <span className="ctx-notif-icon">{contextItems[notifIdx].icon}</span>
          <div className="ctx-notif-text">
            <span className="ctx-notif-label">{contextItems[notifIdx].label}</span>
            {contextItems[notifIdx].sublabel && (
              <span className="ctx-notif-sub"> · {contextItems[notifIdx].sublabel}</span>
            )}
          </div>
          <span className="ctx-notif-arrow">
            <ArrowLeft size={12} style={{ transform: 'rotate(180deg)' }} />
          </span>
          {/* Progress bar */}
          <div className={`ctx-notif-bar ${notifVisible ? 'running' : ''}`} />
        </button>
      )}

      {/* ── Bottom-left info ── */}
      <div className="tt-info">
        <button className="tt-author" onClick={() => navigate(`/vlogs/${vlog.id}`)}>
          @{vlog.author_name}
        </button>
        <h3 className="tt-title" onClick={() => navigate(`/vlogs/${vlog.id}`)}>
          {vlog.title}
        </h3>
        {vlog.description && (
          <p
            className={`tt-desc ${descExpanded ? 'expanded' : ''}`}
            onClick={() => setDescExpanded(d => !d)}
          >
            {descExpanded ? vlog.description : vlog.description.slice(0, 80)}
            {vlog.description.length > 80 && (
              <span className="tt-more">{descExpanded ? ' moins' : '... plus'}</span>
            )}
          </p>
        )}
        <div className="tt-chips">
          {categoryLabel && <span className="tt-chip">{categoryLabel}</span>}
          {vlog.region && (
            <span className="tt-chip">
              <MapPin size={10} /> {vlog.region}
            </span>
          )}
          {vlog.is_featured && (
            <span className="tt-chip tt-chip-gold">
              <Star size={10} fill="currentColor" /> Featured
            </span>
          )}
        </div>
        <div className="tt-sound">
          <Music size={13} className="tt-sound-icon" />
          <span className="tt-sound-text">Babiresi CI &nbsp;·&nbsp; {vlog.author_name}</span>
        </div>
      </div>

      {/* ── Right actions ── */}
      <div className="tt-actions">
        <div className="tt-avatar-wrap">
          <div className="tt-avatar">
            {vlog.author_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="tt-follow-plus">+</div>
        </div>

        <button
          className={`tt-action-btn ${vlog.is_liked ? 'liked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onLike(vlog.id); }}
        >
          <Heart size={26} className="tt-action-icon" strokeWidth={1.8}
            fill={vlog.is_liked ? 'currentColor' : 'none'} />
          <span className="tt-action-count">{vlog.likes_count}</span>
        </button>

        <button className="tt-action-btn" onClick={(e) => { e.stopPropagation(); setShowComments(true); }}>
          <MessageCircle size={26} className="tt-action-icon" strokeWidth={1.8} />
          <span className="tt-action-count">{cmtCount}</span>
        </button>

        <button
          className={`tt-action-btn ${vlog.is_saved ? 'saved' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSave(vlog.id); }}
        >
          <Bookmark size={26} className="tt-action-icon" strokeWidth={1.8}
            fill={vlog.is_saved ? 'currentColor' : 'none'} />
          <span className="tt-action-count">{vlog.saves_count}</span>
        </button>

        <button
          className="tt-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigator.share?.({ title: vlog.title, url: `${window.location.origin}/vlogs/${vlog.id}` });
          }}
        >
          <Share2 size={26} className="tt-action-icon" strokeWidth={1.8} />
        </button>

        <button className="tt-action-btn" onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}>
          {muted
            ? <VolumeX size={26} className="tt-action-icon" strokeWidth={1.8} />
            : <Volume2 size={26} className="tt-action-icon" strokeWidth={1.8} />
          }
        </button>
      </div>

      {/* ─────────────────────────────────────────────────
          CONTEXT MINI-DRAWER
      ───────────────────────────────────────────────── */}
      {drawerData && <ContextDrawer data={drawerData} onClose={closeDrawer} />}

      {/* ─────────────────────────────────────────────────
          COMMENTS BOTTOM DRAWER
      ───────────────────────────────────────────────── */}
      {showComments && (
        <CommentsDrawer
          vlogId={vlog.id}
          commentCount={cmtCount}
          onNewComment={() => setCmtCount(c => c + 1)}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Filter panel (right slide)
───────────────────────────────────────────────────────────── */
function FilterPanel({ filters, setFilters, onClose }) {
  return (
    <>
      <div className="tt-filter-backdrop" onClick={onClose} />
      <div className="tt-filter-panel">
        <div className="tt-filter-header">
          <span>Filtres</span>
          <button className="tt-filter-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="tt-filter-group">
          <label><MapPin size={13} /> Région</label>
          <select
            value={filters.region || ''}
            onChange={e => setFilters({ region: e.target.value })}
            className="tt-filter-select"
          >
            <option value="">Toutes les régions</option>
            {REGIONS_CI.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="tt-filter-group">
          <label><Zap size={13} /> Catégorie</label>
          <select
            value={filters.category || ''}
            onChange={e => setFilters({ category: e.target.value })}
            className="tt-filter-select"
          >
            <option value="">Toutes catégories</option>
            {VLOG_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="tt-filter-group">
          <label><Star size={13} /> Ambiance</label>
          <select
            value={filters.ambiance || ''}
            onChange={e => setFilters({ ambiance: e.target.value })}
            className="tt-filter-select"
          >
            <option value="">Toutes ambiances</option>
            {AMBIANCES.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {(filters.region || filters.category || filters.ambiance) && (
          <button
            className="tt-filter-clear"
            onClick={() => setFilters({ region: '', category: '', ambiance: '' })}
          >
            <Trash2 size={14} /> Effacer tous les filtres
          </button>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Search bar
───────────────────────────────────────────────────────────── */
function SearchBar({ value, onChange, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="tt-search-bar">
      <Search size={15} className="tt-search-icon-inner" />
      <input
        ref={inputRef}
        className="tt-search-input"
        type="text"
        placeholder="Rechercher des vlogs..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button className="tt-search-clear" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
      <button className="tt-search-cancel" onClick={onClose}>Annuler</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────── */
/**
 * Props (all optional — used when launched from the map):
 *   initialVlogId   — scroll to this vlog when feed loads
 *   zoneFilter      — { region, city, destination } pre-applied filters
 *   onClose         — if set, shows a back button to return to the map
 */
export default function ExploreVlogsScreen({ initialVlogId, zoneFilter, onClose } = {}) {
  const {
    feed, appendFeed, setFeed,
    loading, setLoading,
    hasMore, setHasMore,
    page, setPage,
    filters, setFilters,
  } = useVlogStore();

  const [activeTab,    setActiveTab]    = useState('feed');
  const [trending,     setTrending]     = useState([]);
  const [activeIndex,  setActiveIndex]  = useState(0);
  const [showFilters,  setShowFilters]  = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchQ,      setSearchQ]      = useState('');

  const feedRef      = useRef(null);
  const loaderRef    = useRef(null);
  const didJumpRef   = useRef(false);
  const { t }        = useTranslation();

  useLockBodyScroll();

  // Apply zone filter on mount when launched from map
  useEffect(() => {
    if (!zoneFilter) return;
    setFilters(prev => ({
      ...prev,
      region:      zoneFilter.region      || prev.region,
      city:        zoneFilter.city        || prev.city,
      destination: zoneFilter.destination || prev.destination,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load vlogs ── */
  const loadVlogs = useCallback(async (reset = false) => {
    if (loading || (!hasMore && !reset)) return;
    setLoading(true);
    try {
      const params = { page: reset ? 1 : page, ...filters };
      if (searchQ) params.q = searchQ;
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res     = await vlogsApi.list(params);
      const results = res.data.results || res.data;
      const next    = res.data.next;
      if (reset) { setFeed(results); setPage(2); setActiveIndex(0); }
      else       { appendFeed(results); setPage(page + 1); }
      setHasMore(!!next);
    } catch {}
    finally { setLoading(false); }
  }, [loading, hasMore, page, filters, searchQ]);

  useEffect(() => { loadVlogs(true); }, [filters, searchQ]);

  /* ── Scroll to initialVlogId once feed is loaded ── */
  useEffect(() => {
    if (!initialVlogId || didJumpRef.current || feed.length === 0 || loading) return;
    const idx = feed.findIndex(v => v.id === initialVlogId);
    if (idx < 0) return;
    didJumpRef.current = true;
    setActiveIndex(idx);
    requestAnimationFrame(() => {
      const container = feedRef.current;
      if (!container) return;
      container.scrollTop = idx * container.clientHeight;
    });
  }, [feed, loading, initialVlogId]);

  useEffect(() => {
    if (activeTab !== 'trending') return;
    vlogsApi.trending().then(r => setTrending(r.data)).catch(() => {});
  }, [activeTab]);

  /* ── Infinite scroll ── */
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading && hasMore) loadVlogs();
    }, { threshold: 0.1 });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [loadVlogs, loading, hasMore]);

  /* ── Track active item ── */
  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    const onScroll = () => {
      const idx = Math.round(container.scrollTop / container.clientHeight);
      setActiveIndex(idx);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Like / Save ── */
  const handleLike = async (pk) => {
    try {
      const res = await vlogsApi.toggleLike(pk);
      setFeed(feed.map(v => v.id === pk
        ? { ...v, is_liked: res.data.liked, likes_count: v.likes_count + (res.data.liked ? 1 : -1) }
        : v));
    } catch {}
  };

  const handleSave = async (pk) => {
    try {
      const res = await vlogsApi.toggleSave(pk);
      setFeed(feed.map(v => v.id === pk
        ? { ...v, is_saved: res.data.saved, saves_count: v.saves_count + (res.data.saved ? 1 : -1) }
        : v));
    } catch {}
  };

  const displayVlogs      = activeTab === 'trending' ? trending : feed;
  const hasActiveFilters  = !!(filters.region || filters.category || filters.ambiance || searchQ);

  // Zone label shown when launched from map
  const zoneLabel = zoneFilter
    ? (zoneFilter.city || zoneFilter.region || 'Zone')
    : null;

  return (
    <div className="tt-screen">

      {/* ── TOP BAR ── */}
      <div className={`tt-topbar ${showSearch ? 'hidden' : ''}`}>
        {/* Back-to-map button OR logo */}
        {onClose ? (
          <button className="tt-back-map-btn" onClick={onClose} aria-label="Retour à la carte">
            <ArrowLeft size={16} /> Carte
          </button>
        ) : (
          <Link to="/decouvrir" className="tt-logo-btn" aria-label="Menu">
            <span className="tt-logo-icon">B</span>
          </Link>
        )}

        <div className="tt-tab-switcher">
          {zoneLabel ? (
            <span className="tt-zone-label">
              <MapPin size={12} /> {zoneLabel}
            </span>
          ) : (
            <>
              <button
                className={`tt-tab ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => setActiveTab('feed')}
              >
                Récents
              </button>
              <button
                className={`tt-tab ${activeTab === 'trending' ? 'active' : ''}`}
                onClick={() => setActiveTab('trending')}
              >
                <Flame size={13} /> Trending
              </button>
            </>
          )}
        </div>

        <div className="tt-topbar-right">
          <button
            className={`tt-icon-btn ${hasActiveFilters ? 'active-filter' : ''}`}
            onClick={() => { setShowSearch(true); setShowFilters(false); }}
            aria-label="Rechercher"
          >
            <Search size={18} />
            {hasActiveFilters && <span className="tt-filter-dot" />}
          </button>
          {!onClose && (
            <Link to="/vlogs/create" className="tt-icon-btn tt-post-btn" aria-label="Poster">
              <Plus size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* ── SEARCH BAR ── */}
      {showSearch && (
        <div className="tt-search-wrap">
          <SearchBar
            value={searchQ}
            onChange={setSearchQ}
            onClose={() => setShowSearch(false)}
          />
          <button
            className="tt-filter-trigger"
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal size={14} />
            {' '}Filtres{hasActiveFilters ? ' ●' : ''}
          </button>
        </div>
      )}

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* ── FEED ── */}
      <div className="tt-feed" ref={feedRef}>
        {displayVlogs.map((vlog, idx) => (
          <TikTokItem
            key={vlog.id}
            vlog={vlog}
            onLike={handleLike}
            onSave={handleSave}
            isActive={idx === activeIndex}
          />
        ))}

        {loading && (
          <div className="tt-item tt-skeleton">
            <div className="tt-skeleton-pulse" />
          </div>
        )}

        <div ref={loaderRef} style={{ height: 2 }} />

        {!hasMore && displayVlogs.length > 0 && (
          <div className="tt-end">
            <p>Tu as tout vu !</p>
            <button onClick={() => loadVlogs(true)} className="tt-refresh-btn">
              <RefreshCw size={14} /> Recharger
            </button>
          </div>
        )}

        {!loading && displayVlogs.length === 0 && (
          <div className="tt-empty">
            <Film size={48} strokeWidth={1.2} />
            <p>Aucun vlog disponible.</p>
            <Link to="/vlogs/create" className="tt-empty-cta">
              Sois le premier à poster !
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
