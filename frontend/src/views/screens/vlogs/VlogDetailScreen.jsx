import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { vlogsApi, VLOG_CATEGORIES, formatFCFA } from '../../../utils/vlogs';
import { setSEO } from '../../../utils/seo';
import { Heart, MessageCircle, Share2, Bookmark, VolumeX, Volume2, MapPin, User, Eye, ArrowLeft } from 'lucide-react';
import './vlogs.css';

export default function VlogDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const user = useAuthStore(s => s.user);

  const [vlog, setVlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);

  const videoRef = useRef(null);
  const watchStartRef = useRef(Date.now());
  const viewCountedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    vlogsApi.detail(id)
      .then(r => {
        setVlog(r.data);
        setLoading(false);
        setSEO({
          title: r.data.title,
          description: r.data.description?.slice(0, 155),
          image: r.data.thumbnail_url,
          url: `https://babiresi.com/vlogs/${id}`,
          type: 'video.other',
        });
      })
      .catch(() => { setLoading(false); navigate('/vlogs'); });
    vlogsApi.getComments(id).then(r => setComments(r.data)).catch(() => {});
  }, [id]);

  // Track view at 50%
  const handleTimeUpdate = () => {
    if (viewCountedRef.current || !videoRef.current || !vlog) return;
    const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    if (pct >= 50) {
      viewCountedRef.current = true;
      vlogsApi.registerView(vlog.id, Math.round(pct)).catch(() => {});
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn()) return navigate('/login');
    try {
      const res = await vlogsApi.toggleLike(vlog.id);
      setVlog(v => ({ ...v, is_liked: res.data.liked, likes_count: v.likes_count + (res.data.liked ? 1 : -1) }));
    } catch {}
  };

  const handleSave = async () => {
    if (!isLoggedIn()) return navigate('/login');
    try {
      const res = await vlogsApi.toggleSave(vlog.id);
      setVlog(v => ({ ...v, is_saved: res.data.saved, saves_count: v.saves_count + (res.data.saved ? 1 : -1) }));
    } catch {}
  };

  const handleShare = async () => {
    try {
      await vlogsApi.share(vlog.id);
      if (navigator.share) {
        await navigator.share({ title: vlog.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Lien copié !');
      }
    } catch {}
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!isLoggedIn()) return navigate('/login');
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await vlogsApi.postComment(vlog.id, newComment, replyTo?.id || null);
      setComments(prev => replyTo
        ? prev.map(c => c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), res.data] } : c)
        : [res.data, ...prev]
      );
      setNewComment('');
      setReplyTo(null);
      setVlog(v => ({ ...v, comments_count: v.comments_count + 1 }));
    } catch {}
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="vlogs-screen"><div className="loading-spinner" /></div>;
  if (!vlog) return null;

  const catLabel = VLOG_CATEGORIES.find(c => c.value === vlog.category)?.label || vlog.category;

  return (
    <div className="vlog-detail-screen">
      {/* Video player */}
      <div className="vlog-detail-player">
        {vlog.cloudinary_url ? (
          <video
            ref={videoRef}
            src={vlog.cloudinary_url}
            poster={vlog.thumbnail_url || undefined}
            autoPlay
            muted={muted}
            loop
            playsInline
            className="vlog-detail-video"
            onTimeUpdate={handleTimeUpdate}
            onClick={() => { if (playing) videoRef.current?.pause(); else videoRef.current?.play(); setPlaying(!playing); }}
          />
        ) : vlog.thumbnail_url ? (
          <img src={vlog.thumbnail_url} alt={vlog.title} className="vlog-detail-video" />
        ) : (
          <div className="vlog-no-media">Aucun média</div>
        )}

        {/* Player controls overlay */}
        <div className="vlog-player-controls">
          <button onClick={() => navigate(-1)} className="btn-back"><ArrowLeft size={16} /> Retour</button>
          <button onClick={() => setMuted(!muted)} className="btn-mute">
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* Side actions */}
        <div className="vlog-side-actions">
          <button className={`side-action-btn ${vlog.is_liked ? 'active' : ''}`} onClick={handleLike}>
            <Heart size={26} strokeWidth={1.8} fill={vlog.is_liked ? 'currentColor' : 'none'} />
            <span className="side-count">{vlog.likes_count}</span>
          </button>
          <button className="side-action-btn" onClick={() => setShowComments(!showComments)}>
            <MessageCircle size={26} strokeWidth={1.8} />
            <span className="side-count">{vlog.comments_count}</span>
          </button>
          <button className="side-action-btn" onClick={handleShare}>
            <Share2 size={26} strokeWidth={1.8} />
            <span className="side-count">{vlog.shares_count}</span>
          </button>
          <button className={`side-action-btn ${vlog.is_saved ? 'active' : ''}`} onClick={handleSave}>
            <Bookmark size={26} strokeWidth={1.8} fill={vlog.is_saved ? 'currentColor' : 'none'} />
            <span className="side-count">{vlog.saves_count}</span>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="vlog-detail-info">
        <div className="vlog-detail-meta">
          <Link to={`/seller/${vlog.author_id}`} className="vlog-author-link">
            <User size={18} strokeWidth={1.6} className="author-avatar" />
            <span>@{vlog.author_name}</span>
          </Link>
          {catLabel && <span className="vlog-chip">{catLabel}</span>}
          {vlog.region && <span className="vlog-chip"><MapPin size={11} /> {vlog.region}</span>}
        </div>
        <h1 className="vlog-detail-title">{vlog.title}</h1>
        {vlog.description && <p className="vlog-detail-desc">{vlog.description}</p>}
        <div className="vlog-detail-stats">
          <span><Eye size={13} strokeWidth={1.6} /> {vlog.views_count} vues</span>
        </div>
      </div>

      {/* Comments panel */}
      {showComments && (
        <div className="vlog-comments-panel">
          <div className="comments-header">
            <h3>Commentaires ({vlog.comments_count})</h3>
            <button onClick={() => setShowComments(false)}>✕</button>
          </div>

          <form onSubmit={handleComment} className="comment-form">
            {replyTo && (
              <div className="reply-indicator">
                Réponse à {replyTo.author_name}
                <button type="button" onClick={() => setReplyTo(null)}>✕</button>
              </div>
            )}
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={isLoggedIn() ? 'Ajouter un commentaire...' : 'Connecte-toi pour commenter'}
              disabled={!isLoggedIn() || submitting}
              className="comment-input"
            />
            <button type="submit" disabled={!isLoggedIn() || submitting || !newComment.trim()} className="comment-submit">
              Envoyer
            </button>
          </form>

          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <span className="comment-author">@{comment.author_name}</span>
                <p className="comment-text">{comment.message}</p>
                <button className="reply-btn" onClick={() => setReplyTo(comment)}>Répondre</button>
                {comment.replies?.map(reply => (
                  <div key={reply.id} className="comment-reply">
                    <span className="comment-author">@{reply.author_name}</span>
                    <p className="comment-text">{reply.message}</p>
                  </div>
                ))}
              </div>
            ))}
            {comments.length === 0 && <p className="no-comments">Pas encore de commentaires.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
