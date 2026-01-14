import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { 
  collection, onSnapshot, addDoc, serverTimestamp, 
  updateDoc, doc, deleteDoc, query, where 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function DashboardAdjoint() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("stock");
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  
  // States Produits
  const [editingId, setEditingId] = useState(null); 
  const [newProd, setNewProd] = useState({ nom: "", prix: "", action: "", imageUrl: "", devise: "USD" });
  const [imagePreview, setImagePreview] = useState(null);

  // States Dettes
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user?.adminId) return;
    
    const qProd = query(collection(db, "produits"), where("adminId", "==", user.adminId));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTrans = query(collection(db, "transactions"), where("adminId", "==", user.adminId));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProd(); unsubTrans(); };
  }, [user]);

  // --- GESTION DES PRODUITS (AJOUTER / MODIFIER / SUPPRIMER) ---
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setNewProd({ ...newProd, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        nom: newProd.nom,
        prix: Number(newProd.prix),
        action: Number(newProd.action),
        imageUrl: newProd.imageUrl || "",
        devise: newProd.devise || "USD",
        adminId: user.adminId,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "produits", editingId), productData);
        alert("Produit mis à jour !");
      } else {
        await addDoc(collection(db, "produits"), { ...productData, createdAt: serverTimestamp() });
        alert("Produit ajouté !");
      }
      closeModal();
    } catch (err) { alert("Erreur : " + err.message); }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.")) {
      try {
        await deleteDoc(doc(db, "produits", id));
      } catch (err) { alert("Erreur lors de la suppression"); }
    }
  };

  const openEditModal = (p) => {
    setEditingId(p.id);
    setNewProd({ nom: p.nom, prix: p.prix, action: p.action, imageUrl: p.imageUrl, devise: p.devise || "USD" });
    setImagePreview(p.imageUrl);
    setIsModalOpen(true);
  };

  // --- GESTION DES REMBOURSEMENTS ---

  const handleProcessRepayment = async (e) => {
    e.preventDefault();
    const amount = Number(repaymentAmount);
    if (amount <= 0 || amount > selectedDebt.debt) return alert("Montant invalide");

    try {
      const newDebt = selectedDebt.debt - amount;
      await updateDoc(doc(db, "transactions", selectedDebt.id), {
        debt: newDebt,
        paid: (selectedDebt.paid || 0) + amount,
        updatedAt: serverTimestamp()
      });
      alert(newDebt === 0 ? "Dette réglée !" : "Reste à payer : " + newDebt + " " + selectedDebt.devise);
      setIsDebtModalOpen(false);
    } catch (err) { alert(err.message); }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewProd({ nom: "", prix: "", action: "", imageUrl: "", devise: "USD" });
    setImagePreview(null);
  };
  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.logo}>{user?.shopName || "ADJOINT"}</div>
        
        <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Déconnexion</button>
      </nav>

      <div style={styles.content}>
        <div style={styles.tabContainer}>
          <button style={activeTab === "stock" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("stock")}>STOCK</button>
          <button style={activeTab === "ventes" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("ventes")}>DETTES</button>
        </div>

        {activeTab === "stock" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={{margin: 0}}>Inventaire Produits</h3>
              <button style={styles.addBtn} onClick={() => setIsModalOpen(true)}>+ Ajouter</button>
            </div>
            
            <div style={{overflowX: "auto"}}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thr}>
                    <th style={styles.th}>Aperçu</th>
                    <th style={styles.th}>Produit</th>
                    <th style={styles.th}>Prix</th>
                    <th style={styles.th}>Quantité</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={styles.tr}>
                      <td style={styles.td}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={styles.imgTable} /> : "📦"}</td>
                      <td style={styles.td}><b>{p.nom}</b></td>
                      <td style={styles.td}>{p.prix} {p.devise}</td>
                      <td style={{...styles.td, fontWeight: "bold", color: p.action < 5 ? 'red' : 'green'}}>{p.action}</td>
                      <td style={styles.td}>
                        <button onClick={() => openEditModal(p)} style={styles.editBtn}>Modifier</button>
                        <button onClick={() => handleDeleteProduct(p.id)} style={styles.deleteBtn}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "ventes" && (
          <section style={styles.section}>
            <h3>Clients Endettés</h3>
            {transactions.filter(t => t.debt > 0).map(t => (
              <div key={t.id} style={styles.debtRow}>
                <div style={{flex: 1}}>
                  <b>{t.client}</b><br/>
                  <small>{t.productName} (Reste : {t.debt} {t.devise})</small>
                </div>
                <button onClick={() => { setSelectedDebt(t); setRepaymentAmount(t.debt); setIsDebtModalOpen(true); }} style={styles.payBtn}>Encaisser</button>
              </div>
            ))}
          </section>
        )}

        {/* MODAL PRODUIT (AJOUT/MODIF) */}
        {isModalOpen && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <form onSubmit={handleSaveProduct} style={styles.form}>
                <h3>{editingId ? "Modifier" : "Ajouter"} un produit</h3>
                <input type="text" placeholder="Nom du produit" value={newProd.nom} style={styles.input} required onChange={e => setNewProd({...newProd, nom: e.target.value})} />
                <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" placeholder="Prix" value={newProd.prix} style={{...styles.input, flex: 1}} required onChange={e => setNewProd({...newProd, prix: e.target.value})} />
                  <select style={styles.input} value={newProd.devise} onChange={e => setNewProd({...newProd, devise: e.target.value})}>
                    <option value="USD">USD</option><option value="CDF">CDF</option>
                  </select>
                </div>
                <input type="number" placeholder="Quantité en stock" value={newProd.action} style={styles.input} required onChange={e => setNewProd({...newProd, action: e.target.value})} />
                <input type="file" accept="image/*" onChange={handleFileChange} />
                {imagePreview && <img src={imagePreview} style={styles.preview} alt="" />}
                <div style={styles.modalButtons}>
                  <button type="button" onClick={closeModal} style={styles.cancelBtn}>Annuler</button>
                  <button type="submit" style={styles.saveBtn}>Confirmer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL PAIEMENT DETTE */}
        {isDebtModalOpen && (
          <div style={styles.overlay}>
            <div style={{...styles.modal, padding: '20px', width: '320px'}}>
              <h3>Paiement</h3>
              <p>Client : <b>{selectedDebt?.client}</b></p>
              <form onSubmit={handleProcessRepayment} style={styles.form}>
                <label>Montant à verser :</label>
                <input type="number" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)} style={styles.input} required />
                <div style={styles.modalButtons}>
                  <button type="button" onClick={() => setIsDebtModalOpen(false)} style={styles.cancelBtn}>Annuler</button>
                  <button type="submit" style={styles.saveBtn}>Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { backgroundColor: "#f4f7f6", minHeight: "100vh", fontFamily: "sans-serif" },
  navbar: { display: "flex", justifyContent: "space-between", padding: "15px 20px", background: "#1a2a3a", color: "white" },
  logo: { fontWeight: "bold", fontSize: "1.2rem" },
  logoutBtn: { background: "#e74c3c", color: "white", border: "none", padding: "8px 12px", borderRadius: "5px", cursor: "pointer" },
  content: { maxWidth: '1000px', margin: '0 auto', padding: '20px' },
  tabContainer: { display: "flex", gap: "10px", marginBottom: "20px" },
  tab: { flex: 1, padding: "12px", background: "#ddd", border: "none", cursor: "pointer", fontWeight: 'bold' },
  tabActive: { flex: 1, padding: "12px", background: "#3498db", color: "white", border: "none", fontWeight: "bold" },
  section: { background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: 'center' },
  addBtn: { background: "#27ae60", color: "white", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", background: "#f8f9fa", borderBottom: "2px solid #eee" },
  tr: { borderBottom: "1px solid #eee" },
  td: { padding: "12px" },
  imgTable: { width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" },
  editBtn: { background: "#3498db", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px", marginRight: "5px", cursor: "pointer" },
  deleteBtn: { background: "#e74c3c", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer" },
  debtRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px' },
  payBtn: { background: "#2ecc71", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", fontWeight: 'bold' },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", padding: "30px", borderRadius: "10px", width: "400px" },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  input: { padding: "12px", borderRadius: "6px", border: "1px solid #ddd" },
  preview: { width: "100%", height: "100px", objectFit: "contain", marginTop: "10px" },
  modalButtons: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  cancelBtn: { padding: "10px 15px", background: "#eee", border: "none", borderRadius: "5px" },
  saveBtn: { padding: "10px 20px", background: "#3498db", color: "white", border: "none", borderRadius: "5px", fontWeight: 'bold' }
};