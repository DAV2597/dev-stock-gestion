import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 1. Chercher d'abord par UID (cas de l'Admin)
        let userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        let userData = userDoc.data();

        // 2. Si non trouvé, chercher par Email (cas des employés)
        if (!userDoc.exists()) {
          const emailDoc = await getDoc(doc(db, "users", firebaseUser.email.toLowerCase()));
          userData = emailDoc.data();
        }

        if (userData) {
          setUser({ ...firebaseUser, ...userData });
          setRole(userData.role); // Ici on récupère 'admin', 'ajoint' ou 'secretaire'
        } else {
          setUser(firebaseUser);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);