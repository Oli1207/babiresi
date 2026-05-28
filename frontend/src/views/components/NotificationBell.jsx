import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Home, ClipboardList, MessageCircle, Coins,
  Video, Trophy, CreditCard,
} from 'lucide-react';
import apiInstance from '../../utils/axios';
import './NotificationBell.css';

export default function NotificationBell() {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const load = async () => {
    try {
      const res = await apiInstance.get('notifications/');
      setNotifs(res.data.results || []);
      setUnread(res.data.unread_count || 0);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  // Poll toutes les 30s si l'onglet est visible
  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    try {
      await apiInstance.post('notifications/mark-read/', {});
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
      setUnread(0);
    } catch {}
  };

  const typeIcons = {
    booking:   <Home          size={16} strokeWidth={1.6} />,
    quote:     <ClipboardList size={16} strokeWidth={1.6} />,
    message:   <MessageCircle size={16} strokeWidth={1.6} />,
    points:    <Coins         size={16} strokeWidth={1.6} />,
    vlog:      <Video         size={16} strokeWidth={1.6} />,
    challenge: <Trophy        size={16} strokeWidth={1.6} />,
    payment:   <CreditCard    size={16} strokeWidth={1.6} />,
    system:    <Bell          size={16} strokeWidth={1.6} />,
  };

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button className="notif-bell-btn" onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead(); }}>
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notifications</span>
            {unread > 0 && <button onClick={markAllRead} className="mark-read-btn">Tout lire</button>}
          </div>
          <div className="notif-list">
            {notifs.length === 0 ? (
              <p className="notif-empty">Pas de notifications.</p>
            ) : (
              notifs.map(n => (
                <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                  {n.link ? (
                    <Link to={n.link} className="notif-content" onClick={() => setOpen(false)}>
                      <span className="notif-icon">{typeIcons[n.type] || <Bell size={16} strokeWidth={1.6} />}</span>
                      <div>
                        <p className="notif-title">{n.title}</p>
                        <p className="notif-msg">{n.message}</p>
                        <span className="notif-date">{new Date(n.created_at).toLocaleString('fr-CI')}</span>
                      </div>
                    </Link>
                  ) : (
                    <div className="notif-content">
                      <span className="notif-icon">{typeIcons[n.type] || <Bell size={16} strokeWidth={1.6} />}</span>
                      <div>
                        <p className="notif-title">{n.title}</p>
                        <p className="notif-msg">{n.message}</p>
                        <span className="notif-date">{new Date(n.created_at).toLocaleString('fr-CI')}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
