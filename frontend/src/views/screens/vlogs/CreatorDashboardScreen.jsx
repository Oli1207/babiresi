import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { useVlogStore } from '../../../store/vlogs';
import { vlogsApi, CREATOR_LEVELS, formatPoints, formatFCFA } from '../../../utils/vlogs';
import './vlogs.css';

function LevelBadge({ level }) {
  const info = CREATOR_LEVELS[level] || CREATOR_LEVELS.bronze;
  return (
    <span className="creator-level-badge" style={{ background: info.color + '22', color: info.color, border: `1.5px solid ${info.color}` }}>
      {info.emoji} {info.label}
    </span>
  );
}

function ProgressBar({ current, next, color }) {
  const pct = next > 0 ? Math.min((current / next) * 100, 100) : 100;
  return (
    <div className="level-progress-bar">
      <div className="level-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function CreatorDashboardScreen() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const { creatorStats, setCreatorStats, pointsHistory, setPointsHistory, withdrawals, setWithdrawals } = useVlogStore();
  const [tab, setTab] = useState('overview'); // overview | history | withdraw
  const [loading, setLoading] = useState(true);
  const [withdrawForm, setWithdrawForm] = useState({ amount_points: '', method: 'wave', phone_number: '' });
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { navigate('/login'); return; }
    setLoading(true);
    Promise.all([
      vlogsApi.creatorDashboard(),
      vlogsApi.pointsHistory(),
      vlogsApi.withdrawals(),
    ]).then(([dash, hist, with_]) => {
      setCreatorStats(dash.data);
      setPointsHistory(hist.data);
      setWithdrawals(with_.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');
    const pts = parseInt(withdrawForm.amount_points);
    if (!pts || pts < 100) { setWithdrawError('Minimum 100 points à retirer.'); return; }
    if (!withdrawForm.phone_number.trim()) { setWithdrawError('Numéro de téléphone requis.'); return; }
    setSubmitting(true);
    try {
      const res = await vlogsApi.requestWithdrawal({
        amount_points: pts,
        method: withdrawForm.method,
        phone_number: withdrawForm.phone_number,
      });
      setWithdrawals([res.data, ...withdrawals]);
      setCreatorStats(s => ({
        ...s,
        points: { ...s.points, available_points: s.points.available_points - pts },
      }));
      setWithdrawSuccess(`Demande envoyée ! Tu recevras ${formatFCFA(res.data.amount_fcfa)} sur ton ${withdrawForm.method}.`);
      setWithdrawForm({ amount_points: '', method: 'wave', phone_number: '' });
    } catch (err) {
      setWithdrawError(err.response?.data?.detail || 'Erreur. Réessaie.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="vlogs-screen"><div className="loading-spinner" /></div>;

  const pts = creatorStats?.points;
  const level = pts?.level || 'bronze';
  const levelInfo = CREATOR_LEVELS[level];
  const levels = Object.entries(CREATOR_LEVELS);
  const currentLevelIdx = levels.findIndex(([k]) => k === level);
  const nextLevel = levels[currentLevelIdx + 1];

  const estimatedFCFA = pts ? Math.floor((pts.available_points || 0) * (pts.rate_per_point || 0.3)) : 0;

  return (
    <div className="vlogs-screen">
      <div className="creator-dashboard">
        {/* Header */}
        <div className="creator-header">
          <h1>🎬 Espace Créateur</h1>
          <Link to="/vlogs/create" className="btn-create-vlog">+ Nouveau vlog</Link>
        </div>

        {/* Points card */}
        {pts && (
          <div className="points-card">
            <div className="points-card-top">
              <div>
                <div className="points-main">{formatPoints(pts.total_points)} pts</div>
                <div className="points-available">Disponibles : {formatPoints(pts.available_points)} pts ≈ {formatFCFA(estimatedFCFA)}</div>
              </div>
              <LevelBadge level={level} />
            </div>
            {nextLevel && (
              <div className="level-progress">
                <ProgressBar
                  current={pts.total_points - levelInfo.minPoints}
                  next={nextLevel[1].minPoints - levelInfo.minPoints}
                  color={levelInfo.color}
                />
                <small>{formatPoints(nextLevel[1].minPoints - pts.total_points)} pts avant {nextLevel[1].label} {nextLevel[1].emoji}</small>
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        {creatorStats && (
          <div className="creator-stats-row">
            <div className="creator-stat-card">
              <div className="stat-value">{creatorStats.vlogs_count}</div>
              <div className="stat-label">Vlogs</div>
            </div>
            <div className="creator-stat-card">
              <div className="stat-value">{formatPoints(creatorStats.total_views)}</div>
              <div className="stat-label">Vues</div>
            </div>
            <div className="creator-stat-card">
              <div className="stat-value">{formatPoints(creatorStats.total_likes)}</div>
              <div className="stat-label">Likes</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="vlogs-tabs" style={{ marginTop: 24 }}>
          <button className={`vlog-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Vue d'ensemble</button>
          <button className={`vlog-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Historique</button>
          <button className={`vlog-tab ${tab === 'withdraw' ? 'active' : ''}`} onClick={() => setTab('withdraw')}>Retrait</button>
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="creator-overview">
            <div className="points-breakdown">
              <h3>Gains par action</h3>
              <div className="points-table">
                {[
                  { action: 'Vue (≥50%)', pts: 1 },
                  { action: 'Like', pts: 5 },
                  { action: 'Commentaire', pts: 10 },
                  { action: 'Partage', pts: 15 },
                  { action: 'Sauvegarde', pts: 8 },
                  { action: 'Réservation générée', pts: 500 },
                  { action: 'Featured par admin', pts: 300 },
                  { action: 'Victoire challenge', pts: 1000 },
                ].map(({ action, pts }) => (
                  <div key={action} className="points-row">
                    <span>{action}</span>
                    <span className="pts-badge">+{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="level-rates">
              <h3>Taux de conversion</h3>
              <div className="points-table">
                {Object.entries(CREATOR_LEVELS).map(([k, info]) => (
                  <div key={k} className="points-row">
                    <LevelBadge level={k} />
                    <span>{info.emoji === '🥉' ? '0.3' : info.emoji === '🥈' ? '0.5' : info.emoji === '🥇' ? '0.8' : '1.2'} FCFA/pt</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="points-history">
            {pointsHistory.length === 0 ? (
              <p className="no-data">Pas encore de transactions.</p>
            ) : (
              pointsHistory.map(tx => (
                <div key={tx.id} className={`tx-item ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                  <div className="tx-info">
                    <span className="tx-type">{tx.type}</span>
                    <span className="tx-date">{new Date(tx.created_at).toLocaleDateString('fr-CI')}</span>
                  </div>
                  <span className="tx-amount">{tx.amount > 0 ? '+' : ''}{tx.amount} pts</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'withdraw' && (
          <div className="withdraw-section">
            <div className="withdraw-balance">
              Solde disponible : <strong>{formatPoints(pts?.available_points || 0)} pts</strong> ≈ <strong>{formatFCFA(estimatedFCFA)}</strong>
            </div>

            <form onSubmit={handleWithdraw} className="withdraw-form">
              <div className="form-group">
                <label>Montant en points (min 100)</label>
                <input
                  type="number"
                  min={100}
                  max={pts?.available_points || 0}
                  value={withdrawForm.amount_points}
                  onChange={e => setWithdrawForm(f => ({ ...f, amount_points: e.target.value }))}
                  className="form-input"
                  placeholder="Ex: 500"
                />
                {withdrawForm.amount_points && (
                  <small>≈ {formatFCFA(Math.floor(parseInt(withdrawForm.amount_points || 0) * (pts?.rate_per_point || 0.3)))}</small>
                )}
              </div>
              <div className="form-group">
                <label>Méthode de paiement</label>
                <select value={withdrawForm.method} onChange={e => setWithdrawForm(f => ({ ...f, method: e.target.value }))} className="form-input">
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN MoMo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Numéro de téléphone</label>
                <input
                  type="tel"
                  value={withdrawForm.phone_number}
                  onChange={e => setWithdrawForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="+225 07 00 00 00 00"
                  className="form-input"
                />
              </div>
              {withdrawError && <div className="form-error">{withdrawError}</div>}
              {withdrawSuccess && <div className="form-success">{withdrawSuccess}</div>}
              <button type="submit" disabled={submitting} className="btn-submit-vlog">
                {submitting ? 'Envoi...' : '💸 Demander le retrait'}
              </button>
            </form>

            {withdrawals.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3>Historique des retraits</h3>
                {withdrawals.map(w => (
                  <div key={w.id} className={`tx-item ${w.status === 'paid' ? 'positive' : w.status === 'failed' || w.status === 'rejected' ? 'negative' : ''}`}>
                    <div className="tx-info">
                      <span>{w.method} · {w.phone_number}</span>
                      <span className="tx-date">{new Date(w.created_at).toLocaleDateString('fr-CI')}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>{formatFCFA(w.amount_fcfa)}</div>
                      <span className={`status-chip status-${w.status}`}>{w.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
