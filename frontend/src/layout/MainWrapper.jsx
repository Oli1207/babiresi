// src/MainWrapper.jsx
import { useEffect, useState } from "react";
import { setUser } from "../utils/auth"; 

const MainWrapper = ({ children }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = async () => {
      setLoading(true);
      await setUser(); // va remplir useAuthStore(allUserData) si le user est loggé
      setLoading(false);
    };
    handler();
  }, []);

  // tu peux mettre un spinner ici si tu veux
  if (loading) return null;

  return <>{children}</>;
};

export default MainWrapper;
