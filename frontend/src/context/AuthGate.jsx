/**
 * AuthGate — porte d'authentification globale.
 *
 * Usage dans un composant :
 *   const { requireAuth } = useAuthGate();
 *   onClick={() => requireAuth(() => doProtectedThing())}
 *
 * - Si l'utilisateur est connecté → l'action s'exécute immédiatement.
 * - Sinon → un modal de connexion/inscription s'ouvre, et l'action est
 *   mémorisée puis rejouée automatiquement après connexion réussie.
 */
import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import AuthModal from '../views/components/AuthModal';

const AuthGateContext = createContext(null);

export function AuthGateProvider({ children }) {
  const [open, setOpen]   = useState(false);
  const [intent, setIntent] = useState(''); // message contextuel optionnel
  const pendingRef = useRef(null);
  const isLoggedIn = !!useAuthStore(s => s.user);

  const requireAuth = useCallback((action, message = '') => {
    if (isLoggedIn) {
      action?.();
      return true;
    }
    pendingRef.current = typeof action === 'function' ? action : null;
    setIntent(message);
    setOpen(true);
    return false;
  }, [isLoggedIn]);

  const openAuth = useCallback((message = '') => {
    setIntent(message);
    setOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    const action = pendingRef.current;
    pendingRef.current = null;
    // léger délai pour laisser le store se mettre à jour
    if (action) setTimeout(() => { try { action(); } catch {} }, 80);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
  }, []);

  return (
    <AuthGateContext.Provider value={{ requireAuth, openAuth, isLoggedIn }}>
      {children}
      {open && <AuthModal intent={intent} onClose={handleClose} onSuccess={handleSuccess} />}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    // Fallback no-op si jamais utilisé hors provider
    return { requireAuth: (a) => { a?.(); return true; }, openAuth: () => {}, isLoggedIn: false };
  }
  return ctx;
}
