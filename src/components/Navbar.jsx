import { auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>DEV STOCK</div>
      <div style={styles.links}>
        <Link to={`/${role}`} style={styles.link}>Accueil</Link>
        {(role === "admin" || role === "ajoint") && (
          <Link to="/inventory" style={styles.link}>Stock</Link>
        )}
        <Link to="/sales" style={styles.link}>Ventes & Dettes</Link>
        <button onClick={handleLogout} style={styles.logoutBtn}>Déconnexion</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: { display: "flex", justifyContent: "space-between", padding: "1rem 2rem", background: "#2c3e50", color: "white", alignItems: "center" },
  logo: { fontSize: "1.5rem", fontWeight: "bold" },
  links: { display: "flex", gap: "15px" },
  link: { color: "white", textDecoration: "none" },
  logoutBtn: { background: "#e74c3c", color: "white", border: "none", padding: "5px 10px", cursor: "pointer", borderRadius: "4px" }
};