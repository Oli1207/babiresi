import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Medal, Clock, Users, Zap, TrendingUp,
  Star, CheckCircle, ChevronRight, Crown,
} from 'lucide-react';
import { useAuthStore } from '../../../store/auth';
import { vlogsApi, formatFCFA, formatPoints } from '../../../utils/vlogs';
import './vlogs.css';

/* ── Helpers ─────────────────────────────────────────────── */
const METRIC_LABELS = {
  vlog_likes:    'Likes sur un vlog',
  total_points:  'Points gagnés',
  vlog_comments: 'Commentaires sur un vlog',
  vlog_views:    'Vues sur un vlog',
  composite:     'Score composite',
};

const METRIC_ICONS = {
  vlog_likes:    <Star    size={14} strokeWidth={1.8} />,
  total_points:  <Zap     size={14} strokeWidth={1.8} />,
  vlog_comments: <Users   size={14} strokeWidth={1.8} />,
  vlog_views:    <TrendingUp size={14} strokeWidth={1.8} />,
  composite:     <Trophy  size={14} strokeWidth={1.8} />,
};

function daysLeft(end) {
  if (!end) return null;
  const diff = new Date(end) - new Date();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = (new Date() - new Date(ts)) / 1000;
  if (diff < 60)   return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return new Date(ts).toLocaleDateString('fr-CI');
}

/* ── Rank medal ──────────────────────────────────────────── */
function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-badge rank-1"><Crown size={13} /> 1er</span>;
  if (rank === 2) return <span className="rank-badge rank-2"><Medal size={13} /> 2ème</span>;
  if (rank === 3) return <span className="rank-badge rank-3"><Medal size={13} /> 3ème</span>;
  return <span className="rank-badge rank-n">#{rank}</span>;
}

/* ── Leaderboard row ─────────────────────────────────────── */
function LeaderRow({ row, rank, threshold, isMe }) {
  const pct = threshold ? Math.min((row.score / threshold) * 100, 100) : null;
  return (
    <div className={`leader-row ${isMe ? 'leader-row-me' : ''} ${row.is_winner ? 'leader-row-winner' : ''}`}>
      <RankBadge rank={rank} />
      <div className="leader-info">
        <span className="leader-name">{row.name}{isMe ? ' (toi)' : ''}</span>
        {row.vlog_count != null && <span className="leader-vlogs">{row.vlog_count} vlog{row.vlog_count !== 1 ? 's' : ''}</span>}
      </div>
      <div className="leader-score-wrap">
        <span className="leader-score">{row.score?.toLocaleString('fr-CI')}</span>
        {pct !== null && (
          <div className="leader-bar">
            <div className="leader-bar-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#f97316' }} />
          </div>
        )}
      </div>
      {row.is_winner && <CheckCircle size={16} className="leader-winner-icon" />}
    </div>
  );
}

