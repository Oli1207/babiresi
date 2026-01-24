import { useEffect } from 'react'
import { logout } from '../../utils/auth' 
import { Link } from 'react-router-dom'

function Logout() {
  useEffect(() => {
    logout()
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: "110px", padding: '0 20px' }}>
      {/* Phrase d'accroche à gauche */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '20px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 'bold' }}>Merci d'être passé !</h1>
        <p style={{ fontSize: '18px', marginTop: '10px' }}>
          Votre session a été fermée. Découvrez de nouvelles opportunités ou connectez-vous à nouveau pour retrouver vos trouvailles préférées.
        </p>
        <Link to="/login" style={{ marginTop: '20px', textDecoration: 'none', color: '#007bff' }}>
          Se reconnecter
        </Link>
      </div>

      {/* Zone de droite avec l'option d'inscription ou connexion */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <h2>Vous souhaitez revenir ?</h2>
        <div style={{ marginBottom: '10px' }}>
          <Link to="/register" style={{ fontSize: '18px', textDecoration: 'none', color: '#007bff' }}>Créer un compte</Link>
        </div>
        <div>
          <Link to="/login" style={{ fontSize: '18px', textDecoration: 'none', color: '#007bff' }}>Se Connecter</Link>
        </div>
      </div>
    </div>
  )
}

export default Logout