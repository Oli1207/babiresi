import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { travelApi } from '../../../utils/travel';
import { formatFCFA } from '../../../utils/services';
import { generateKitVoyage } from '../../../utils/kitVoyage';
import './travel.css';

function QuoteCard({ quote, onAccept, onReject }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`quote-card ${quote.status === 'accepted' ? 'accepted' : ''}`}>
      <div className="quote-card-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3>Devis v{quote.version_number}</h3>
          <p>{quote.agency_name || 'Babiresi Voyages'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="quote-total">{formatFCFA(quote.total_price)}</div>
          <span className={`status-chip status-${quote.status}`}>{quote.status}</span>
        </div>
      </div>
      {expanded && (
        <div className="quote-body">
          {quote.line_items?.map((item, i) => (
            <div key={i} className="quote-line">
              <span>{item.label}</span>
              <span>{formatFCFA(item.unit_price)}</span>
            </div>
          ))}
          {quote.summary && <p className="quote-summary">{quote.summary}</p>}
          {quote.consultant_notes && (
            <div className="quote-notes">💡 <em>{quote.consultant_notes}</em></div>
          )}
          {quote.status === 'sent' && (
            <div className="quote-actions">
              <button onClick={() => onAccept(quote.id)} className="btn-accept-quote">✅ Accepter ce devis</button>
              <button onClick={() => onReject(quote.id)} className="btn-reject-quote">❌ Refuser</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TripRoomPanel({ requestPk }) {
  const [messages, setMessages] = useState([]);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      travelApi.tripRoom(requestPk),
      travelApi.tripRoomMessages(requestPk),
    ]).then(([r, m]) => {
      setRoom(r.data);
      setMessages(m.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [requestPk]);

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="trip-room">
      {room?.itinerary && (
        <div className="trip-room-section">
          <h4>📅 Itinéraire</h4>
          <pre className="trip-room-json">{JSON.stringify(room.itinerary, null, 2)}</pre>
        </div>
      )}
      <div className="trip-room-section">
        <h4>💬 Messages ({messages.length})</h4>
        <div className="messages-list">
          {messages.length === 0 ? (
            <p className="no-data">Pas encore de messages.</p>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`message-item ${m.sender_type}`}>
                <span className="message-sender">{m.sender_name}</span>
                <p className="message-text">{m.message}</p>
                <span className="message-date">{new Date(m.created_at).toLocaleString('fr-CI')}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function TripRequestDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const [request, setRequest] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [paySchedule, setPaySchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quotes');
  const [generatingKit, setGeneratingKit] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login'); return; }
    setLoading(true);
    Promise.all([
      travelApi.requestDetail(id),
      travelApi.quoteVersions(id).catch(() => ({ data: [] })),
      travelApi.paymentSchedule(id).catch(() => ({ data: null })),
    ]).then(([req, q, pay]) => {
      setRequest(req.data);
      setQuotes(q.data.results || q.data || []);
      setPaySchedule(pay.data);
    }).catch(() => navigate('/voyager/mes-voyages'))
    .finally(() => setLoading(false));
  }, [id]);

  const handleAccept = async (quoteId) => {
    try {
      await travelApi.acceptQuote(quoteId);
      setQuotes(qs => qs.map(q => q.id === quoteId ? { ...q, status: 'accepted' } : { ...q, status: q.status === 'sent' ? 'superseded' : q.status }));
      const pay = await travelApi.paymentSchedule(id);
      setPaySchedule(pay.data);
    } catch {}
  };

  const handleReject = async (quoteId) => {
    try {
      await travelApi.rejectQuote(quoteId);
      setQuotes(qs => qs.map(q => q.id === quoteId ? { ...q, status: 'rejected' } : q));
    } catch {}
  };

  const handleDownloadKit = () => {
    setGeneratingKit(true);
    const acceptedQuote = quotes.find(q => q.status === 'accepted') || null;
    try {
      generateKitVoyage({ request, quote: acceptedQuote });
    } finally {
      setGeneratingKit(false);
    }
  };

  const handlePayDeposit = async () => {
    try {
      const res = await travelApi.payDeposit(id);
      if (res.data?.authorization_url) window.location.href = res.data.authorization_url;
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur paiement.');
    }
  };

  if (loading) return <div className="travel-screen"><div className="loading-spinner" /></div>;
  if (!request) return null;

  const hasAccepted = quotes.some(q => q.status === 'accepted');

  return (
    <div className="travel-screen">
      <button onClick={() => navigate('/voyager/mes-voyages')} className="btn-back-service">← Mes voyages</button>

      {/* Request header */}
      <div className="request-detail-header">
        <h1>{request.destination_free_text || 'Côte d\'Ivoire'}</h1>
        <div className="request-meta">
          <span>📅 {request.arrival_date} → {request.departure_date}</span>
          <span>👥 {request.adults_count} adulte(s)</span>
          {request.consultant_name && <span>🧭 Conseiller : {request.consultant_name}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="vlogs-tabs" style={{ marginBottom: 20 }}>
        <button className={`vlog-tab ${activeTab === 'quotes' ? 'active' : ''}`} onClick={() => setActiveTab('quotes')}>
          Devis ({quotes.length})
        </button>
        <button className={`vlog-tab ${activeTab === 'triproom' ? 'active' : ''}`} onClick={() => setActiveTab('triproom')}>
          Trip Room
        </button>
        {hasAccepted && paySchedule && (
          <button className={`vlog-tab ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>
            Paiement
          </button>
        )}
        <button className={`vlog-tab ${activeTab === 'kit' ? 'active' : ''}`} onClick={() => setActiveTab('kit')}>
          📋 Kit Voyage
        </button>
      </div>

      {activeTab === 'quotes' && (
        <div>
          {quotes.length === 0 ? (
            <div className="no-data-card">
              <p>Votre conseiller prépare votre devis...</p>
              <p>Délai habituel : 24-48h 🕐</p>
            </div>
          ) : (
            quotes.map(q => (
              <QuoteCard key={q.id} quote={q} onAccept={handleAccept} onReject={handleReject} />
            ))
          )}
        </div>
      )}

      {activeTab === 'triproom' && (
        <TripRoomPanel requestPk={id} />
      )}

      {activeTab === 'kit' && (
        <div className="kit-voyage-panel">
          <div className="kit-voyage-card">
            <div className="kit-voyage-icon">📋</div>
            <h2>Kit Voyage Personnalisé</h2>
            <p>
              Un document PDF complet généré à partir de votre profil : formalités administratives,
              vaccins, monnaie, transport, sécurité, codes culturels et contacts d'urgence.
            </p>
            <ul className="kit-checklist">
              <li>✅ Formalités & Visa selon votre nationalité</li>
              <li>✅ Vaccins obligatoires et recommandés</li>
              <li>✅ Budget estimatif et infos monétaires</li>
              <li>✅ Transport Abidjan et inter-villes</li>
              <li>✅ SIM locale et connectivité</li>
              <li>✅ Sécurité et codes culturels</li>
              <li>✅ Contacts d'urgence et ambassades</li>
            </ul>
            <button
              onClick={handleDownloadKit}
              disabled={generatingKit}
              className="btn-submit-trip"
              style={{ marginTop: 16 }}
            >
              {generatingKit ? '⏳ Génération...' : '⬇️ Télécharger mon Kit Voyage (PDF)'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'payment' && paySchedule && (
        <div className="payment-schedule">
          <h2>Planning de paiement</h2>
          <div className="payment-card">
            <div className="payment-row">
              <div>
                <h4>Acompte (30%)</h4>
                <p>Dû le {paySchedule.deposit_due_date}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="payment-amount">{formatFCFA(paySchedule.deposit_amount)}</div>
                {paySchedule.deposit_status === 'paid' ? (
                  <span className="status-chip status-paid">✅ Payé</span>
                ) : (
                  <button onClick={handlePayDeposit} className="btn-pay">Payer l'acompte</button>
                )}
              </div>
            </div>
            <div className="payment-row">
              <div>
                <h4>Solde (70%)</h4>
                <p>Dû le {paySchedule.balance_due_date}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="payment-amount">{formatFCFA(paySchedule.balance_amount)}</div>
                {paySchedule.balance_status === 'paid' ? (
                  <span className="status-chip status-paid">✅ Payé</span>
                ) : (
                  <span className="status-chip status-pending">En attente</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
