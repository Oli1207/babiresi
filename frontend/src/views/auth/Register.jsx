// src/pages/Auth/Register.jsx (ou équivalent)
import React, {useState, useEffect} from 'react'; 
import { register, login } from '../../utils/auth'; 
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth'; 
import Swal from 'sweetalert2';

function Register() {
  const [full_name, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setUser = useAuthStore((state) => state.setUser); // ✅ NEW

  useEffect(() => {
    if(isLoggedIn()){
      navigate("/");
    }
  }, []);

  const resetForm = () => {
    setFullname("");
    setEmail("");
    setMobile("");
    setPassword("");
    setPassword2("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await register(full_name, email, phone, password, password2);

    if (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Vérifiez les informations fournies.'
      });
      setIsLoading(false);
    } else {
      // ✅ inscription OK → on tente un login automatique
      const { error: loginError, data } = await login(email, password);

      if (loginError) {
        // si le login auto foire, au pire l’utilisateur va se connecter manuellement
        Swal.fire({
          icon: 'success',
          title: 'Inscription réussie',
          text: 'Votre compte a bien été créé. Vous pouvez maintenant vous connecter.'
        });
        setIsLoading(false);
        resetForm();
        navigate('/login');
        return;
      }

      // ✅ on met le user dans le store
      if (data?.user) {
        setUser(data.user);
      }

      Swal.fire({
        icon: 'success',
        title: 'Inscription réussie',
        text: 'Votre compte a bien été créé, vous êtes connecté !'
      });

      navigate('/');
      setIsLoading(false);
      resetForm();
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '80vh',
      padding: '20px',
      borderRadius: '10px'
    }}>
      <h2 style={{ color: '#004990', marginBottom: '20px' }}>Créer un compte</h2>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px' }}>
        <input 
          type='text'
          placeholder='Nom et prénoms' 
          value={full_name}
          onChange={(e) => setFullname(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '15px',
            border: '1px solid #004990',
            borderRadius: '5px',
          }}
        />

        <input 
          type='email'
          placeholder='Email' 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '15px',
            border: '1px solid #004990',
            borderRadius: '5px',
          }}
        />

        <input 
          type='number'
          placeholder='Numéro' 
          value={phone}
          onChange={(e) => setMobile(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '15px',
            border: '1px solid #004990',
            borderRadius: '5px',
          }}
        />

        <input 
          type='password'
          placeholder='Mot de passe' 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '15px',
            border: '1px solid #004990',
            borderRadius: '5px',
          }}
        />

        <input 
          type='password'
          placeholder='Confirmez votre mot de passe' 
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            border: '1px solid #004990',
            borderRadius: '5px',
          }}
        />

        <button 
          type='submit'
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#004990',
            border: 'none',
            borderRadius: '5px',
            color: 'white',
            fontSize: '16px',
            cursor: 'pointer'
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Créer un compte'}
        </button>
      </form>

      <div style={{ marginTop: '15px' }}>
        <span style={{ color: '#004990', fontSize: '14px' }}>
          Vous avez déjà un compte ?{" "}
          <Link
            to="/login"
            style={{
              color: '#004990',
              fontWeight: 'bold',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Connectez-vous
          </Link>
        </span>
      </div>
    </div>
  );
}

export default Register;
