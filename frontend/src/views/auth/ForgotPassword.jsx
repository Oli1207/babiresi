import React, { useState } from 'react'
import apiInstance from '../../utils/axios'
import Swal from 'sweetalert2'

function ForgotPassword() {
    const [email, setEmail] = useState("")

    const handleSubmit = () => {
        if (!email) {
            Swal.fire("Erreur", "Veuillez entrer une adresse email.", "warning")
            return
        }

        apiInstance.get(`user/password-reset/${email}`).then((res) => {
            Swal.fire("Succès", "Un lien de réinitialisation vous a été envoyé par mail.", "success")
        }).catch((err) => {
            Swal.fire("Erreur", "Une erreur est survenue. Vérifiez l'email saisi.", "error")
        })
    }

    return (
        <div>
            <h1>Mot de passe oublié</h1>
            <input
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder='Entrez votre email'
                value={email}
            />
            <br />
            <button onClick={handleSubmit}>Réinitialiser le mot de passe</button>
        </div>
    )
}

export default ForgotPassword
