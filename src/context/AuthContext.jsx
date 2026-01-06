import { createContext, useContext, useEffect, useState } from "react";
<<<<<<< HEAD
import { auth, db } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
=======
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
<<<<<<< HEAD
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
=======
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const ref = doc(db, "users", currentUser.uid);
          const snap = await getDoc(ref);
          
          if (snap.exists()) {
            const userData = snap.data();
            // On crée un objet utilisateur "augmenté" avec ses infos Firestore
            setUser({
              uid: currentUser.uid,
              email: currentUser.email,
              adminId: userData.adminId, // ID de la boutique
              shopName: userData.shopName,
              ...userData
            });
            setRole(userData.role);
          } else {
            setUser(currentUser);
          }
        } catch (error) {
          console.error("Erreur AuthContext:", error);
          setUser(currentUser);
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

<<<<<<< HEAD
    return () => unsub();
=======
    return () => unsubscribe();
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

<<<<<<< HEAD
export const useAuth = () => useContext(AuthContext);
=======
export function useAuth() {
  return useContext(AuthContext);
}
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