/* ── Contest card ────────────────────────────────────────── */
function ContestCard({ contest, userId, onOpen }) {
  const days = daysLeft(contest.end_date);
  const myPos = contest.leaderboard?.findIndex(r => r.user_id === userId);
  const myRank = myPos !== undefined && myPos >= 0 ? myPos + 1 : null;

  const statusColor = {
    active: '#16a34a', extended: '#f97316', ended: '#888', draft: '#aaa',
  }[contest.status] || '#888';

  return (
    <div className="contest-card" onClick={() => onOpen(contest)}>
      {contest.cover_image && (
        <img src={contest.cover_image} alt={contest.title} className="contest-cover" />
      )}
      <div className="contest-card-body">
        {/* Header */}
        <div className="contest-card-header">
          <span className="contest-status-dot" style={{ background: statusColor }} />
          <span className="contest-status-label" style={{ color: statusColor }}>
            {contest.status === 'active' ? 'En cours' :
             contest.status === 'extended' ? 'Prolongé' :
             contest.status === 'ended' ? 'Terminé' : 'Bientôt'}
          </span>
          {days !== null && days > 0 && (
            <span className="contest-days-left"><Clock size={11} /> {days}j</span>
          )}
        </div>

        <h3 className="contest-title">{contest.title}</h3>
        <p className="contest-desc">{contest.description}</p>

        {/* Prize + metric */}
        <div className="contest-meta-row">
          <span className="contest-prize">
            <Trophy size={13} /> {formatFCFA(contest.prize_amount)} × {contest.max_winners}
          </span>
          <span className="contest-metric">
            {METRIC_ICONS[contest.metric_type]}
            {METRIC_LABELS[contest.metric_type]}
          </span>
        </div>

        {/* Rules chips */}
        <div className="contest-chips">
          {contest.threshold && (
            <span className="contest-chip">Objectif : {contest.threshold?.toLocaleString('fr-CI')} {METRIC_LABELS[contest.metric_type]}</span>
          )}
          {contest.min_vlogs_required > 0 && (
            <span className="contest-chip">Min {contest.min_vlogs_required} vlogs</span>
          )}
        </div>

        {/* Mini leaderboard */}
        {contest.leaderboard?.length > 0 && (
          <div className="contest-mini-lb">
            {contest.leaderboard.slice(0, 3).map((row, i) => (
              <div key={row.user_id} className="mini-lb-row">
                <span className="mini-lb-rank">#{i + 1}</span>
                <span className="mini-lb-name">{row.name}</span>
                <span className="mini-lb-score">{row.score?.toLocaleString('fr-CI')}</span>
              </div>
            ))}
          </div>
        )}

        {/* My position */}
        {myRank && (
          <div className="contest-my-pos">
            Tu es #{myRank} actuellement
          </div>
        )}

        {/* Winners */}
        {contest.winners?.length > 0 && (
          <div className="contest-winners">
            {contest.winners.map(w => (
              <div key={w.user_id} className="contest-winner-row">
                <Crown size={13} className="winner-crown" />
                <span>{w.name}</span>
                <span className="winner-score">{w.score?.toLocaleString('fr-CI')}</span>
                <span className={`winner-pay ${w.payout_status === 'paid' ? 'paid' : 'pending'}`}>
                  {w.payout_status === 'paid' ? 'Payé ✓' : 'En attente'}
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="contest-open-btn">
          Voir le classement <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Contest detail modal ────────────────────────────────── */
function ContestDetail({ contest, userId, onClose }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vlogsApi.contestDetail(contest.id)
      .then(r => setFull(r.data))
      .catch(() => setFull(contest))
      .finally(() => setLoading(false));
  }, [contest.id]);

  const c = full || contest;

  return (
    <div className="contest-modal-backdrop" onClick={onClose}>
      <div className="contest-modal" onClick={e => e.stopPropagation()}>
        <div className="contest-modal-header">
          <h2>{c.title}</h2>
          <button className="contest-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="contest-modal-body">
          {loading ? <div className="loading-spinner" /> : (
            <>
              <p className="contest-modal-desc">{c.description}</p>

              {c.rules && (
                <div className="contest-rules">
                  <h4>Règles</h4>
                  <p>{c.rules}</p>
                </div>
              )}

              <div className="contest-modal-meta">
                <div className="cmeta-item">
                  <Trophy size={16} />
                  <span>{formatFCFA(c.prize_amount)} par gagnant × {c.max_winners}</span>
                </div>
                <div className="cmeta-item">
                  {METRIC_ICONS[c.metric_type]}
                  <span>{METRIC_LABELS[c.metric_type]}{c.threshold ? ` → ${c.threshold?.toLocaleString('fr-CI')}` : ''}</span>
                </div>
                {c.min_vlogs_required > 0 && (
                  <div className="cmeta-item">
                    <Star size={16} />
                    <span>Minimum {c.min_vlogs_required} vlogs publiés pendant le concours</span>
                  </div>
                )}
              </div>

              {/* Gagnants */}
              {c.winners?.length > 0 && (
                <div className="contest-modal-section">
                  <h4><Crown size={14} /> Gagnant{c.winners.length > 1 ? 's' : ''}</h4>
                  {c.winners.map(w => (
                    <div key={w.user_id} className="contest-winner-full">
                      <span className="winner-rank">#{w.rank}</span>
                      <span className="winner-name">{w.name}</span>
                      <span className="winner-won">{timeAgo(w.won_at)}</span>
                      <span className={`winner-pay ${w.payout_status === 'paid' ? 'paid' : 'pending'}`}>
                        {w.payout_status === 'paid' ? '✓ Payé' : '⏳ En attente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Classement complet */}
              <div className="contest-modal-section">
                <h4><TrendingUp size={14} /> Classement temps réel</h4>
                {c.leaderboard?.length === 0 ? (
                  <p className="no-data">Pas encore de participants.</p>
                ) : (
                  c.leaderboard?.map((row, i) => (
                    <LeaderRow
                      key={row.user_id}
                      row={row}
                      rank={i + 1}
                      threshold={c.threshold}
                      isMe={row.user_id === userId}
                    />
                  ))
                )}
              </div>

              {/* Position perso */}
              {c.my_position && (
                <div className="contest-my-pos-full">
                  Ta position : #{c.my_position.rank} — {c.my_position.score?.toLocaleString('fr-CI')} {METRIC_LABELS[c.metric_type]}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main screen ─────────────────────────────────────────── */
export default function ChallengesScreen() {
  const user = useAuthStore(s => s.user);
  const [contests, setContests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    vlogsApi.contests()
      .then(r => setContests(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="vlogs-screen"><div className="loading-spinner" /></div>;

  const active  = contests.filter(c => c.status === 'active' || c.status === 'extended');
  const ended   = contests.filter(c => c.status === 'ended');

  return (
    <div className="vlogs-screen">
      <div className="contests-screen">

        <div className="contests-header">
          <Trophy size={28} strokeWidth={1.4} className="contests-header-icon" />
          <div>
            <h1>Concours & Récompenses</h1>
            <p>Poste des vlogs, accumule des likes, gagne des FCFA</p>
          </div>
        </div>

        {/* Info box participation auto */}
        <div className="contests-auto-info">
          <CheckCircle size={16} />
          <span>Tu participes automatiquement à tous les concours actifs dès que tu postes des vlogs.</span>
        </div>

        {/* Concours actifs */}
        {active.length > 0 && (
          <section className="contests-section">
            <h2 className="contests-section-title">En cours</h2>
            <div className="contests-grid">
              {active.map(c => (
                <ContestCard key={c.id} contest={c} userId={user?.user_id} onOpen={setSelected} />
              ))}
            </div>
          </section>
        )}

        {active.length === 0 && (
          <div className="contests-empty">
            <Trophy size={48} strokeWidth={1} color="#ddd" />
            <p>Pas de concours actif pour le moment.</p>
            <p>Reviens bientôt — on prépare quelque chose.</p>
          </div>
        )}

        {/* Concours terminés */}
        {ended.length > 0 && (
          <section className="contests-section">
            <h2 className="contests-section-title">Terminés</h2>
            <div className="contests-grid">
              {ended.map(c => (
                <ContestCard key={c.id} contest={c} userId={user?.user_id} onOpen={setSelected} />
              ))}
            </div>
          </section>
        )}

      </div>

      {/* Detail modal */}
      {selected && (
        <ContestDetail
          contest={selected}
          userId={user?.user_id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
