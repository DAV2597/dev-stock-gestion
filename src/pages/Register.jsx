import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState(""); // Nouveau : Nom de la boutique
  const navigate = useNavigate();

  // --- LOGIQUE RESPONSIVE ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // LOGIQUE MULTI-BOUTIQUE :
      // Chaque personne qui s'inscrit ici est un ADMIN de sa propre boutique.
      // Son 'adminId' est son propre UID.
      await setDoc(doc(db, "users", user.uid), {
        email: email.toLowerCase(),
        role: "admin", // Tous les nouveaux inscrits sont admins de leur shop
        adminId: user.uid, // C'est l'identifiant unique de sa boutique
        shopName: shopName || "Ma Boutique",
        createdAt: new Date(),
      });

      alert(`Boutique "${shopName}" créée avec succès !`);
      navigate("/");
    } catch (err) {
      alert("Erreur : " + err.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={{
        ...styles.card, 
        width: isMobile ? "90%" : "100%",
        padding: isMobile ? "30px 20px" : "40px"
      }}>
        <h2 style={styles.title}>DEV <span style={{color: '#3498db'}}>STOCK</span></h2>
        
        <form onSubmit={handleRegister} style={styles.form}>
          <label style={styles.label}>Nom du Magasin / Boutique</label>
          <input
            type="text"
            placeholder="ex: Pharmacie du Centre"
            style={styles.input}
            onChange={(e) => setShopName(e.target.value)}
            required
          />

          <label style={styles.label}>Email (Identifiant)</label>
          <input
            type="email"
            placeholder="votre@email.com"
            style={styles.input}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label style={styles.label}>Mot de passe</label>
          <input
            type="password"
            placeholder="Minimum 6 caractères"
            style={styles.input}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <p style={styles.adminNote}>
            En vous inscrivant, vous devenez <b>Administrateur</b> de cet espace de gestion.
          </p>

          <button type="submit" style={styles.button}>Créer mon espace de vente</button>
        </form>

        <p style={styles.footer}>
          Déjà un compte ? <Link to="/" style={styles.link}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#f0f2f5" },
  card: { background: "white", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxWidth: "400px", boxSizing: "border-box" },
  title: { textAlign: "center", marginBottom: "20px", color: "#2c3e50", fontSize: "22px" },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  label: { fontSize: "14px", fontWeight: "bold", color: "#34495e" },
  input: { padding: "12px", borderRadius: "5px", border: "1px solid #ddd", fontSize: "16px", outline: "none" },
  button: { padding: "12px", background: "#2c3e50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" },
  adminNote: { backgroundColor: "#f9f9f9", padding: "10px", borderRadius: "5px", color: "#7f8c8d", fontSize: "12px", textAlign: "center", border: "1px solid #eee" },
  footer: { textAlign: "center", marginTop: "20px", fontSize: "14px" },
  link: { color: "#3498db", textDecoration: "none", fontWeight: "bold" }
};