import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import apiInstance from '../../utils/axios'
import Swal from 'sweetalert2'

function CreateNewPassword() {
    const location = useLocation()
    const navigate = useNavigate()

    const [newPassword, setNewPassword] = useState("")
    const [otp, setOtp] = useState("")
    const [uidb64, setUidb64] = useState("")
    const [resetToken, setResetToken] = useState("")

    useEffect(() => {
        const query = new URLSearchParams(location.search)
        setOtp(query.get("otp"))
        setUidb64(query.get("uidb64"))
        setResetToken(query.get("reset_token"))
    }, [location])

    const handleSubmit = () => {
        apiInstance.post(`user/password-reset-confirm/`, {
            otp,
            uidb64,
            reset_token: resetToken,
            new_password: newPassword,
        }).then((res) => {
            Swal.fire("Succès", res.data.message, "success")
            navigate('/login')
        }).catch((err) => {
            Swal.fire("Erreur", err.response?.data?.error || "Échec", "error")
        })
    }

    return (
        <div>
            <h2>Créer un nouveau mot de passe</h2>
            <input
                type="password"
                placeholder="Nouveau mot de passe"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
            />
            <br />
            <button onClick={handleSubmit}>Valider</button>
        </div>
    )
}

export default CreateNewPassword
