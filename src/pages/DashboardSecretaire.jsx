import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  query, 
  where 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../context/AuthContext";

export default function DashboardSecretaire() {
  const { user } = useAuth(); 
  const [products, setProducts] = useState([]);
  const [selectedProd, setSelectedProd] = useState("");
  const [qty, setQty] = useState(1);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- CHARGEMENT DES PRODUITS DE LA BOUTIQUE ---
  useEffect(() => {
    if (!user?.adminId) return;

    const q = query(
      collection(db, "produits"), 
      where("adminId", "==", user.adminId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  // Calcul du total en temps réel
  useEffect(() => {
    const product = products.find(p => p.id === selectedProd);
    setCurrentTotal(product ? Number(product.prix || 0) * Number(qty) : 0);
  }, [selectedProd, qty, products]);

  // --- GÉNÉRATION DU REÇU PDF ---
  const generatePDF = (saleData) => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString('fr-FR');
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(52, 152, 219);
    doc.text(user?.shopName || "MA BOUTIQUE", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text("REÇU DE VENTE", 105, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Date : ${dateStr}`, 20, 45);
    doc.text(`Vendeur : ${user?.email}`, 20, 50);
    doc.text(`Client : ${saleData.client}`, 20, 55);

    autoTable(doc, {
      startY: 65,
      head: [['Désignation', 'Prix Unitaire', 'Qté', 'Total']],
      body: [[
        saleData.productName, 
        `${saleData.unitPrice.toLocaleString()} FC`, 
        saleData.quantity, 
        `${saleData.totalPrice.toLocaleString()} FC`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text(`Montant versé : ${saleData.paid.toLocaleString()} FC`, 140, finalY);
    
    if (saleData.debt > 0) {
      doc.setTextColor(231, 76, 60);
      doc.text(`RESTE À PAYER : ${saleData.debt.toLocaleString()} FC`, 140, finalY + 7);
    } else {
      doc.setTextColor(39, 174, 96);
      doc.text("STATUT : RÉGLÉ ✅", 140, finalY + 7);
    }
    
    doc.save(`Recu_${saleData.client}_${Date.now()}.pdf`);
  };

  // --- VALIDATION DE LA VENTE ---
  const handleSale = async (e) => {
    e.preventDefault();
    if (!user?.adminId) return alert("Erreur de session");
    if (loading) return;

    const product = products.find(p => p.id === selectedProd);
    if (!product) return alert("Veuillez choisir un produit");
    if (Number(product.action || 0) < Number(qty)) return alert("Stock insuffisant !");

    setLoading(true);
    const totalHT = Number(product.prix || 0) * Number(qty);
    const debtAmount = totalHT - Number(amountPaid);

    const saleData = {
      productName: product.nom,
      unitPrice: Number(product.prix),
      quantity: Number(qty),
      totalPrice: totalHT,
      paid: Number(amountPaid),
      debt: debtAmount > 0 ? debtAmount : 0,
      client: clientName,
      phone: clientPhone,
      adminId: user.adminId, // Lien avec la boutique de l'Admin
      sellerEmail: user.email,
      date: serverTimestamp()
    };

    try {
      // 1. Enregistrer la transaction
      await addDoc(collection(db, "transactions"), saleData);
      
      // 2. Mettre à jour le stock
      await updateDoc(doc(db, "produits", selectedProd), {
        action: increment(-Number(qty))
      });

      generatePDF(saleData);
      alert("Vente enregistrée avec succès !");
      
      // Reset
      setSelectedProd(""); setQty(1); setClientName(""); setClientPhone(""); setAmountPaid(0);
    } catch (err) {
      alert("Erreur lors de la vente : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Alerte message de l'Admin */}
      {user?.avertissement && (
        <div style={styles.adminNote}>📢 <b>Note de la direction :</b> {user.avertissement}</div>
      )}

      <nav style={{...styles.navbar, flexDirection: isMobile ? 'column' : 'row'}}>
        <div style={styles.logo}>{user?.shopName || "DEV STOCK"}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
           <span style={{fontSize: '12px'}}>{user?.email}</span>
           <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Déconnexion</button>
        </div>
      </nav>

      <div style={{...styles.main, gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", padding: isMobile ? "15px" : "30px"}}>
        
        {/* FORMULAIRE DE VENTE */}
        <section style={styles.card}>
          <h3 style={{marginBottom: '20px', display: 'flex', justifyContent: 'space-between'}}>
            🛒 Effectuer une vente
            {currentTotal > 0 && <span style={{color: '#27ae60'}}>{currentTotal.toLocaleString()} FC</span>}
          </h3>
          
          <form onSubmit={handleSale} style={styles.form}>
            <label style={styles.label}>Sélectionner l'article</label>
            <select value={selectedProd} onChange={(e) => setSelectedProd(e.target.value)} required style={styles.input}>
              <option value="">-- Choisir un produit --</option>
              {products.map(p => (
                <option key={p.id} value={p.id} disabled={p.action <= 0}>
                  {p.nom} ({p.action} dispo) - {p.prix} FC
                </option>
              ))}
            </select>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
              <div>
                <label style={styles.label}>Quantité</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={styles.input} min="1" required />
              </div>
              <div>
                <label style={styles.label}>Montant reçu (FC)</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={styles.input} required />
              </div>
            </div>

            {currentTotal - amountPaid > 0 && (
              <div style={styles.debtAlert}>
                Dette client : {(currentTotal - amountPaid).toLocaleString()} FC
              </div>
            )}

            <label style={styles.label}>Informations Client</label>
            <div style={{display: 'flex', gap: '10px'}}>
              <input type="text" placeholder="Nom complet" value={clientName} onChange={e => setClientName(e.target.value)} style={styles.input} required />
              <input type="text" placeholder="Téléphone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} style={styles.input} required />
            </div>
            
            <button type="submit" disabled={loading} style={styles.sellBtn}>
              {loading ? "Traitement..." : "Valider & Imprimer le Reçu"}
            </button>
          </form>
        </section>

        {/* APERÇU DU STOCK */}
        <section style={styles.card}>
          <h3 style={{marginBottom: '20px'}}>📦 Disponibilité Stock</h3>
          <div style={styles.scrollZone}>
            {products.length === 0 && <p style={{textAlign: 'center', color: '#ccc'}}>Aucun produit en rayon.</p>}
            {products.map(p => (
              <div key={p.id} style={styles.prodItem}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  {p.imageUrl ? <img src={p.imageUrl} style={styles.imgThumb} alt="" /> : <div style={styles.noImg}>📦</div>}
                  <div>
                    <div style={{fontWeight: 'bold', fontSize: '14px'}}>{p.nom}</div>
                    <div style={{fontSize: '12px', color: '#7f8c8d'}}>{p.prix?.toLocaleString()} FC</div>
                  </div>
                </div>
                <span style={p.action <= 5 ? styles.lowStock : styles.okStock}>{p.action} unités</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: { backgroundColor: "#f4f7f6", minHeight: "100vh", fontFamily: "'Inter', sans-serif" },
  adminNote: { background: "#fff3cd", color: "#856404", padding: "12px", textAlign: "center", fontSize: "14px", borderBottom: "1px solid #ffeeba" },
  navbar: { display: "flex", justifyContent: "space-between", padding: "15px 30px", background: "#1a2a3a", color: "white", alignItems: 'center' },
  logo: { fontSize: "20px", fontWeight: "bold", color: "#3498db" },
  logoutBtn: { background: "#e74c3c", color: "white", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer", fontSize: "12px" },
  main: { display: "grid", gap: "25px" },
  card: { background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  label: { fontSize: '11px', fontWeight: 'bold', color: '#7f8c8d', textTransform: 'uppercase' },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #ddd", width: '100%', boxSizing: 'border-box', fontSize: '14px' },
  debtAlert: { padding: '12px', backgroundColor: '#fff5f5', borderRadius: '8px', color: '#c53030', fontWeight: 'bold', fontSize: '14px', textAlign: 'center' },
  sellBtn: { padding: "16px", background: "#27ae60", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "15px", marginTop: "10px" },
  scrollZone: { maxHeight: "500px", overflowY: "auto" },
  prodItem: { display: "flex", justifyContent: "space-between", alignItems: 'center', padding: "12px 0", borderBottom: "1px solid #f8f9fa" },
  imgThumb: { width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' },
  noImg: { width: '40px', height: '40px', background: '#f1f2f6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lowStock: { color: "#e74c3c", fontWeight: "bold", fontSize: '12px', background: '#fff5f5', padding: '4px 8px', borderRadius: '4px' },
  okStock: { color: "#2ecc71", fontWeight: "bold", fontSize: '12px', background: '#f0fff4', padding: '4px 8px', borderRadius: '4px' }
};