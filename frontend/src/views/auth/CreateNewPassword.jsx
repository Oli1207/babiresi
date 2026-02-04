import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import apiInstance from '../../utils/axios'
import Swal from 'sweetalert2'
import logoImage from '../../assets/logo.png'
import './login.css'

function CreateNewPassword() {
    const location = useLocation()
    const navigate = useNavigate()

    const [newPassword, setNewPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [otp, setOtp] = useState('')
    const [uidb64, setUidb64] = useState('')
    const [resetToken, setResetToken] = useState('')

    useEffect(() => {
        const query = new URLSearchParams(location.search)
        setOtp(query.get('otp'))
        setUidb64(query.get('uidb64'))
        setResetToken(query.get('reset_token'))
    }, [location])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!newPassword.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Erreur',
                text: 'Veuillez entrer un nouveau mot de passe.',
                position: 'center',
                confirmButtonText: 'OK'
            })
            return
        }

        setIsLoading(true)
        apiInstance
            .post('user/password-reset-confirm/', {
                otp,
                uidb64,
                reset_token: resetToken,
                new_password: newPassword
            })
            .then((res) => {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: res.data?.message || 'Votre mot de passe a été réinitialisé.',
                    position: 'center',
                    confirmButtonText: 'OK'
                })
                navigate('/login')
            })
            .catch((err) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: err.response?.data?.error || 'Échec de la réinitialisation.',
                    position: 'center',
                    confirmButtonText: 'OK'
                })
            })
            .finally(() => setIsLoading(false))
    }

    return (
        <div className="login-container">
            <div className="login-logo">
                <img src={logoImage} alt="Decrou Resi" />
            </div>

            <div className="login-box">
                <h2>Créer un nouveau mot de passe</h2>
                <p className="forgot-intro">
                    Choisissez un mot de passe sécurisé pour accéder à votre compte.
                </p>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="new-password" className="form-label">Nouveau mot de passe</label>
                        <input
                            id="new-password"
                            name="newPassword"
                            type="password"
                            placeholder="Nouveau mot de passe"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input-field"
                            autoComplete="new-password"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Envoi en cours...' : 'Valider'}
                    </button>
                </form>

                <div className="sign-up-prompt">
                    <Link to="/login" className="forgot-back-link">
                        Retour à la connexion
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default CreateNewPassword
