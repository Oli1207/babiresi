import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import logoImage from '../../assets/logo.png';
import './Navbar.css';

function Navbar() {
  // Souscription à allUserData pour que la navbar se re-rende au logout (setUser(null))
  useAuthStore((state) => state.allUserData);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fermer le menu mobile quand on clique sur un lien
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="navbar-glass">
      <div className="navbar-container">
        {/* Logo / Brand */}
        <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
          <img src={logoImage} alt="Decrou Resi" className="navbar-logo" />
        </Link>

        {/* Menu hamburger pour mobile */}
        <button 
          className="navbar-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={mobileMenuOpen ? 'active' : ''}></span>
          <span className={mobileMenuOpen ? 'active' : ''}></span>
          <span className={mobileMenuOpen ? 'active' : ''}></span>
        </button>

        {/* Navigation links */}
        <div className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link to="/" className="navbar-link" onClick={closeMobileMenu}>
            Accueil
          </Link>
          
          {isLoggedIn() ? (
            <>
              <Link to="/mon-espace" className="navbar-link" onClick={closeMobileMenu}>
                Mon Espace
              </Link>
              <Link to="/create" className="navbar-link" onClick={closeMobileMenu}>
                Publier
              </Link>
              
              {user?.is_owner && (
                <Link to="/owner/inbox" className="navbar-link" onClick={closeMobileMenu}>
                  Mes réservations
                </Link>
              )}
              
              <Link to="/me/bookings" className="navbar-link" onClick={closeMobileMenu}>
                Mes réservations
              </Link>

              {/* User menu */}
              <div className="navbar-user">
                <span className="navbar-user-name">
                  {user?.full_name || user?.email || 'Utilisateur'}
                </span>
                <Link 
                  to="/logout" 
                  className="navbar-logout-btn"
                  onClick={closeMobileMenu}
                >
                  Déconnexion
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link" onClick={closeMobileMenu}>
                Connexion
              </Link>
              <Link to="/register" className="navbar-link navbar-link-primary" onClick={closeMobileMenu}>
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
