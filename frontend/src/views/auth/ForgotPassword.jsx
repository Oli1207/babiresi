import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import apiInstance from '../../utils/axios'
import Swal from 'sweetalert2'
import logoImage from '../../assets/logo.png'
import './login.css'

function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!email) {
            Swal.fire({
                icon: 'warning',
                title: 'Erreur',
                text: 'Veuillez entrer une adresse email.',
                position: 'center',
                confirmButtonText: 'OK'
            })
            return
        }

        setIsLoading(true)
        apiInstance.post("user/password-reset/", {
    email: email
})

            .then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Un lien de réinitialisation vous a été envoyé par mail.',
                    position: 'center',
                    confirmButtonText: 'OK'
                })
                setEmail('')
            })
            .catch(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: 'Une erreur est survenue. Vérifiez l\'email saisi.',
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
                <h2>Mot de passe oublié</h2>
                <p className="forgot-intro">
                    Entrez l’adresse email de votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="forgot-email" className="form-label">Email</label>
                        <input
                            id="forgot-email"
                            name="email"
                            type="email"
                            placeholder="Entrez votre email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field"
                            autoComplete="email"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Envoi en cours...' : 'Réinitialiser le mot de passe'}
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

export default ForgotPassword
