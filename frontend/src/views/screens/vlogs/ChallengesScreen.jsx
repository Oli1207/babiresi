import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/auth';
import { useVlogStore } from '../../../store/vlogs';
import { vlogsApi, formatFCFA } from '../../../utils/vlogs';
import './vlogs.css';

export default function ChallengesScreen() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const { challenges, setChallenges } = useVlogStore();
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(null);
  const [myVlogs, setMyVlogs] = useState([]);
  const [selectedVlog, setSelectedVlog] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    vlogsApi.challenges()
      .then(r => setChallenges(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    if (isLoggedIn()) {
      vlogsApi.list({ author: 'me' }).then(r => setMyVlogs(r.data?.results || r.data || [])).catch(() => {});
    }
  }, []);

  const handleEnter = async (challengeId) => {
    if (!isLoggedIn()) { setFeedback('Connecte-toi pour participer.'); return; }
    if (!selectedVlog) { setFeedback('Sélectionne un de tes vlogs.'); return; }
    try {
      await vlogsApi.enterChallenge(challengeId, selectedVlog);
      setFeedback('🎉 Inscrit avec succès !');
      setEntering(null);
      setSelectedVlog('');
    } catch (err) {
      setFeedback(err.response?.data?.detail || 'Erreur.');
    }
  };

  const daysLeft = (endDate) => {
    const diff = new Date(endDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) return <div className="vlogs-screen"><div className="loading-spinner" /></div>;

  return (
    <div className="vlogs-screen">
      <div className="challenges-screen">
        <div className="vlogs-header">
          <h1>🏆 Challenges</h1>
        </div>
        <p className="challenges-subtitle">
          Participe aux challenges pour gagner des points bonus et te faire remarquer !
        </p>

        {feedback && (
          <div className={`form-${feedback.startsWith('🎉') ? 'success' : 'error'}`} style={{ marginBottom: 16 }}>
            {feedback}
            <button onClick={() => setFeedback('')} style={{ marginLeft: 8 }}>✕</button>
          </div>
        )}

        {challenges.length === 0 ? (
          <div className="no-data-card">
            <p>Pas de challenge actif pour le moment.</p>
            <p>Reviens bientôt 👀</p>
          </div>
        ) : (
          <div className="challenges-grid">
            {challenges.map(ch => (
              <div key={ch.id} className="challenge-card">
                {ch.cover_image && <img src={ch.cover_image} alt={ch.title} className="challenge-cover" />}
                <div className="challenge-body">
                  <div className="challenge-meta">
                    <span className="challenge-days">{daysLeft(ch.end_date)}j restants</span>
                    <span className="pts-badge">{formatFCFA(ch.prize_amount_fcfa)}</span>
                  </div>
                  <h3 className="challenge-title">{ch.title}</h3>
                  <p className="challenge-desc">{ch.description}</p>
                  <div className="challenge-footer">
                    <span>{ch.entries_count || 0} participant{ch.entries_count !== 1 ? 's' : ''}</span>
                    {entering === ch.id ? (
                      <div className="enter-form">
                        <select
                          value={selectedVlog}
                          onChange={e => setSelectedVlog(e.target.value)}
                          className="form-input"
                        >
                          <option value="">Choisis un vlog...</option>
                          {myVlogs.map(v => (
                            <option key={v.id} value={v.id}>{v.title}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => handleEnter(ch.id)} className="btn-enter">Participer</button>
                          <button onClick={() => setEntering(null)} className="btn-cancel">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEntering(ch.id)} className="btn-enter">
                        Participer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
