import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { 
  collection, onSnapshot, addDoc, doc, updateDoc, 
  increment, serverTimestamp, query, where 
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

  // --- CHARGEMENT DES PRODUITS ---
  useEffect(() => {
    if (!user?.adminId) return;
    const q = query(collection(db, "produits"), where("adminId", "==", user.adminId));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  // Calcul du total et récupération de la devise
  const product = products.find(p => p.id === selectedProd);
  const activeDevise = product?.devise || "USD";

  useEffect(() => {
    setCurrentTotal(product ? Number(product.prix || 0) * Number(qty) : 0);
  }, [selectedProd, qty, product]);

  // --- GÉNÉRATION DU REÇU PDF ---
  const generatePDF = (saleData) => {
    const docPdf = new jsPDF();
    const dateStr = new Date().toLocaleString('fr-FR');
    
    docPdf.setFontSize(22);
    docPdf.setTextColor(41, 128, 185);
    docPdf.text(user?.shopName?.toUpperCase() || "MON ENTREPRISE", 105, 20, { align: "center" });
    
    docPdf.setFontSize(14);
    docPdf.setTextColor(44, 62, 80);
    docPdf.text("REÇU DE VENTE", 105, 30, { align: "center" });
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(100);
    docPdf.text(`Date : ${dateStr}`, 20, 45);
    docPdf.text(`Vendeur : ${user?.email}`, 20, 50);
    docPdf.text(`Client : ${saleData.client}`, 20, 55);

    autoTable(docPdf, {
      startY: 65,
      head: [['Désignation', 'Prix Unitaire', 'Qté', 'Total']],
      body: [[
        saleData.productName, 
        `${saleData.unitPrice.toLocaleString()} ${saleData.devise}`, 
        saleData.qte, 
        `${saleData.total.toLocaleString()} ${saleData.devise}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80] }
    });

    const finalY = docPdf.lastAutoTable.finalY + 10;
    docPdf.setFontSize(11);
    docPdf.text(`Montant versé : ${saleData.paid.toLocaleString()} ${saleData.devise}`, 140, finalY);
    
    if (saleData.debt > 0) {
      docPdf.setTextColor(231, 76, 60);
      docPdf.text(`RESTE À PAYER : ${saleData.debt.toLocaleString()} ${saleData.devise}`, 140, finalY + 7);
    } else {
      docPdf.setTextColor(39, 174, 96);
      docPdf.text("STATUT : RÉGLÉ ✅", 140, finalY + 7);
    }
    
    docPdf.save(`Recu_${saleData.client}.pdf`);
  };

  // --- VALIDATION DE LA VENTE ---
  const handleSale = async (e) => {
    e.preventDefault();
    if (!user?.adminId) return alert("Erreur de session");
    if (!product) return alert("Veuillez choisir un produit");
    if (Number(product.action || 0) < Number(qty)) return alert("Stock insuffisant !");
    if (loading) return;

    setLoading(true);
    const totalHT = Number(product.prix || 0) * Number(qty);
    const debtAmount = totalHT - Number(amountPaid);

    const saleData = {
      productName: product.nom,
      unitPrice: Number(product.prix),
      qte: Number(qty), // 'qte' pour rester cohérent avec l'Admin
      total: totalHT,
      paid: Number(amountPaid),
      debt: debtAmount > 0 ? debtAmount : 0,
      devise: product.devise || "USD",
      client: clientName,
      phone: clientPhone,
      adminId: user.adminId,
      sellerEmail: user.email,
      date: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "transactions"), saleData);
      await updateDoc(doc(db, "produits", selectedProd), {
        action: increment(-Number(qty))
      });

      generatePDF(saleData);
      alert("Vente réussie !");
      
      setSelectedProd(""); setQty(1); setClientName(""); setClientPhone(""); setAmountPaid(0);
    } catch (err) {
      alert("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {user?.avertissement && (
        <div style={styles.adminNote}>📢 <b>Note Direction :</b> {user.avertissement}</div>
      )}

      <nav style={{...styles.navbar, padding: isMobile ? "10px 15px" : "15px 30px"}}>
        <div style={styles.logo}>{user?.shopName || "SECRÉTARIAT"}</div>
        <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Sortir</button>
      </nav>

      <div style={{...styles.main, gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", padding: isMobile ? "15px" : "30px"}}>
        
        {/* FORMULAIRE DE VENTE */}
        <section style={styles.card}>
          <h3 style={{marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            🛒 Nouvelle Vente
            {currentTotal > 0 && <span style={{color: '#27ae60', fontSize: '18px'}}>{currentTotal.toLocaleString()} {activeDevise}</span>}
          </h3>
          
          <form onSubmit={handleSale} style={styles.form}>
            <label style={styles.label}>Article à vendre</label>
            <select value={selectedProd} onChange={(e) => setSelectedProd(e.target.value)} required style={styles.input}>
              <option value="">-- Sélectionner l'article --</option>
              {products.map(p => (
                <option key={p.id} value={p.id} disabled={p.action <= 0}>
                  {p.nom} ({p.action} en stock) - {p.prix} {p.devise || 'USD'}
                </option>
              ))}
            </select>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
              <div>
                <label style={styles.label}>Quantité</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={styles.input} min="1" required />
              </div>
              <div>
                <label style={styles.label}>Montant payé ({activeDevise})</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={styles.input} required />
              </div>
            </div>

            {currentTotal - amountPaid > 0 && (
              <div style={styles.debtAlert}>
                RESTE À PAYER : {(currentTotal - amountPaid).toLocaleString()} {activeDevise}
              </div>
            )}

            <label style={styles.label}>Client</label>
            <div style={{display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row'}}>
              <input type="text" placeholder="Nom du client" value={clientName} onChange={e => setClientName(e.target.value)} style={styles.input} required />
              <input type="text" placeholder="Téléphone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} style={styles.input} required />
            </div>
            
            <button type="submit" disabled={loading} style={styles.sellBtn}>
              {loading ? "Enregistrement..." : "VALIDER ET IMPRIMER"}
            </button>
          </form>
        </section>

        {/* ÉTAT DU STOCK */}
        <section style={styles.card}>
          <h3 style={{marginBottom: '20px'}}>📦 Articles en Rayon</h3>
          <div style={styles.scrollZone}>
            {products.length === 0 && <p style={{textAlign: 'center', color: '#ccc'}}>Chargement des produits...</p>}
            {products.map(p => (
              <div key={p.id} style={styles.prodItem}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  {p.imageUrl ? <img src={p.imageUrl} style={styles.imgThumb} alt="" /> : <div style={styles.noImg}>📦</div>}
                  <div>
                    <div style={{fontWeight: 'bold', fontSize: '14px'}}>{p.nom}</div>
                    <div style={{fontSize: '12px', color: '#7f8c8d'}}>{p.prix?.toLocaleString()} {p.devise || 'USD'}</div>
                  </div>
                </div>
                <span style={p.action <= 5 ? styles.lowStock : styles.okStock}>{p.action} pcs</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: { backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "sans-serif" },
  adminNote: { background: "#fff3cd", color: "#856404", padding: "10px", textAlign: "center", fontSize: "13px", borderBottom: "1px solid #ffeeba" },
  navbar: { display: "flex", justifyContent: "space-between", background: "#1a2a3a", color: "white", alignItems: 'center' },
  logo: { fontSize: "18px", fontWeight: "bold" },
  logoutBtn: { background: "#e74c3c", color: "white", border: "none", padding: "6px 12px", borderRadius: "5px", cursor: "pointer", fontSize: "12px" },
  main: { display: "grid", gap: "20px" },
  card: { background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#64748b' },
  input: { padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: '14px', width: '100%', outline: 'none' },
  debtAlert: { padding: '10px', backgroundColor: '#fee2e2', borderRadius: '6px', color: '#b91c1c', fontWeight: 'bold', fontSize: '13px', textAlign: 'center' },
  sellBtn: { padding: "15px", background: "#3498db", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  scrollZone: { maxHeight: "450px", overflowY: "auto" },
  prodItem: { display: "flex", justifyContent: "space-between", alignItems: 'center', padding: "10px 0", borderBottom: "1px solid #f1f5f9" },
  imgThumb: { width: '40px', height: '40px', borderRadius: '5px', objectFit: 'cover' },
  noImg: { width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lowStock: { color: "#ef4444", fontWeight: "bold", fontSize: '11px', background: '#fee2e2', padding: '3px 7px', borderRadius: '4px' },
  okStock: { color: "#22c55e", fontWeight: "bold", fontSize: '11px', background: '#f0fdf4', padding: '3px 7px', borderRadius: '4px' }
};