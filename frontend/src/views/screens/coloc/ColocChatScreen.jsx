/**
 * ColocChatScreen — Conversation avec polling (toutes les 4s)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { colocApi } from '../../../utils/coloc';
import './coloc.css';

const POLL_INTERVAL = 4000;

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-CI', { hour: '2-digit', minute: '2-digit' });
}

export default function ColocChatScreen() {
  const { matchId } = useParams();
  const navigate    = useNavigate();
  const user = useAuthStore(s => s.user);
  const isLoggedIn = !!user;

  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [otherName, setOtherName] = useState('');

  const listRef     = useRef(null);
  const lastTsRef   = useRef(null);
  const pollRef     = useRef(null);

  const myId = user?.user_id;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  /* Initial load */
  useEffect(() => {
    if (!isLoggedIn || !matchId) { setLoading(false); return; }
    colocApi.getMessages(matchId)
      .then(r => {
        setMessages(r.data || []);
        if (r.data?.length) lastTsRef.current = r.data[r.data.length - 1].created_at;
        scrollToBottom();
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Récupérer le nom du correspondant via la liste des matchs
    colocApi.getMatches()
      .then(r => {
        const m = (r.data || []).find(x => String(x.id) === String(matchId));
        if (m) setOtherName(m.other_profile?.name || '');
      })
      .catch(() => {});
  }, [matchId, isLoggedIn]);

  /* Polling */
  const poll = useCallback(async () => {
    if (!matchId) return;
    try {
      const r = await colocApi.getMessages(matchId, lastTsRef.current);
      if (r.data?.length) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const fresh = r.data.filter(m => !ids.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        lastTsRef.current = r.data[r.data.length - 1].created_at;
        scrollToBottom();
      }
    } catch {}
  }, [matchId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    pollRef.current = setInterval(() => { if (!document.hidden) poll(); }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [poll, isLoggedIn]);

  /* Send */
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText('');
    try {
      const r = await colocApi.sendMessage(matchId, content);
      setMessages(prev => [...prev, r.data]);
      lastTsRef.current = r.data.created_at;
      scrollToBottom();
    } catch { setText(content); }
    finally { setSending(false); }
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

  return (
    <div className="chat-screen">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={() => navigate('/coloc/matches')}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-avatar">{(otherName || '?')[0].toUpperCase()}</div>
        <div className="chat-header-name">{otherName || 'Conversation'}</div>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={listRef}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Chargement…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <p>Vous avez matché ! 🎉</p>
            <p style={{ fontSize: '.85rem' }}>Envoie le premier message pour briser la glace.</p>
          </div>
        ) : (
          messages.map(m => {
            const mine = m.sender === myId || m.sender_id === myId;
            return (
              <div key={m.id} className={`chat-msg ${mine ? 'mine' : 'theirs'}`}>
                {m.content}
                <div className="chat-msg-time">{fmtTime(m.created_at)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Écris un message…"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
        />
        <button className="chat-send-btn" onClick={send} disabled={!text.trim() || sending}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
