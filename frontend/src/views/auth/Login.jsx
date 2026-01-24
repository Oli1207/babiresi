// src/pages/Auth/Login.jsx (ou équivalent)
import React, {useState, useEffect} from 'react';
import { login } from '../../utils/auth'; 
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth'; 
import Swal from 'sweetalert2';
import './login.css';

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const setUser = useAuthStore((state) => state.setUser); // ✅ NEW

    useEffect(() => {
        if(isLoggedIn()){
            navigate('/');
        }
    });

    const resetForm = () => {
        setEmail(""); 
        setPassword("");
    }

    const handleLogin = async(e) => {
        e.preventDefault();
        setIsLoading(true);

        // ✅ on récupère aussi data
        const { error, data } = await login(email, password);

        if (error) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Vérifiez vos identifiants',
                position: 'center',
                confirmButtonText: 'OK'
            });
            setIsLoading(false);
        } else {
            // ✅ on met le user dans le store
            if (data?.user) {
                setUser(data.user);
            }

            Swal.fire({
                icon: 'success',
                title: 'Connexion réussie',
                text: 'Bienvenue !',
                position: 'center',
                confirmButtonText: 'OK'
            });

            navigate("/");
            resetForm();
            setIsLoading(false);
        }
    }

    return (
        <div className="login-container">
            <div className="login-logo">
                <h2>Babi Resi</h2>
            </div>

            <div className="login-box">
                <h2>Welcome Back</h2>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email</label>
                        <input
                            type='text'
                            name='email'
                            id='email'
                            placeholder='Email'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">Mot de passe</label>
                        <input
                            type='password'
                            name='password'
                            id='password'
                            placeholder='Mot de passe'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                        />
                    </div>

                    <div style={{
                        width: "100%",
                        textAlign: "right",
                        marginBottom: "10px"
                    }}>
                        <Link
                            to="/forgot-password"
                            className="forgot-password"
                        >
                            Mot de passe oublié ?
                        </Link>
                    </div>

                    <button
                        type='submit'
                        className="login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Chargement...' : 'Se connecter'}
                    </button>
                </form>

                <div className="sign-up-prompt">
                    Vous n'avez pas de compte ?{" "}
                    <Link to="/register">
                        Créer un compte
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Login;
