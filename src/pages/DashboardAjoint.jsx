import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { 
  collection, onSnapshot, addDoc, serverTimestamp, 
  updateDoc, doc, deleteDoc, query, where, increment 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function DashboardAdjoint() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [remark, setRemark] = useState("");
  const [activeTab, setActiveTab] = useState("vente");
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isVenteModalOpen, setIsVenteModalOpen] = useState(false);
  
  // States Produits
  const [editingId, setEditingId] = useState(null); 
  const [newProd, setNewProd] = useState({ nom: "", prix: "", action: "", imageUrl: "", devise: "USD" });
  const [imagePreview, setImagePreview] = useState(null);

  // States Vente
  const [venteData, setVenteData] = useState({ client: "", productId: "", qte: 1, paye: 0, devise: "USD" });

  // States Dettes
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");

  useEffect(() => {
    if (!user?.adminId) return;
    
    // Écouter les produits
    const qProd = query(collection(db, "produits"), where("adminId", "==", user.adminId));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Écouter les transactions
    const qTrans = query(collection(db, "transactions"), where("adminId", "==", user.adminId));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Écouter les remarques de l'admin (venant de la collection users pour cet adjoint)
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setRemark(docSnap.data().remarque || "");
      }
    });

    return () => { unsubProd(); unsubTrans(); unsubUser(); };
  }, [user]);

  // --- GESTION DES VENTES ---
  const handleVente = async (e) => {
    e.preventDefault();
    const prod = products.find(p => p.id === venteData.productId);
    if (!prod || prod.action < venteData.qte) return alert("Stock insuffisant !");
    
    const total = Number(prod.prix) * Number(venteData.qte);
    const debtAmount = total - Number(venteData.paye);
    
    const saleObj = { 
      ...venteData, 
      productName: prod.nom, 
      unitPrice: prod.prix, 
      total: total, 
      debt: debtAmount > 0 ? debtAmount : 0, 
      adminId: user.adminId, 
      vendeur: user.nom,
      date: serverTimestamp() 
    };

    try {
      await addDoc(collection(db, "transactions"), saleObj);
      await updateDoc(doc(db, "produits", prod.id), { action: increment(-venteData.qte) });
      generatePDF(saleObj);
      setIsVenteModalOpen(false);
      setVenteData({ client: "", productId: "", qte: 1, paye: 0, devise: "USD" });
      alert("Vente réussie !");
    } catch (err) { alert("Erreur: " + err.message); }
  };

  const generatePDF = (sale) => {
    const docPdf = new jsPDF();
    docPdf.text(user?.shopName || "RECU DE VENTE", 10, 10);
    autoTable(docPdf, {
      startY: 20,
      head: [['Client', 'Produit', 'Qté', 'Total', 'Payé']],
      body: [[sale.client, sale.productName, sale.qte, `${sale.total} ${sale.devise}`, `${sale.paye} ${sale.devise}`]],
    });
    docPdf.save(`Vente_${sale.client}.pdf`);
  };

  // --- GESTION DES PRODUITS ---
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
      } else {
        await addDoc(collection(db, "produits"), { ...productData, createdAt: serverTimestamp() });
      }
      closeModal();
    } catch (err) { alert("Erreur : " + err.message); }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Supprimer ce produit ?")) {
      try { await deleteDoc(doc(db, "produits", id)); } catch (err) { alert("Erreur"); }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewProd({ nom: "", prix: "", action: "", imageUrl: "", devise: "USD" });
    setImagePreview(null);
  };

  // --- GESTION DETTES ---
  const handleProcessRepayment = async (e) => {
    e.preventDefault();
    const amount = Number(repaymentAmount);
    try {
      await updateDoc(doc(db, "transactions", selectedDebt.id), {
        debt: selectedDebt.debt - amount,
        paid: increment(amount),
        updatedAt: serverTimestamp()
      });
      setIsDebtModalOpen(false);
      alert("Paiement enregistré");
    } catch (err) { alert(err.message); }
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.logo}>{user?.shopName || "ESPACE ADJOINT"}</div>
        <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Déconnexion</button>
      </nav>

      {remark && (
        <div style={styles.remarkBanner}>
          <span style={{fontWeight: 'bold'}}>⚠️ REMARQUE ADMIN :</span> {remark}
        </div>
      )}

      <div style={styles.content}>
        <div style={styles.tabContainer}>
          <button style={activeTab === "vente" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("vente")}>🛒 VENDRE</button>
          <button style={activeTab === "stock" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("stock")}>📦 STOCK</button>
          <button style={activeTab === "dettes" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("dettes")}>⏳ DETTES</button>
        </div>

        {/* ONGLET VENTE */}
        {activeTab === "vente" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3>Effectuer une vente</h3>
              <button style={styles.addBtn} onClick={() => setIsVenteModalOpen(true)}>+ Nouvelle Vente</button>
            </div>
            <div style={{marginTop: '20px'}}>
              <h4>Historique récent des ventes</h4>
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} style={styles.listRow}>
                  <span>{t.client} - {t.productName}</span>
                  <b>{t.total} {t.devise}</b>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ONGLET STOCK */}
        {activeTab === "stock" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3>Inventaire</h3>
              <button style={styles.addBtn} onClick={() => setIsModalOpen(true)}>+ Nouveau Produit</button>
            </div>
            <div style={{overflowX: "auto"}}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thr}>
                    <th style={styles.th}>Produit</th>
                    <th style={styles.th}>Prix</th>
                    <th style={styles.th}>Stock</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={styles.tr}>
                      <td style={styles.td}><b>{p.nom}</b></td>
                      <td style={styles.td}>{p.prix} {p.devise}</td>
                      <td style={{...styles.td, color: p.action < 5 ? 'red' : 'green', fontWeight: 'bold'}}>{p.action}</td>
                      <td style={styles.td}>
                        <button onClick={() => { setEditingId(p.id); setNewProd(p); setIsModalOpen(true); }} style={styles.editBtn}>✏️</button>
                        <button onClick={() => handleDeleteProduct(p.id)} style={styles.deleteBtn}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ONGLET DETTES */}
        {activeTab === "dettes" && (
          <section style={styles.section}>
            <h3>Clients Endettés</h3>
            {transactions.filter(t => t.debt > 0).map(t => (
              <div key={t.id} style={styles.debtRow}>
                <div style={{flex: 1}}>
                  <b>{t.client}</b><br/>
                  <small>Reste : {t.debt} {t.devise}</small>
                </div>
                <button onClick={() => { setSelectedDebt(t); setRepaymentAmount(t.debt); setIsDebtModalOpen(true); }} style={styles.payBtn}>Payer</button>
              </div>
            ))}
          </section>
        )}

        {/* MODAL VENTE */}
        {isVenteModalOpen && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <form onSubmit={handleVente} style={styles.form}>
                <h3>Nouvelle Vente</h3>
                <input type="text" placeholder="Nom du Client" style={styles.input} required onChange={e => setVenteData({...venteData, client: e.target.value})} />
                <select style={styles.input} required onChange={e => setVenteData({...venteData, productId: e.target.value})}>
                  <option value="">Choisir un produit</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.action} dispo)</option>)}
                </select>
                <input type="number" placeholder="Quantité" min="1" style={styles.input} required onChange={e => setVenteData({...venteData, qte: Number(e.target.value)})} />
                <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" placeholder="Montant Payé" style={{...styles.input, flex: 1}} required onChange={e => setVenteData({...venteData, paye: Number(e.target.value)})} />
                  <select style={styles.input} onChange={e => setVenteData({...venteData, devise: e.target.value})}>
                    <option value="USD">USD</option><option value="CDF">CDF</option>
                  </select>
                </div>
                <div style={styles.modalButtons}>
                  <button type="button" onClick={() => setIsVenteModalOpen(false)} style={styles.cancelBtn}>Annuler</button>
                  <button type="submit" style={styles.saveBtn}>Valider & Reçu</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL PRODUIT (AJOUT/MODIF) */}
        {isModalOpen && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <form onSubmit={handleSaveProduct} style={styles.form}>
                <h3>Produit</h3>
                <input type="text" placeholder="Nom" value={newProd.nom} style={styles.input} required onChange={e => setNewProd({...newProd, nom: e.target.value})} />
                <input type="number" placeholder="Prix" value={newProd.prix} style={styles.input} required onChange={e => setNewProd({...newProd, prix: e.target.value})} />
                <input type="number" placeholder="Stock" value={newProd.action} style={styles.input} required onChange={e => setNewProd({...newProd, action: e.target.value})} />
                <input type="file" accept="image/*" onChange={handleFileChange} />
                <div style={styles.modalButtons}>
                  <button type="button" onClick={closeModal} style={styles.cancelBtn}>Annuler</button>
                  <button type="submit" style={styles.saveBtn}>Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL PAIEMENT DETTE */}
        {isDebtModalOpen && (
          <div style={styles.overlay}>
            <div style={styles.modal}>
              <h3>Encaisser dette</h3>
              <form onSubmit={handleProcessRepayment} style={styles.form}>
                <input type="number" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)} style={styles.input} required />
                <div style={styles.modalButtons}>
                  <button type="button" onClick={() => setIsDebtModalOpen(false)} style={styles.cancelBtn}>Annuler</button>
                  <button type="submit" style={styles.saveBtn}>Valider</button>
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
  remarkBanner: { background: "#fff3cd", color: "#856404", padding: "15px", textAlign: "center", borderBottom: "2px solid #ffeeba" },
  logo: { fontWeight: "bold", fontSize: "1.2rem" },
  logoutBtn: { background: "#e74c3c", color: "white", border: "none", padding: "8px 12px", borderRadius: "5px", cursor: "pointer" },
  content: { maxWidth: '1000px', margin: '0 auto', padding: '20px' },
  tabContainer: { display: "flex", gap: "10px", marginBottom: "20px" },
  tab: { flex: 1, padding: "12px", background: "#ddd", border: "none", cursor: "pointer", fontWeight: 'bold', borderRadius: '5px' },
  tabActive: { flex: 1, padding: "12px", background: "#3498db", color: "white", border: "none", fontWeight: "bold", borderRadius: '5px' },
  section: { background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: 'center' },
  addBtn: { background: "#27ae60", color: "white", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: 'bold' },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "12px", background: "#f8f9fa", borderBottom: "2px solid #eee" },
  tr: { borderBottom: "1px solid #eee" },
  td: { padding: "12px" },
  listRow: { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #f9f9f9' },
  editBtn: { background: "#3498db", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px", marginRight: "5px" },
  deleteBtn: { background: "#e74c3c", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px" },
  debtRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px' },
  payBtn: { background: "#2ecc71", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", fontWeight: 'bold' },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", padding: "30px", borderRadius: "10px", width: "90%", maxWidth: "400px" },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  input: { padding: "12px", borderRadius: "6px", border: "1px solid #ddd" },
  modalButtons: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: '10px' },
  cancelBtn: { padding: "10px 15px", background: "#eee", border: "none", borderRadius: "5px" },
  saveBtn: { padding: "10px 20px", background: "#3498db", color: "white", border: "none", borderRadius: "5px", fontWeight: 'bold' }
};