import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  deleteDoc,
  query,
  where 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function DashboardAdjoint() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("stock");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [newProd, setNewProd] = useState({ nom: "", prix: "", action: "", imageUrl: "" });
  const [imagePreview, setImagePreview] = useState(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user?.adminId) return;

    // --- CHARGEMENT DES PRODUITS DE LA BOUTIQUE ---
    const qProd = query(collection(db, "produits"), where("adminId", "==", user.adminId));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // --- CHARGEMENT DES TRANSACTIONS DE LA BOUTIQUE ---
    const qTrans = query(collection(db, "transactions"), where("adminId", "==", user.adminId));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProd(); unsubTrans(); };
  }, [user]);

  // --- SAUVEGARDE OU MODIFICATION PRODUIT ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!user?.adminId) return alert("Session expirée");

    try {
      const productData = {
        nom: newProd.nom,
        prix: Number(newProd.prix),
        action: Number(newProd.action),
        imageUrl: newProd.imageUrl,
        adminId: user.adminId, // Liaison boutique
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "produits", editingId), productData);
      } else {
        await addDoc(collection(db, "produits"), { 
          ...productData, 
          createdAt: serverTimestamp() 
        });
      }
      closeModal();
    } catch (err) { alert("Erreur: " + err.message); }
  };

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

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Supprimer définitivement ce produit ?")) {
      try { await deleteDoc(doc(db, "produits", id)); } catch (err) { alert("Erreur"); }
    }
  };

  const openEditModal = (p) => {
    setEditingId(p.id);
    setNewProd({ nom: p.nom, prix: p.prix, action: p.action, imageUrl: p.imageUrl });
    setImagePreview(p.imageUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewProd({ nom: "", prix: "", action: "", imageUrl: "" });
    setImagePreview(null);
  };

  // --- RÈGLEMENT D'UNE DETTE ---
  const handlePayDebt = async (transactionId) => {
    if (!window.confirm("Le client a-t-il réglé la totalité de sa dette ?")) return;
    try {
      await updateDoc(doc(db, "transactions", transactionId), {
        debt: 0,
        status: "Réglé",
        paidDate: serverTimestamp()
      });
      alert("Dette marquée comme payée !");
    } catch (err) { alert(err.message); }
  };

  return (
    <div style={styles.container}>
      <nav style={{...styles.navbar, padding: isMobile ? "10px 15px" : "15px 30px"}}>
        <div style={{...styles.logo, fontSize: isMobile ? "18px" : "22px"}}>
          {user?.shopName || "BOUTIQUE"} <br/>
          <span style={{color: '#3498db', fontSize: '11px', fontWeight: 'normal'}}>GESTION ADJOINTE</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{fontSize: '11px', color: '#bdc3c7'}}>{user?.email}</span>
            <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Deconnexion</button>
        </div>
      </nav>

      <d<<<<<<< HEAD
            <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Deconnexion</button>
=======
            <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Sortir</button>
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
es.tabContainer, flexWrap: isMobile ? "wrap" : "nowrap"}}>
          <button style={activeTab === "stock" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("stock")}>📦 Stock & Inventaire</button>
          <button style={activeTab === "ventes" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("ventes")}>👥 Créances Clients</button>
        </div>

        {activeTab === "stock" && (
          <section style={styles.section}>
            <div style={{...styles.sectionHeader, flexDirection: isMobile ? "column" : "row"}}>
              <h3 style={{margin: 0}}>Produits en Rayon</h3>
              <button style={styles.addBtn} onClick={() => setIsModalOpen(true)}>+ Ajouter un produit</button>
            </div>
            
            <div style={{overflowX: "auto"}}>
              <table style={{...styles.table, minWidth: isMobile ? "600px" : "100%"}}>
                <thead>
                  <tr style={styles.thr}>
                    <th style={styles.th}>Aperçu</th>
                    <th style={styles.th}>Désignation</th>
                    <th style={styles.th}>Prix (FC)</th>
                    <th style={styles.th}>Stock</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={styles.tr}>
                      <td style={styles.td}>
                        {p.imageUrl ? <img src={p.imageUrl} alt="" style={styles.imgTable} /> : <div style={styles.noImg}>📦</div>}
                      </td>
                      <td style={styles.td}><b>{p.nom}</b></td>
                      <td style={styles.td}>{p.prix?.toLocaleString()}</td>
                      <td style={{...styles.td, fontWeight: "bold", color: p.action <= 5 ? '#e74c3c' : '#2ecc71'}}>
                        {p.action}
                      </td>
                      <td style={styles.td}>
                        <button onClick={() => openEditModal(p)} style={styles.editBtn}>Modifier</button>
                        <button onClick={() => handleDeleteProduct(p.id)} style={styles.deleteBtn}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <p style={styles.empty}>Aucun produit enregistré.</p>}
            </div>
          </section>
        )}

        {activeTab === "ventes" && (
          <section style={styles.section}>
            <h3>Suivi des Paiements</h3>
            <div style={{overflowX: "auto"}}>
              <table style={{...styles.table, minWidth: isMobile ? "600px" : "100%"}}>
                <thead>
                  <tr style={styles.thr}>
                    <th style={styles.th}>Client / Contact</th>
                    <th style={styles.th}>Achat</th>
                    <th style={styles.th}>Reste à payer</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => t.debt > 0).map(t => (
                    <tr key={t.id} style={styles.tr}>
                      <td style={styles.td}>👤 {t.client} <br/> <small style={{color: '#7f8c8d'}}>{t.phone}</small></td>
                      <td style={styles.td}>{t.productName} (x{t.quantity})</td>
                      <td style={{...styles.td, color: "#e74c3c", fontWeight: "bold"}}>
                        {t.debt.toLocaleString()} FC
                      </td>
                      <td style={styles.td}>
                        <button onClick={() => handlePayDebt(t.id)} style={styles.payBtn}>💰 Marquer Réglé</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.filter(t => t.debt > 0).length === 0 && <p style={styles.empty}>Aucune dette en cours. ✅</p>}
            </div>
          </section>
        )}

        {isModalOpen && (
          <div style={styles.overlay}>
            <div style={{...styles.modal, width: isMobile ? "90%" : "450px", padding: "25px"}}>
              <h3 style={{marginTop: 0}}>{editingId ? "Modifier" : "Ajouter un"} Produit</h3>
              <form onSubmit={handleSaveProduct} style={styles.form}>
                <label style={styles.label}>Nom du produit</label>
                <input type="text" placeholder="Ex: Sac de riz" value={newProd.nom} style={styles.input} required onChange={e => setNewProd({...newProd, nom: e.target.value})} />
                
                <div style={{display: 'flex', gap: '10px'}}>
                   <div style={{flex: 1}}>
                      <label style={styles.label}>Prix de vente</label>
                      <input type="number" placeholder="FC" value={newProd.prix} style={styles.input} required onChange={e => setNewProd({...newProd, prix: e.target.value})} />
                   </div>
                   <div style={{flex: 1}}>
                      <label style={styles.label}>Quantité en stock</label>
                      <input type="number" placeholder="0" value={newProd.action} style={styles.input} required onChange={e => setNewProd({...newProd, action: e.target.value})} />
                   </div>
                </div>

                <label style={styles.label}>Image du produit</label>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{fontSize: '12px'}} />
                {imagePreview && <img src={imagePreview} style={styles.preview} alt="" />}
                
                <div style={styles.modalButtons}>
                  <button type="button" onClick={closeModal} style={styles.cancelBtn}>Annuler</button>
                  <button type="submit" style={styles.saveBtn}>Confirmer</button>
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
  container: { backgroundColor: "#f8f9fa", minHeight: "100vh", fontFamily: "'Inter', sans-serif" },
  navbar: { display: "flex", justifyContent: "space-between", background: "#1a2a3a", color: "white", alignItems: "center" },
  logo: { fontWeight: "bold", color: "white", lineHeight: '1.2' },
  logoutBtn: { background: "#e74c3c", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer", fontSize: '12px' },
  content: { maxWidth: '1200px', margin: '0 auto' },
  tabContainer: { display: "flex", gap: "10px", marginBottom: "25px" },
  tab: { padding: "12px 20px", background: "#edf2f7", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: '14px', color: '#4a5568' },
  tabActive: { padding: "12px 20px", background: "#3498db", color: "white", borderRadius: "8px", fontWeight: "bold", fontSize: '14px' },
  section: { background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: '15px' },
  addBtn: { background: "#2ecc71", color: "white", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: '600' },
  table: { width: "100%", borderCollapse: "collapse" },
  thr: { background: "#f8fafc" },
  th: { textAlign: "left", padding: "12px", borderBottom: "2px solid #edf2f7", fontSize: "13px", color: '#718096' },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "12px", fontSize: "14px" },
  imgTable: { width: "45px", height: "45px", borderRadius: "8px", objectFit: "cover" },
  noImg: { width: "45px", height: "45px", background: "#f1f5f9", borderRadius: "8px", display: 'flex', alignItems: 'center', justifyContent: 'center' },
  editBtn: { background: "#ebf8ff", color: "#3182ce", border: "none", padding: "6px 12px", borderRadius: "6px", marginRight: "5px", cursor: "pointer", fontSize: '12px' },
  deleteBtn: { background: "#fff5f5", color: "#e53e3e", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: '12px' },
  payBtn: { background: "#27ae60", color: "white", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontSize: '12px', fontWeight: 'bold' },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", borderRadius: "15px", boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#4a5568' },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: '14px' },
  preview: { width: "100%", height: "100px", objectFit: "contain", marginTop: "10px", borderRadius: '8px', border: '1px dashed #cbd5e0' },
  modalButtons: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "15px" },
  cancelBtn: { padding: "10px 20px", background: "#f1f5f9", border: "none", borderRadius: "8px", cursor: "pointer", color: '#4a5568' },
  saveBtn: { padding: "10px 20px", background: "#3498db", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 'bold' },
  empty: { textAlign: 'center', padding: '20px', color: '#a0aec0', fontSize: '14px' }
};