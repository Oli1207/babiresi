// src/pages/Auth/Register.jsx (ou équivalent)
import React, {useState, useEffect} from 'react'; 
import { register, login } from '../../utils/auth'; 
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth'; 
import Swal from 'sweetalert2';
import logoImage from '../../assets/logo.png';
import './login.css';

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
        text: 'Vérifiez les informations fournies.',
        position: 'center',
        confirmButtonText: 'OK'
      });
      setIsLoading(false);
    } else {
      // ✅ inscription OK → on tente un login automatique
      const { error: loginError, data } = await login(email, password);

      if (loginError) {
        // si le login auto foire, au pire l'utilisateur va se connecter manuellement
        Swal.fire({
          icon: 'success',
          title: 'Inscription réussie',
          text: 'Votre compte a bien été créé. Vous pouvez maintenant vous connecter.',
          position: 'center',
          confirmButtonText: 'OK'
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
        text: 'Votre compte a bien été créé, vous êtes connecté !',
        position: 'center',
        confirmButtonText: 'OK'
      });

      navigate('/');
      setIsLoading(false);
      resetForm();
    }
  };

  return (
    <div className="login-container">
      <div className="login-logo">
        <img src={logoImage} alt="Babi Resi" />
      </div>

      <div className="login-box">
        <h2>Créer un compte</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="full_name" className="form-label">Nom et prénoms</label>
            <input 
              type='text'
              id='full_name'
              placeholder='Nom et prénoms' 
              value={full_name}
              onChange={(e) => setFullname(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input 
              type='email'
              id='email'
              placeholder='Email' 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">Numéro de téléphone</label>
            <input 
              type='number'
              id='phone'
              placeholder='Numéro' 
              value={phone}
              onChange={(e) => setMobile(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Mot de passe</label>
            <input 
              type='password'
              id='password'
              placeholder='Mot de passe' 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password2" className="form-label">Confirmez votre mot de passe</label>
            <input 
              type='password'
              id='password2'
              placeholder='Confirmez votre mot de passe' 
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="input-field"
            />
          </div>

          <button 
            type='submit'
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Chargement...' : 'Créer un compte'}
          </button>
        </form>

        <div className="sign-up-prompt">
          Vous avez déjà un compte ?{" "}
          <Link to="/login">
            Connectez-vous
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
