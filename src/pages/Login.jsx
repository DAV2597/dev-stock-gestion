import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Connexion à Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 2. Récupération du rôle dans Firestore
      // On vérifie par UID (pour les admins) ou par Email (pour les employés créés manuellement)
      let userDoc = await getDoc(doc(db, "users", user.uid));
      let userData = userDoc.data();
      
      if (!userDoc.exists()) {
          const emailDoc = await getDoc(doc(db, "users", email.toLowerCase().trim()));
          userData = emailDoc.data();
      }

      if (userData) {
        // 3. Redirection selon le rôle harmonisé (ajoint sans 'd')
        const role = userData.role;
        if (role === "admin") navigate("/admin");
        else if (role === "ajoint") navigate("/ajoint");
        else if (role === "secretaire") navigate("/secretaire");
        else setError("Rôle non reconnu.");
      } else {
        setError("Profil utilisateur introuvable.");
      }

    } catch (err) {
      console.error(err);
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>DEV <span style={{color: '#3498db'}}>STOCK</span></h1>
        <p style={styles.subtitle}>Connectez-vous à votre session</p>
        
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Adresse Email</label>
            <input 
              type="email" 
              style={styles.input} 
              placeholder="ex: secretaire@boutique.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mot de passe</label>
            <input 
              type="password" 
              style={styles.input} 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Chargement..." : "Se connecter maintenant"}
          </button>
        </form>

        <div style={styles.registerContainer}>
          <p style={styles.registerText}>
            Pas encore de compte ? {" "}
            <Link to="/register" style={styles.registerLink}>
              Créer un compte boutique
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f5f6fa", padding: "20px" },
  card: { background: "white", padding: "40px", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)", width: "100%", maxWidth: "400px" },
  logo: { fontSize: "32px", fontWeight: "800", textAlign: "center", margin: "0 0 10px 0", color: "#2c3e50" },
  subtitle: { textAlign: "center", color: "#7f8c8d", marginBottom: "30px", fontSize: "14px" },
  form: { display: "flex", flexDirection: "column", gap: "20px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "12px", fontWeight: "bold", color: "#34495e", textTransform: "uppercase" },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #dcdde1", fontSize: "15px", outline: "none" },
  button: { padding: "14px", background: "#2c3e50", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "16px", transition: "0.3s" },
  error: { background: "#fab1a0", color: "#e17055", padding: "12px", borderRadius: "8px", fontSize: "13px", textAlign: "center", fontWeight: "600", marginBottom: "15px" },
  registerContainer: { marginTop: "25px", textAlign: "center", borderTop: "1px solid #eee", paddingTop: "20px" },
  registerText: { fontSize: "14px", color: "#7f8c8d" },
  registerLink: { color: "#3498db", textDecoration: "none", fontWeight: "bold" }
};