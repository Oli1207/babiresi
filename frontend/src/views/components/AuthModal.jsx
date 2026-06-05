/**
 * AuthModal — connexion / inscription en modal (sans redirection violente).
 * Appelé par AuthGate. Sur succès → onSuccess() (rejoue l'action en attente).
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { login, register } from '../../utils/auth';
import logoImage from '../../assets/logo.png';
import './AuthModal.css';

export default function AuthModal({ intent, onClose, onSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // champs
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone]       = useState('');
  const [password2, setPassword2] = useState('');

  const submitLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await login(email.trim(), password);
    setLoading(false);
    if (error) { setError("Identifiants incorrects."); return; }
    onSuccess?.();
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    if (password !== password2) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true); setError('');
    const { error } = await register(fullName.trim(), email.trim(), phone.trim(), password, password2);
    setLoading(false);
    if (error) { setError(typeof error === 'string' ? error : "Inscription impossible."); return; }
    onSuccess?.();   // register connecte automatiquement
  };

  return (
    <div className="authm-backdrop" onClick={onClose}>
      <div className="authm-modal" onClick={e => e.stopPropagation()}>
        <button className="authm-close" onClick={onClose}><X size={20} /></button>

        <div className="authm-logo">
          <img src={logoImage} alt="Sostay" />
        </div>

        <h2 className="authm-title">
          {tab === 'login' ? 'Connecte-toi' : 'Crée ton compte'}
        </h2>
        {intent && <p className="authm-intent">{intent}</p>}

        <div className="authm-tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); }}>
            Connexion
          </button>
          <button className={tab === 'signup' ? 'active' : ''} onClick={() => { setTab('signup'); setError(''); }}>
            Inscription
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={submitLogin} className="authm-form">
            <input className="authm-input" type="email" placeholder="Email" value={email}
                   onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            <input className="authm-input" type="password" placeholder="Mot de passe" value={password}
                   onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            {error && <div className="authm-error">{error}</div>}
            <button className="authm-submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitSignup} className="authm-form">
            <input className="authm-input" type="text" placeholder="Nom complet" value={fullName}
                   onChange={e => setFullName(e.target.value)} required />
            <input className="authm-input" type="email" placeholder="Email" value={email}
                   onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            <input className="authm-input" type="tel" placeholder="Téléphone" value={phone}
                   onChange={e => setPhone(e.target.value)} />
            <input className="authm-input" type="password" placeholder="Mot de passe" value={password}
                   onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
            <input className="authm-input" type="password" placeholder="Confirme le mot de passe" value={password2}
                   onChange={e => setPassword2(e.target.value)} autoComplete="new-password" required />
            {error && <div className="authm-error">{error}</div>}
            <button className="authm-submit" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        )}

        <p className="authm-switch">
          {tab === 'login' ? (
            <>Pas encore de compte ? <button onClick={() => { setTab('signup'); setError(''); }}>Inscris-toi</button></>
          ) : (
            <>Déjà un compte ? <button onClick={() => { setTab('login'); setError(''); }}>Connecte-toi</button></>
          )}
        </p>
      </div>
    </div>
  );
}
