import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { 
  collection, onSnapshot, query, orderBy, where, 
  addDoc, serverTimestamp, updateDoc, doc, increment, deleteDoc 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import GestionEquipe from "../components/GestionEquipe"; 
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function DashboardAdmin() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  
  const [stats, setStats] = useState({ 
    ventesUSD: 0, ventesCDF: 0, 
    dettesUSD: 0, dettesCDF: 0, 
    alertes: 0 
  });

  const [view, setView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [showVenteModal, setShowVenteModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [venteData, setVenteData] = useState({ client: "", phone: "", productId: "", qte: 1, paye: 0, devise: "USD" });
  const [prodData, setProdData] = useState({ nom: "", prix: "", action: "", imageUrl: "", devise: "USD" });

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user?.adminId) return;

    const unsubProd = onSnapshot(query(collection(db, "produits"), where("adminId", "==", user.adminId)), (snap) => {
      const pList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(pList);
      setStats(prev => ({ ...prev, alertes: pList.filter(p => Number(p.action) <= 5).length }));
    });

    const unsubSales = onSnapshot(query(collection(db, "transactions"), where("adminId", "==", user.adminId), orderBy("date", "desc")), (snap) => {
      const sList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(sList);
      
      let vUSD = 0, vCDF = 0, dUSD = 0, dCDF = 0;
      sList.forEach(s => {
        if (s.devise === "USD") {
          vUSD += Number(s.paid || 0);
          dUSD += Number(s.debt || 0);
        } else {
          vCDF += Number(s.paid || 0);
          dCDF += Number(s.debt || 0);
        }
      });
      setStats(prev => ({ ...prev, ventesUSD: vUSD, ventesCDF: vCDF, dettesUSD: dUSD, dettesCDF: dCDF }));
    });

    return () => { unsubProd(); unsubSales(); };
  }, [user]);

  const filteredProducts = products.filter(p => p.nom?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSalesDashboard = sales.filter(s => 
    s.client?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // FONCTION POUR CONVERTIR L'IMAGE EN TEXTE (BASE64)
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProdData({ ...prodData, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const data = { ...prodData, prix: Number(prodData.prix), action: Number(prodData.action), adminId: user.adminId, updatedAt: serverTimestamp() };
    try {
      if (editingProduct) { await updateDoc(doc(db, "produits", editingProduct.id), data); } 
      else { await addDoc(collection(db, "produits"), { ...data, createdAt: serverTimestamp() }); }
      setShowProductModal(false);
      setEditingProduct(null);
      setProdData({ nom: "", prix: "", action: "", imageUrl: "", devise: "USD" });
    } catch (err) { alert("Erreur: " + err.message); }
  };

  const handleVente = async (e) => {
    e.preventDefault();
    const prod = products.find(p => p.id === venteData.productId);
    if (!prod || prod.action < venteData.qte) return alert("Stock insuffisant !");
    const total = prod.prix * venteData.qte;
    const debtAmount = total - venteData.paye;
    const saleObj = { ...venteData, productName: prod.nom, productImg: prod.imageUrl || null, unitPrice: prod.prix, total, debt: debtAmount > 0 ? debtAmount : 0, adminId: user.adminId, date: serverTimestamp() };
    try {
      await addDoc(collection(db, "transactions"), saleObj);
      await updateDoc(doc(db, "produits", prod.id), { action: increment(-venteData.qte) });
      generateProfessionalPDF(saleObj, user);
      setShowVenteModal(false);
    } catch (err) { alert("Erreur: " + err.message); }
  };

  const generateProfessionalPDF = (sale, user) => {
    const docPdf = new jsPDF();
    docPdf.setFillColor(26, 42, 58);
    docPdf.rect(0, 0, 210, 40, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont("times", "bold"); 
    docPdf.setFontSize(22);
    docPdf.text(user?.shopName?.toUpperCase() || "ENTREPRISE ROYALE", 105, 25, { align: "center" });
    docPdf.setTextColor(40, 40, 40);
    docPdf.setFontSize(10);
    docPdf.text(`Client: ${sale.client}`, 20, 50);
    docPdf.text(`Date: ${new Date().toLocaleString()}`, 140, 50);
    autoTable(docPdf, {
      startY: 70,
      head: [['Désignation', 'Prix Unit.', 'Qté', 'Total']],
      body: [[sale.productName, `${sale.unitPrice} ${sale.devise}`, sale.qte, `${sale.total} ${sale.devise}`]],
      theme: 'grid',
      headStyles: { fillColor: [26, 42, 58] }
    });
    const finalY = docPdf.lastAutoTable.finalY + 15;
    docPdf.text(`Total Payé: ${sale.paye} ${sale.devise}`, 140, finalY, { align: "right" });
    if (sale.debt > 0) {
      docPdf.setTextColor(231, 76, 60);
      docPdf.text(`Reste à payer: ${sale.debt} ${sale.devise}`, 140, finalY + 7, { align: "right" });
    }
    docPdf.save(`Recu_${sale.client}.pdf`);
  };

  const theme = {
    bg: darkMode ? "#121212" : "#f4f7f6",
    card: darkMode ? "#1e1e1e" : "#ffffff",
    text: darkMode ? "#e0e0e0" : "#2c3e50",
    border: darkMode ? "#333" : "#e1e8ed",
    black: darkMode ? "#121212" : "#999",
  };

  return (
    <div style={{...styles.container, backgroundColor: theme.bg, color: theme.text}}>
      {isMobile && menuOpen && <div style={styles.overlaySidebar} onClick={() => setMenuOpen(false)} />}

      <aside style={{...styles.sidebar, left: isMobile ? (menuOpen ? "0" : "-100%") : "0"}}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>{user?.shopName || "ADMIN ROYAL"}</h2>
          {isMobile && <button onClick={() => setMenuOpen(false)} style={styles.closeBtn}>✕</button>}
        </div>
        <nav style={styles.sideNav}>
          <div onClick={() => {setView('dashboard'); setMenuOpen(false); setSearchTerm("")}} style={view === 'dashboard' ? styles.activeLink : styles.link}>📊 Tableau de Bord</div>
          <div onClick={() => {setView('inventaire'); setMenuOpen(false); setSearchTerm("")}} style={view === 'inventaire' ? styles.activeLink : styles.link}>📦 Ajouter le produits</div>
          <div onClick={() => {setView('dettes'); setMenuOpen(false); setSearchTerm("")}} style={view === 'dettes' ? styles.activeLink : styles.link}>⏳ Gestion Dettes client</div>
          <div onClick={() => {setView('equipe'); setMenuOpen(false); setSearchTerm("")}} style={view === 'equipe' ? styles.activeLink : styles.link}>🛡️ Créer ton equipes</div>
        </nav>
        <div style={styles.sidebarBottom}>
          <button onClick={() => setDarkMode(!darkMode)} style={styles.themeBtn}>{darkMode ? "☀️ Mode Clair" : "🌙 Mode Sombre"}</button>
          <button onClick={() => setShowVenteModal(true)} style={styles.btnVente}>+ NOUVELLE VENTE</button>
          <button onClick={() => signOut(auth)} style={styles.logoutBtn}>🚪 DÉCONNEXION</button>
        </div>
      </aside>

      <main style={{...styles.main, marginLeft: isMobile ? "0" : "280px", width: isMobile ? "100%" : "calc(100% - 280px)"}}>
        <header style={{...styles.header, borderBottom: `1px solid ${theme.border}`}}>
          {isMobile && <button style={styles.burger} onClick={() => setMenuOpen(true)}>☰ Menu</button>}
          <h1 style={styles.title}>{view.toUpperCase()}</h1>
          <input 
            type="text" 
            placeholder="Rechercher un client ou article..." 
            style={{...styles.searchBar, backgroundColor: theme.card, color: theme.text}} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </header>

        {view === 'dashboard' && (
          <div style={styles.dashboardContent}>
            <div style={styles.statsGrid}>
              <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #27ae60"}}><small>MONTANT EN USD</small><h2>{stats.ventesUSD.toLocaleString()} $</h2></div>
              <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #2ecc71"}}><small>MONTANT EN CDF</small><h2>{stats.ventesCDF.toLocaleString()} FC</h2></div>
              <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #e74c3c"}}><small>DETTES USD</small><h2>{stats.dettesUSD.toLocaleString()} $</h2></div>
              <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #c0392b"}}><small>DETTES CDF</small><h2>{stats.dettesCDF.toLocaleString()} FC</h2></div>
            </div>

            <div style={{...styles.twoCol, display: 'grid', gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: '20px'}}>
               <div style={{...styles.section, backgroundColor: theme.card}}>
                  <h4 style={styles.secTitle}>⚠️ Alertes Stock (-5)</h4>
                  {filteredProducts.filter(p => p.action <= 5).length > 0 ? (
                    filteredProducts.filter(p => p.action <= 5).map(p => (
                      <div key={p.id} style={styles.listRow}>
                        <span>{p.nom}</span>
                        <b style={{color: "#e74c3c"}}>{p.action} restants</b>
                      </div>
                    ))
                  ) : <p style={{fontSize: '12px', color: '#888'}}>Aucune alerte correspondante</p>}
               </div>

               <div style={{...styles.section, backgroundColor: theme.card}}>
                  <h4 style={styles.secTitle}>👥 Liste Clients & Ventes</h4>
                  <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                    {filteredSalesDashboard.length > 0 ? (
                      filteredSalesDashboard.map(s => (
                        <div key={s.id} style={styles.listRow}>
                          <div>
                            <b>{s.client}</b> <br/> 
                            <small style={{color: '#3498db'}}>{s.productName} (x{s.qte})</small>
                          </div>
                          <div style={{textAlign: 'right'}}>
                            <b style={{color: '#27ae60'}}>{s.paid} {s.devise}</b> <br/>
                            {s.debt > 0 && <small style={{color: '#e74c3c'}}>Reste: {s.debt} {s.devise}</small>}
                          </div>
                        </div>
                      ))
                    ) : <p style={{fontSize: '12px', color: '#888'}}>Aucun client trouvé</p>}
                  </div>
               </div>
            </div>
          </div>
        )}

        {view === 'inventaire' && (
          <div style={{...styles.section, backgroundColor: theme.card}}>
            <button onClick={() => {setEditingProduct(null); setProdData({nom:"", prix:"", action:"", imageUrl:"", devise:"USD"}); setShowProductModal(true)}} style={styles.addBtn}>+ AJOUTER ARTICLE</button>
            <div style={{overflowX: 'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr style={{textAlign: 'left', borderBottom: `2px solid ${theme.border}`}}>
                    <th>Image(s)</th><th>Désignation</th><th>Prix(A)</th><th>Stock</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} style={styles.tr}>
                      <td><img src={p.imageUrl || "https://via.placeholder.com/45"} style={styles.imgTable} alt=""/></td>
                      <td><b>{p.nom}</b></td>
                      <td>{p.prix?.toLocaleString()} {p.devise || 'USD'}</td>
                      <td style={{color: p.action <= 5 ? "red" : "#27ae60", fontWeight: "bold"}}>{p.action}</td>
                      <td>
                        <button onClick={() => {setEditingProduct(p); setProdData(p); setShowProductModal(true)}} style={styles.editBtn}>✏️</button>
                        <button onClick={async () => { if(confirm("Supprimer?")) await deleteDoc(doc(db, "produits", p.id))}} style={styles.delBtn}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'dettes' && (
          <div style={{...styles.section, backgroundColor: theme.card}}>
            <h3 style={styles.secTitle}>Liste des Dettes</h3>
            <div style={{display: 'grid', gap: '15px'}}>
              {filteredSalesDashboard.filter(s => s.debt > 0).map(s => (
                <div key={s.id} style={{...styles.debtCard, color: theme.black , borderLeft: `5px solid ${s.devise === 'USD' ? '#e74c3c' : '#f39c12'}`}}>
                  <div style={{flex: 1}}>
                    <b style={{fontSize: '16px'}}>{s.client}</b> <br/>
                    <small>Produit: {s.productName}</small>
                  </div>
                  <div style={{textAlign: 'right', marginRight: '20px'}}>
                    <div style={{color: "#e74c3c", fontWeight: "bold"}}>{s.debt.toLocaleString()} {s.devise}</div>
                  </div>
                  <button style={styles.payBtn} onClick={async () => {
                    const montant = prompt(`Montant à encaisser (${s.devise}) :`, s.debt);
                    if (montant && !isNaN(montant)) {
                      await updateDoc(doc(db, "transactions", s.id), { debt: s.debt - Number(montant), paid: increment(Number(montant)) });
                    }
                  }}>Validation</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'equipe' && <GestionEquipe />}
      </main>

      {showProductModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, backgroundColor: theme.card}}>
            <h3>{editingProduct ? "Modifier" : "Nouvel Article"}</h3>
            <form onSubmit={handleSaveProduct} style={styles.form}>
              <input style={styles.input} type="text" placeholder="Nom du produit à acheter" value={prodData.nom} onChange={e => setProdData({...prodData, nom: e.target.value})} required/>
              
              {/* INPUT FILE AU LIEU DU TEXTE */}
              <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                <label style={{fontSize: '12px', color: '#888'}}>Choisir une photo :</label>
                <input style={styles.input} type="file" accept="image/*" onChange={handleFileChange} />
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                <input style={styles.input} type="number" placeholder="Prix d'achat" value={prodData.prix} onChange={e => setProdData({...prodData, prix: e.target.value})} required/>
                <select style={styles.input} value={prodData.devise} onChange={e => setProdData({...prodData, devise: e.target.value})}>
                  <option value="USD">USD</option><option value="CDF">CDF</option>
                </select>
              </div>
              <input style={styles.input} type="number" placeholder="Quantité acheter" value={prodData.action} onChange={e => setProdData({...prodData, action: e.target.value})} required/>
              <button style={styles.saveBtn} type="submit">Enregistrer</button>
              <button style={styles.cancelBtn} type="button" onClick={() => setShowProductModal(false)}>Annuler</button>
            </form>
          </div>
        </div>
      )}

      {showVenteModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, backgroundColor: theme.card}}>
            <h3>Facturation Royale</h3>
            <form onSubmit={handleVente} style={styles.form}>
              <input style={styles.input} type="text" placeholder="nom du client" onChange={e => setVenteData({...venteData, client: e.target.value})} required/>
              <select style={styles.input} onChange={e => setVenteData({...venteData, productId: e.target.value})} required>
                <option value="">Sélectionner Article</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.action})</option>)}
              </select>
              <input style={styles.input} type="number" placeholder="Quantité à vendre" onChange={e => setVenteData({...venteData, qte: Number(e.target.value)})} required/>
              <div style={{display: 'flex', gap: '10px'}}>
                <input style={styles.input} type="number" placeholder="Prix de vente" onChange={e => setVenteData({...venteData, paye: Number(e.target.value)})} required/>
                <select style={styles.input} onChange={e => setVenteData({...venteData, devise: e.target.value})}>
                  <option value="USD">USD</option><option value="CDF">CDF</option>
                </select>
              </div>
              <button style={{...styles.saveBtn, background: '#1a2a3a'}} type="submit">Enrégistrer</button>
              <button style={styles.cancelBtn} type="button" onClick={() => setShowVenteModal(false)}>Fermer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", minHeight: "100vh", fontFamily: "'Times New Roman', serif" },
  sidebar: { width: "265px", backgroundColor: "#1a2a3a", color: "white", padding: "20px", position: "fixed", height: "100vh", zIndex: 2000, display: "flex", flexDirection: "column" },
  sidebarHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" },
  closeBtn: { background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" },
  overlaySidebar: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1500 },
  logo: { fontSize: "20px", fontWeight: "bold" },
  sideNav: { flex: 1 },
  link: { padding: "12px", cursor: "pointer", borderRadius: "8px", marginBottom: "5px", color: "#bdc3c7" },
  activeLink: { padding: "12px", backgroundColor: "#3498db", color: "white", borderRadius: "8px", fontWeight: "bold" },
  sidebarBottom: { borderTop: "1px solid #2c3e50", paddingTop: "15px", position: "relative", zIndex: 2100 },
  btnVente: { width: "100%", padding: "12px", background: "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", marginBottom: "10px", cursor: "pointer" },
  logoutBtn: { width: "100%", padding: "10px", background: "#e74c3c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" },
  themeBtn: { width: "100%", padding: "8px", background: "#34495e", color: "white", border: "none", borderRadius: "8px", marginBottom: "10px", cursor: "pointer" },
  main: { flex: 1, padding: "25px", transition: "0.3s" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px", paddingBottom: "15px", flexWrap: "wrap", gap: "10px" },
  burger: { padding: "8px 15px", borderRadius: "5px", border: "none", backgroundColor: "#1a2a3a", color: "white", cursor: "pointer" },
  searchBar: { padding: "10px 15px", borderRadius: "20px", border: "1px solid #ddd", width: "100%", maxWidth: "300px", outline: "none" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" },
  card: { padding: "20px", borderRadius: "12px", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" },
  section: { padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: "20px" },
  secTitle: { marginBottom: "15px", borderLeft: "4px solid #3498db", paddingLeft: "10px", fontWeight: 'bold' },
  listRow: { display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f1f1f1" },
  table: { width: "100%", borderCollapse: "collapse" },
  tr: { borderBottom: "1px solid #eee", height: "60px" },
  imgTable: { width: "45px", height: "45px", borderRadius: "8px", objectFit: "cover" },
  addBtn: { padding: "10px 20px", background: "#1a2a3a", color: "white", border: "none", borderRadius: "8px", marginBottom: "15px", cursor: "pointer", fontWeight: "bold" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 3000, display: "flex", justifyContent: "center", alignItems: "center" },
  modal: { padding: "25px", borderRadius: "15px", width: "95%", maxWidth: "450px" },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  input: { padding: "12px", borderRadius: "8px", border: "1px solid #ddd", outline: "none" },
  saveBtn: { padding: "12px", background: "#1a2a3a", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  cancelBtn: { padding: "10px", background: "none", border: "none", color: "#888", cursor: "pointer" },
  editBtn: { background: "#3498db", color: "white", border: "none", padding: "6px", borderRadius: "5px", cursor: "pointer", marginRight: "5px" },
  delBtn: { background: "#e74c3c", color: "white", border: "none", padding: "6px", borderRadius: "5px", cursor: "pointer" },
  debtCard: { padding: "15px", backgroundColor: "#fff", borderRadius: "10px", display: "flex", alignItems: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" },
  payBtn: { background: "#1a2a3a", color: "white", border: "none", padding: "10px 15px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }
};