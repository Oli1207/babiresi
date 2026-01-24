// src/pages/Auth/Login.jsx (ou équivalent)
import React, {useState, useEffect} from 'react';
import { login } from '../../utils/auth'; 
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth'; 
import Swal from 'sweetalert2';

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
                text: 'Vérifiez vos identifiants'
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
                text: 'Bienvenue !'
            });

            navigate("/");
            resetForm();
            setIsLoading(false);
        }
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            padding: '20px',
            borderRadius: '10px',
        }}>
            <h2 style={{ color: '#004990', marginBottom: '20px' }}>Welcome Back</h2>

            <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '400px' }}>
                <input
                    type='text'
                    name='email'
                    id='email'
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
                    type='password'
                    name='password'
                    id='password'
                    placeholder='Password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        marginBottom: '20px',
                        border: '1px solid #004990',
                        borderRadius: '5px',
                    }}
                />
<div style={{
    width: "100%",
    textAlign: "right",
    marginBottom: "15px"
}}>
    <Link
        to="/forgot-password"
        style={{
            fontSize: "13px",
            color: "#64748B",
            textDecoration: "none",
            cursor: "pointer"
        }}
        onMouseEnter={(e) => e.target.style.color = "#004990"}
        onMouseLeave={(e) => e.target.style.color = "#64748B"}
    >
        Mot de passe oublié ?
    </Link>
</div>

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
                    {isLoading ? 'Loading...' : 'Login'}
                </button>
            </form>
            <div style={{ marginTop: '15px' }}>
                <span style={{ color: '#004990', fontSize: '14px' }}>
                    Vous n'avez pas de compte ?{" "}
                    <Link
                        to="/register"
                        style={{
                            color: '#004990',
                            fontWeight: 'bold',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
                        Créer un compte
                    </Link>
                </span>
            </div>
        </div>
    );
}

export default Login;
