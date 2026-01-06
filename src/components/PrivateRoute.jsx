import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();

  // 1. Attendre que l'état d'authentification soit vérifié
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Vérification des accès...</p>
      </div>
    );
  }

  // 2. Si l'utilisateur n'est pas connecté, retour à la page de login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 3. Vérification des permissions (RBAC - Role Based Access Control)
  // On autorise si aucun rôle n'est spécifié OU si le rôle de l'utilisateur est dans la liste
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirection vers une page spécifique ou retour à l'accueil si le rôle ne correspond pas
    return <Navigate to="/" replace />;
  }

  // 4. Si tout est OK, afficher le composant protégé
  return children;
}

const styles = {
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    color: "#7f8c8d"
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #3498db",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "10px"
  }
};