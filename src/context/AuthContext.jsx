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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 1. Chercher d'abord par UID (cas de l'Admin qui s'est enregistré lui-même)
          let userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          let userData = userDoc.data();

          // 2. Si non trouvé par UID, chercher par Email (cas des employés créés manuellement)
          if (!userDoc.exists()) {
            const emailDoc = await getDoc(doc(db, "users", firebaseUser.email.toLowerCase()));
            if (emailDoc.exists()) {
              userData = emailDoc.data();
            }
          }

          if (userData) {
            // On crée un objet utilisateur complet avec les infos Firebase + Firestore
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userData
            });
            setRole(userData.role); // 'admin', 'ajoint' ou 'secretaire'
          } else {
            // Utilisateur connecté mais sans profil Firestore trouvé
            setUser(firebaseUser);
            setRole(null);
          }
        } catch (error) {
          console.error("Erreur AuthContext:", error);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);