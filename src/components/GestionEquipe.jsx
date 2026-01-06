import { useState, useEffect } from "react";
<<<<<<< HEAD
import { db, auth } from "../firebase/config";
=======
import { db } from "../firebase/config";
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
<<<<<<< HEAD
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
=======
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
import { useAuth } from "../context/AuthContext";

export default function GestionEquipe() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [newEmp, setNewEmp] = useState({ email: "", password: "", role: "secretaire" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
<<<<<<< HEAD
=======
    // On utilise l'ID de l'admin (boutique) pour filtrer
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
    const currentAdminId = user?.adminId || user?.uid;
    if (!currentAdminId) return;

    const q = query(
      collection(db, "users"), 
      where("adminId", "==", currentAdminId),
      where("role", "!=", "admin")
    );

    const unsub = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [user]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setLoading(true);
<<<<<<< HEAD

    // Sauvegarde des infos de l'admin pour se reconnecter après la création
    const adminEmail = user.email;
    const adminPassword = prompt("Veuillez confirmer votre mot de passe Admin pour valider la création :");

    if (!adminPassword) {
      setLoading(false);
      return;
    }

    try {
      const empEmail = newEmp.email.toLowerCase().trim();
      const currentAdminId = user?.adminId || user?.uid;

      // 1. Création de l'accès dans Firebase AUTH (onglet Authentication)
      const userCredential = await createUserWithEmailAndPassword(auth, empEmail, newEmp.password);
      const newUid = userCredential.user.uid;

      // 2. Création du profil dans FIRESTORE (onglet Database)
      // On utilise l'UID comme identifiant de document pour une sécurité maximale
      await setDoc(doc(db, "users", newUid), {
        uid: newUid,
=======
    try {
      const empEmail = newEmp.email.toLowerCase().trim();
      const currentAdminId = user?.adminId || user?.uid;
      
      await setDoc(doc(db, "users", empEmail), {
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
        email: empEmail,
        password: newEmp.password,
        role: newEmp.role,
        adminId: currentAdminId,
        shopName: user.shopName || "Ma Boutique",
        createdAt: serverTimestamp(),
        avertissement: ""
      });

<<<<<<< HEAD
      // 3. RECONNEXION DE L'ADMIN
      // (Car createUserWithEmailAndPassword connecte automatiquement le nouveau compte)
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      alert("Compte " + newEmp.role + " activé et créé avec succès !");
=======
      alert("Compte employé créé avec succès !");
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
      setNewEmp({ email: "", password: "", role: "secretaire" });
    } catch (err) {
      alert("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteMember = async (id) => {
    if (window.confirm("Supprimer cet accès ?")) {
      await deleteDoc(doc(db, "users", id));
<<<<<<< HEAD
      alert("Profil supprimé de la base de données.");
=======
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
    }
  };

  const sendNote = async (id) => {
    const note = prompt("Message pour l'employé :");
    if (note) await updateDoc(doc(db, "users", id), { avertissement: note });
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>👥 Ma Gestion d'Équipe</h2>
      <form onSubmit={handleAddMember} style={styles.form}>
        <div style={styles.inputGroup}>
<<<<<<< HEAD
          <input 
            type="email" 
            placeholder="Email de l'employé" 
            value={newEmp.email} 
            onChange={e => setNewEmp({...newEmp, email: e.target.value})} 
            required 
            style={styles.input} 
          />
          <input 
            type="text" 
            placeholder="Mot de passe" 
            value={newEmp.password} 
            onChange={e => setNewEmp({...newEmp, password: e.target.value})} 
            required 
            style={styles.input} 
          />
          <select 
            value={newEmp.role} 
            onChange={e => setNewEmp({...newEmp, role: e.target.value})} 
            style={styles.select}
          >
            <option value="secretaire">Secrétaire</option>
            <option value="ajoint">Ajoint</option>
          </select>
          <button type="submit" disabled={loading} style={styles.addBtn}>
            {loading ? "Création..." : "Ajouter l'accès"}
          </button>
=======
          <input type="email" placeholder="Email" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} required style={styles.input} />
          <input type="text" placeholder="Mot de passe" value={newEmp.password} onChange={e => setNewEmp({...newEmp, password: e.target.value})} required style={styles.input} />
          <select value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value})} style={styles.select}>
            <option value="secretaire">Secrétaire</option>
            <option value="adjoint">Adjoint</option>
          </select>
          <button type="submit" disabled={loading} style={styles.addBtn}>{loading ? "..." : "Ajouter"}</button>
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
        </div>
      </form>

      <div style={styles.list}>
        {employees.map(emp => (
          <div key={emp.id} style={styles.item}>
            <div style={styles.info}>
              <span style={styles.empEmail}>{emp.email}</span>
<<<<<<< HEAD
              <span style={styles.empRole}>
                {emp.role === "ajoint" ? "🔹 Ajoint" : "🔸 Secrétaire"}
              </span>
              {emp.avertissement && (
                <div style={styles.warnBadge}>📢 {emp.avertissement}</div>
              )}
=======
              <span style={styles.empRole}>{emp.role === "adjoint" ? "🔹 Adjoint" : "🔸 Secrétaire"}</span>
              {emp.avertissement && <div style={styles.warnBadge}>📢 {emp.avertissement}</div>}
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
            </div>
            <div style={styles.actions}>
              <button onClick={() => sendNote(emp.id)} style={styles.msgBtn}>📢</button>
              <button onClick={() => deleteMember(emp.id)} style={styles.delBtn}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  card: { background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  title: { margin: "0 0 20px 0", color: "#2c3e50" },
  form: { marginBottom: "30px", padding: "15px", background: "#f8f9fa", borderRadius: "8px" },
  inputGroup: { display: "flex", gap: "10px", flexWrap: "wrap" },
<<<<<<< HEAD
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #ddd", flex: "1", minWidth: "150px" },
  select: { padding: "10px", borderRadius: "6px", border: "1px solid #ddd", cursor: "pointer" },
  addBtn: { background: "#27ae60", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #eee", borderRadius: "8px", marginBottom: "10px" },
  info: { display: "flex", flexDirection: "column" },
  empEmail: { fontWeight: "bold", fontSize: "14px" },
  empRole: { fontSize: "11px", color: "#7f8c8d", textTransform: "uppercase", fontWeight: "600" },
  warnBadge: { fontSize: "12px", background: "#fff3cd", padding: "4px 8px", borderRadius: "4px", marginTop: "5px", border: "1px solid #ffeeba" },
  actions: { display: "flex", gap: "8px" },
  msgBtn: { background: "#f1c40f", border: "none", padding: "8px", borderRadius: "4px", cursor: "pointer" },
  delBtn: { background: "#e74c3c", color: "#fff", border: "none", padding: "8px", borderRadius: "4px", cursor: "pointer" }
=======
  input: { padding: "10px", borderRadius: "6px", border: "1px solid #ddd", flex: "1" },
  select: { padding: "10px", borderRadius: "6px", border: "1px solid #ddd" },
  addBtn: { background: "#27ae60", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "6px", cursor: "pointer" },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #eee", borderRadius: "8px", marginBottom: "10px" },
  info: { display: "flex", flexDirection: "column" },
  empEmail: { fontWeight: "bold" },
  empRole: { fontSize: "11px", color: "#7f8c8d", textTransform: "uppercase" },
  warnBadge: { fontSize: "12px", background: "#fff3cd", padding: "4px", borderRadius: "4px", marginTop: "5px" },
  actions: { display: "flex", gap: "5px" },
  msgBtn: { background: "#f1c40f", border: "none", padding: "8px", borderRadius: "4px" },
  delBtn: { background: "#e74c3c", color: "#fff", border: "none", padding: "8px", borderRadius: "4px" }
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
};