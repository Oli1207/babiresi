import React from "react";
import Login from "./Login"; // ton composant Login existant
import "./loginmodal.css";   // un petit style pour l’overlay et la boîte

function LoginModal({ show, onClose }) {
  if (!show) return null; // ne rien afficher si pas actif

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>
          ✖
        </button>
        <Login /> 
      </div>
    </div>
  );
}

export default LoginModal;
