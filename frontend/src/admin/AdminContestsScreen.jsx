import { useEffect, useState } from 'react';
import { Trophy, Plus, Edit2, Crown, CheckCircle, Clock } from 'lucide-react';
import apiInstance from '../utils/axios';

const METRIC_LABELS = {
  vlog_likes: 'Likes (1 vlog)', total_points: 'Points totaux',
  vlog_comments: 'Commentaires', vlog_views: 'Vues', composite: 'Composite',
};

const STATUS_COLORS = { draft: '#aaa', active: '#16a34a', extended: '#f97316', ended: '#888' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-CI', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── Create/Edit form ──────────────────────────────────────── */
function ContestForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    title: '', description: '', rules: '',
    metric_type: 'vlog_likes', contest_type: 'threshold',
    threshold: 1000, min_vlogs_required: 5,
    max_winners: 2, prize_amount: 50000,
    start_date: '', end_date: '', status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr('');
    try {
      if (initial?.id) {
        await apiInstance.patch(`vlogs/admin/contests/${initial.id}/`, form);
      } else {
        await apiInstance.post('vlogs/admin/contests/', form);
      }
      onSave();
    } catch (e) {
      setErr(JSON.stringify(e?.response?.data || 'Erreur'));
    } finally { setSaving(false); }
  };

  const F = ({ label, name, type = 'text', options }) => (
    <div className="cf-field">
      <label className="cf-label">{label}</label>
      {type === 'textarea' ? (
        <textarea className="cf-input" rows={3} value={form[name] || ''} onChange={e => set(name, e.target.value)} />
      ) : type === 'select' ? (
        <select className="cf-input" value={form[name] || ''} onChange={e => set(name, e.target.value)}>
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input className="cf-input" type={type} value={form[name] ?? ''} onChange={e => set(name, e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="cf-modal-backdrop" onClick={onCancel}>
      <div className="cf-modal" onClick={e => e.stopPropagation()}>
        <div className="cf-modal-header">
          <h3>{initial?.id ? 'Modifier le concours' : 'Nouveau concours'}</h3>
          <button onClick={onCancel}>✕</button>
        </div>
        <div className="cf-modal-body">
          <div className="cf-grid">
            <F label="Titre *" name="title" />
            <F label="Statut" name="status" type="select" options={[
              { v: 'draft', l: 'Brouillon' }, { v: 'active', l: 'Actif' },
              { v: 'extended', l: 'Prolongé' }, { v: 'ended', l: 'Terminé' },
            ]} />
            <F label="Description" name="description" type="textarea" />
            <F label="Règles" name="rules" type="textarea" />
            <F label="Métrique" name="metric_type" type="select" options={
              Object.entries(METRIC_LABELS).map(([v, l]) => ({ v, l }))
            } />
            <F label="Type de concours" name="contest_type" type="select" options={[
              { v: 'threshold', l: 'Seuil (premier à atteindre X)' },
              { v: 'ranking',   l: 'Classement (fin de période)' },
            ]} />
            <F label="Seuil (ex: 1000)" name="threshold" type="number" />
            <F label="Min vlogs requis" name="min_vlogs_required" type="number" />
            <F label="Nb max gagnants" name="max_winners" type="number" />
            <F label="Prize / gagnant (FCFA)" name="prize_amount" type="number" />
            <F label="Date début" name="start_date" type="datetime-local" />
            <F label="Date fin (vide = ouvert)" name="end_date" type="datetime-local" />
          </div>
          {err && <div className="cf-error">{err}</div>}
          <button className="cf-save-btn" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Declare winner panel ─────────────────────────────────── */
function DeclareWinnerPanel({ contestId, leaderboard, onDeclared }) {
  const [userId, setUserId] = useState('');
  const [waveRef, setWaveRef] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const declare = async () => {
    if (!userId) { setMsg('Sélectionne un utilisateur.'); return; }
    setSaving(true);
    try {
      await apiInstance.post(`vlogs/admin/contests/${contestId}/declare-winner/`, {
        user_id: userId, wave_ref: waveRef, payout_amount: amount,
      });
      setMsg('Gagnant déclaré ✓');
      onDeclared();
    } catch (e) {
      setMsg(JSON.stringify(e?.response?.data || 'Erreur'));
    } finally { setSaving(false); }
  };

  return (
    <div className="declare-panel">
      <h4>Déclarer un gagnant</h4>
      <select className="cf-input" value={userId} onChange={e => setUserId(e.target.value)}>
        <option value="">-- Choisir un utilisateur --</option>
        {leaderboard?.map(r => (
          <option key={r.user_id} value={r.user_id}>
            #{leaderboard.indexOf(r) + 1} — {r.name} ({r.score?.toLocaleString('fr-CI')} pts)
          </option>
        ))}
      </select>
      <input className="cf-input" placeholder="Référence Wave" value={waveRef} onChange={e => setWaveRef(e.target.value)} />
      <input className="cf-input" type="number" placeholder="Montant payé (FCFA)" value={amount} onChange={e => setAmount(e.target.value)} />
      <button className="cf-save-btn" onClick={declare} disabled={saving}>{saving ? '…' : 'Déclarer + Notifier'}</button>
      {msg && <p style={{ marginTop: 8, fontSize: '.82rem', color: msg.includes('✓') ? '#16a34a' : '#dc2626' }}>{msg}</p>}
    </div>
  );
}

/* ── Main screen ──────────────────────────────────────────── */
export default function AdminContestsScreen() {
  const [contests, setContests]   = useState([]);
  const [detail,   setDetail]     = useState(null);  // selected contest detail
  const [showForm, setShowForm]   = useState(false);
  const [editing,  setEditing]    = useState(null);
  const [loading,  setLoading]    = useState(true);

  const load = () => {
    setLoading(true);
    apiInstance.get('vlogs/admin/contests/')
      .then(r => setContests(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadDetail = (id) => {
    apiInstance.get(`vlogs/admin/contests/${id}/`).then(r => setDetail(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="admin-section">
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={20} /> Concours & Récompenses
        </h2>
        <button className="admin-btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={15} /> Nouveau concours
        </button>
      </div>

      {loading ? <div className="loading-spinner" /> : (
        <div className="admin-contests-layout">
          {/* Liste */}
          <div className="admin-contest-list">
            {contests.length === 0 && <p className="no-data">Aucun concours créé.</p>}
            {contests.map(c => (
              <div
                key={c.id}
                className={`admin-contest-item ${detail?.id === c.id ? 'selected' : ''}`}
                onClick={() => loadDetail(c.id)}
              >
                <div className="aci-left">
                  <span className="aci-status-dot" style={{ background: STATUS_COLORS[c.status] }} />
                  <div>
                    <strong>{c.title}</strong>
                    <span className="aci-meta">{METRIC_LABELS[c.metric_type]} · {c.winners_count}/{c.max_winners} gagnants · {c.prize_amount?.toLocaleString('fr-CI')} FCFA</span>
                  </div>
                </div>
                <button className="aci-edit-btn" onClick={e => { e.stopPropagation(); setEditing(c); setShowForm(true); }}>
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Détail */}
          {detail && (
            <div className="admin-contest-detail">
              <div className="acd-header">
                <h3>{detail.title}</h3>
                <span className="acd-status" style={{ color: STATUS_COLORS[detail.status] }}>
                  {detail.status}
                </span>
              </div>
              <div className="acd-meta-row">
                <span><Clock size={13} /> {fmtDate(detail.start_date)} → {fmtDate(detail.end_date)}</span>
                <span><Trophy size={13} /> {detail.prize_amount?.toLocaleString('fr-CI')} FCFA × {detail.max_winners}</span>
              </div>

              {/* Gagnants actuels */}
              {detail.winners?.length > 0 && (
                <div className="acd-section">
                  <h4><Crown size={14} /> Gagnants</h4>
                  {detail.winners.map(w => (
                    <div key={w.id} className="acd-winner-row">
                      <span className="acd-rank">#{w.rank}</span>
                      <div className="acd-winner-info">
                        <strong>{w.user__full_name || w.user__email}</strong>
                        <div className="acd-socials">
                          {w.tiktok    && <a href={`https://tiktok.com/@${w.tiktok}`}    target="_blank" rel="noreferrer">TikTok @{w.tiktok}</a>}
                          {w.instagram && <a href={`https://instagram.com/${w.instagram}`} target="_blank" rel="noreferrer">Instagram @{w.instagram}</a>}
                          {w.facebook  && <span>Facebook : {w.facebook}</span>}
                          {w.twitter   && <a href={`https://x.com/${w.twitter}`} target="_blank" rel="noreferrer">X @{w.twitter}</a>}
                          {w.wave      && <span className="acd-wave">Wave : {w.wave}</span>}
                        </div>
                      </div>
                      <span className="acd-score">{w.score?.toLocaleString('fr-CI')}</span>
                      <span className={`acd-pay ${w.payout_status}`}>
                        {w.payout_status === 'paid' ? <><CheckCircle size={13} /> Payé</> : '⏳ En attente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Classement */}
              <div className="acd-section">
                <h4><Trophy size={14} /> Classement ({detail.leaderboard?.length})</h4>
                <div className="acd-leaderboard">
                  {detail.leaderboard?.slice(0, 20).map((r, i) => (
                    <div key={r.user_id} className={`acd-lb-row ${r.is_winner ? 'winner' : ''}`}>
                      <span className="acd-lb-rank">#{i + 1}</span>
                      <span className="acd-lb-name">{r.name}</span>
                      {r.vlog_count != null && <span className="acd-lb-vlogs">{r.vlog_count}v</span>}
                      <span className="acd-lb-score">{r.score?.toLocaleString('fr-CI')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Déclarer gagnant */}
              {detail.status !== 'ended' && detail.winners?.length < detail.max_winners && (
                <DeclareWinnerPanel
                  contestId={detail.id}
                  leaderboard={detail.leaderboard}
                  onDeclared={() => { load(); loadDetail(detail.id); }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <ContestForm
          initial={editing}
          onSave={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
