import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/auth';
import { travelApi } from '../../../utils/travel';
import './travel.css';

const STATUS_COLORS = {
  pending: '#f97316', new: '#f97316',
  assigned: '#3b82f6',
  in_progress: '#8b5cf6', negotiating: '#8b5cf6',
  quoted: '#06b6d4',
  confirmed: '#16a34a', paid_deposit: '#16a34a', paid_full: '#059669',
  completed: '#64748b',
  cancelled: '#ef4444',
};

export default function MyTripRequestsScreen() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login'); return; }
    travelApi.myRequests()
      .then(r => setRequests(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="travel-screen"><div className="loading-spinner" /></div>;

  return (
    <div className="travel-screen">
      <div className="travel-header">
        <h1>✈️ {t('travel.myRequests')}</h1>
        <Link to="/voyager" className="btn-create-vlog">+ {t('travel.submit')}</Link>
      </div>

      {requests.length === 0 ? (
        <div className="no-data-card">
          <p>{t('travel.noRequests')}</p>
          <Link to="/voyager" className="btn-submit-trip" style={{ display: 'inline-block', marginTop: 12 }}>
            {t('home.planTrip')}
          </Link>
        </div>
      ) : (
        <div className="requests-list">
          {requests.map(req => {
            const color = STATUS_COLORS[req.status] || '#999';
            const label = t(`travel.status.${req.status}`, { defaultValue: req.status });
            const nights = req.arrival_date && req.departure_date
              ? Math.round((new Date(req.departure_date) - new Date(req.arrival_date)) / 86400000)
              : null;
            return (
              <Link key={req.id} to={`/voyager/ma-demande/${req.id}`} className="request-card">
                <div className="request-card-header">
                  <div>
                    <h3>{req.destination_free_text || "Côte d'Ivoire"}</h3>
                    <p>{req.arrival_date} → {req.departure_date}{nights ? ` (${nights} ${t('common.nights')})` : ''}</p>
                  </div>
                  <span className="status-badge" style={{ background: color + '22', color }}>
                    {label}
                  </span>
                </div>
                <div className="request-card-footer">
                  <span>{req.adults_count + (req.children_count || 0)} {t('common.persons')}</span>
                  {req.quotes_count > 0 && <span>📋 {req.quotes_count} {t('travel.quote.title').toLowerCase()}</span>}
                  {req.has_new_message && <span className="new-msg-badge">💬 {t('notifications.types.message')}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
