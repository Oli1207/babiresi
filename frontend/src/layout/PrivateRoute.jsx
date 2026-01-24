// src/routes/PrivateRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

const PrivateRoute = ({ children }) => {
  // ✅ on regarde juste s’il y a des données user dans le store
  const allUserData = useAuthStore((state) => state.allUserData);
  const loggedIn = !!allUserData;

  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
