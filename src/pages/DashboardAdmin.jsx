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
  const [expenses, setExpenses] = useState([]);
  
  const [stats, setStats] = useState({ 
    ventesUSD: 0, ventesCDF: 0, 
    dettesUSD: 0, dettesCDF: 0, 
    alertes: 0,
    beneficeUSD: 0, beneficeCDF: 0 
  });

  const [view, setView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [showVenteModal, setShowVenteModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null); 
  
  const [venteData, setVenteData] = useState({ client: "", phone: "", productId: "", qte: 1, paye: 0, devise: "USD" });
  // AJOUT : prixAchat dans le state prodData
  const [prodData, setProdData] = useState({ nom: "", prixAchat: "", prix: "", action: "", imageUrl: "", devise: "USD" });
  const [expenseData, setExpenseData] = useState({ motif: "", montant: "", devise: "USD" });

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
    });
    const unsubExp = onSnapshot(query(collection(db, "depenses"), where("adminId", "==", user.adminId), orderBy("date", "desc")), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubProd(); unsubSales(); unsubExp(); };
  }, [user]);

  // CALCUL DES STATISTIQUES FINANCIERES CORRIGÉ
  useEffect(() => {
    let vUSD = 0, vCDF = 0, dUSD = 0, dCDF = 0, bUSD = 0, bCDF = 0;
    const today = new Date().toLocaleDateString();

    sales.forEach(s => {
      const saleDate = s.date?.toDate().toLocaleDateString();
      const paidAmount = Number(s.paid || 0);
      const debtAmount = Number(s.debt || 0);
      const margin = Number(s.benefice || 0); // Utilise la marge calculée lors de la vente

      if (s.devise === "USD") { 
        vUSD += paidAmount; 
        dUSD += debtAmount;
        if(saleDate === today) bUSD += margin; // Bénéfice = Somme des marges
      } else { 
        vCDF += paidAmount; 
        dCDF += debtAmount;
        if(saleDate === today) bCDF += margin;
      }
    });

    expenses.forEach(e => {
      const expenseAmount = Number(e.montant || 0);
      if (e.devise === "USD") { vUSD -= expenseAmount; } 
      else { vCDF -= expenseAmount; }
      // Note: Le bénéfice brut des ventes n'est plus diminué par les dépenses ici
    });

    setStats(prev => ({ 
        ...prev, 
        ventesUSD: vUSD, 
        ventesCDF: vCDF, 
        dettesUSD: dUSD, 
        dettesCDF: dCDF,
        beneficeUSD: bUSD,
        beneficeCDF: bCDF
    }));
  }, [sales, expenses]);

  const filteredProducts = products.filter(p => p.nom?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSales = sales.filter(s => s.client?.toLowerCase().includes(searchTerm.toLowerCase()) || s.productName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredExpenses = expenses.filter(e => e.motif?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setProdData({ ...prodData, imageUrl: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    // AJOUT : prixAchat converti en nombre
    const data = { ...prodData, prixAchat: Number(prodData.prixAchat), prix: Number(prodData.prix), action: Number(prodData.action), adminId: user.adminId, updatedAt: serverTimestamp() };
    try {
      if (editingProduct) { await updateDoc(doc(db, "produits", editingProduct.id), data); } 
      else { await addDoc(collection(db, "produits"), { ...data, createdAt: serverTimestamp() }); }
      setShowProductModal(false); setEditingProduct(null);
      setProdData({ nom: "", prixAchat: "", prix: "", action: "", imageUrl: "", devise: "USD" });
    } catch (err) { alert("Erreur: " + err.message); }
  };

  const handleVente = async (e) => {
    e.preventDefault();
    const prod = products.find(p => p.id === venteData.productId);
    if (!prod || prod.action < venteData.qte) return alert("Stock insuffisant !");
    
    const total = Number(prod.prix) * Number(venteData.qte);
    const totalAchat = Number(prod.prixAchat || 0) * Number(venteData.qte);
    const beneficeReel = total - totalAchat; // Calcul du bénéfice sur la vente
    const debtAmount = total - Number(venteData.paye);
    
    const saleObj = { 
        ...venteData, 
        productName: prod.nom, 
        productImg: prod.imageUrl || null, 
        unitPrice: prod.prix, 
        benefice: beneficeReel, // On enregistre le bénéfice dans la transaction
        total: total, 
        paid: Number(venteData.paye),
        debt: debtAmount > 0 ? debtAmount : 0, 
        adminId: user.adminId, 
        date: serverTimestamp() 
    };

    try {
      await addDoc(collection(db, "transactions"), saleObj);
      await updateDoc(doc(db, "produits", prod.id), { action: increment(-venteData.qte) });
      generateProfessionalPDF(saleObj, user);
      setShowVenteModal(false);
      setVenteData({ client: "", phone: "", productId: "", qte: 1, paye: 0, devise: "USD" });
    } catch (err) { alert("Erreur: " + err.message); }
  };

  const handleExpense = async (e) => {
    e.preventDefault();
    if (!user?.adminId) return alert("Session admin invalide.");
    const data = { motif: expenseData.motif, montant: Number(expenseData.montant), devise: expenseData.devise, adminId: user.adminId, updatedAt: serverTimestamp() };
    try {
      if (editingExpense) { await updateDoc(doc(db, "depenses", editingExpense.id), data); } 
      else { await addDoc(collection(db, "depenses"), { ...data, date: serverTimestamp() }); }
      setShowExpenseModal(false); setEditingExpense(null);
      setExpenseData({ motif: "", montant: "", devise: "USD" });
    } catch (err) { alert("Erreur: " + err.message); }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm("Supprimer cette dépense ?")) {
      try { await deleteDoc(doc(db, "depenses", id)); } catch (err) { alert(err.message); }
    }
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
  };

  return (
    <div style={{...styles.container, backgroundColor: theme.bg, color: theme.text}}>
      {isMobile && menuOpen && <div style={styles.overlaySidebar} onClick={() => setMenuOpen(false)} />}

      <aside style={{...styles.sidebar, left: isMobile ? (menuOpen ? "0" : "-320px") : "0"}}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>{user?.shopName || "ADMIN ROYAL"}</h2>
          {isMobile && <button onClick={() => setMenuOpen(false)} style={styles.closeBtn}>✕</button>}
        </div>
        <nav style={styles.sideNav}>
          <div onClick={() => {setView('dashboard'); setMenuOpen(false); setSearchTerm("")}} style={view === 'dashboard' ? styles.activeLink : styles.link}>📊 Tableau de Bord</div>
          <div onClick={() => {setView('inventaire'); setMenuOpen(false); setSearchTerm("")}} style={view === 'inventaire' ? styles.activeLink : styles.link}>📦 Gestion Stocks</div>
          <div onClick={() => {setView('dettes'); setMenuOpen(false); setSearchTerm("")}} style={view === 'dettes' ? styles.activeLink : styles.link}>⏳ Dettes clients</div>
          <div onClick={() => {setView('equipe'); setMenuOpen(false); setSearchTerm("")}} style={view === 'equipe' ? styles.activeLink : styles.link}>🛡️ Mon équipe</div>
          <div onClick={() => {setView('depenses'); setMenuOpen(false); setSearchTerm("")}} style={view === 'depenses' ? styles.activeLink : styles.link}>💸 Dépenses</div>
        </nav>
        <div style={styles.sidebarBottom}>
          <button onClick={() => setDarkMode(!darkMode)} style={styles.themeBtn}>{darkMode ? "☀️ Mode Clair" : "🌙 Mode Sombre"}</button>
          <button onClick={() => setShowVenteModal(true)} style={styles.btnVente}>+ NOUVELLE VENTE</button>
          <button onClick={() => {setEditingExpense(null); setExpenseData({motif:"", montant:"", devise:"USD"}); setShowExpenseModal(true)}} style={styles.btnDepense}>- SORTIR ARGENT</button>
          <button onClick={() => signOut(auth)} style={styles.logoutBtn}>🚪 DÉCONNEXION</button>
        </div>
      </aside>

      <main style={{...styles.main, marginLeft: isMobile ? "0" : "270px", width: isMobile ? "100%" : "calc(100% - 270px)"}}>
        <header style={{...styles.header, borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.card}}>
          {isMobile && <button style={styles.burger} onClick={() => setMenuOpen(true)}>☰</button>}
          <h1 style={styles.title}>{view.toUpperCase()}</h1>
          <input 
            type="text" placeholder="Rechercher..." 
            style={{...styles.searchBar, backgroundColor: theme.bg, color: theme.text}} 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </header>

        <div style={styles.scrollContainer}>
          {view === 'dashboard' && (
            <div style={styles.dashboardContent}>
              <div style={styles.statsGrid}>
                <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #27ae60"}}><small>SOLDE USD (NET)</small><h2>{stats.ventesUSD.toLocaleString()} $</h2></div>
                <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #2ecc71"}}><small>SOLDE CDF (NET)</small><h2>{stats.ventesCDF.toLocaleString()} FC</h2></div>
                <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #3498db"}}><small>BÉNÉFICE VENTES (USD)</small><h2 style={{color: '#27ae60'}}>{stats.beneficeUSD.toLocaleString()} $</h2></div>
                <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #9b59b6"}}><small>BÉNÉFICE VENTES (CDF)</small><h2 style={{color: '#2ecc71'}}>{stats.beneficeCDF.toLocaleString()} FC</h2></div>
                <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #e74c3c"}}><small>DETTES USD</small><h2>{stats.dettesUSD.toLocaleString()} $</h2></div>
                <div style={{...styles.card, backgroundColor: theme.card, borderTop: "5px solid #c0392b"}}><small>DETTES CDF</small><h2>{stats.dettesCDF.toLocaleString()} FC</h2></div>
              </div>
              <div style={styles.twoCol}>
                 <div style={{...styles.section, backgroundColor: theme.card}}>
                    <h4 style={styles.secTitle}>⚠️ Stock Critique</h4>
                    {filteredProducts.filter(p => p.action <= 5).map(p => (
                      <div key={p.id} style={styles.listRow}>
                        <span>{p.nom}</span>
                        <b style={{color: "#e74c3c"}}>{p.action} restants</b>
                      </div>
                    ))}
                 </div>
                 <div style={{...styles.section, backgroundColor: theme.card}}>
                    <h4 style={styles.secTitle}>📈 Dernières Activités</h4>
                    <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                      {filteredSales.slice(0, 10).map(s => (
                        <div key={s.id} style={styles.listRow}>
                          <div><b>{s.client}</b> <br/> <small>{s.productName}</small></div>
                          <div style={{textAlign: 'right'}}><b style={{color: '#27ae60'}}>+{s.paid} {s.devise}</b></div>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {view === 'inventaire' && (
            <div style={{...styles.section, backgroundColor: theme.card}}>
              <button onClick={() => {setEditingProduct(null); setProdData({nom:"", prixAchat:"", prix:"", action:"", imageUrl:"", devise:"USD"}); setShowProductModal(true)}} style={styles.addBtn}>+ NOUVEL ARTICLE</button>
              <div style={styles.tableResponsive}>
                <table style={styles.table}>
                  <thead style={styles.thead}>
                    <tr><th>Photo</th><th>Désignation</th><th>Achat</th><th>Vente</th><th>Stock</th><th>Total Valeur</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} style={styles.tr}>
                        <td><img src={p.imageUrl || "https://via.placeholder.com/45"} style={styles.imgTable} alt=""/></td>
                        <td><b>{p.nom}</b></td>
                        <td>{p.prixAchat?.toLocaleString()} {p.devise}</td>
                        <td>{p.prix?.toLocaleString()} {p.devise}</td>
                        <td style={{color: p.action <= 5 ? "red" : "#27ae60", fontWeight: "bold"}}>{p.action}</td>
                        <td style={{fontWeight: "bold", color: "#34495e"}}>
                            {(Number(p.prix) * Number(p.action)).toLocaleString()} {p.devise}
                        </td>
                        <td>
                          <button onClick={() => {setEditingProduct(p); setProdData(p); setShowProductModal(true)}} style={styles.editBtn}>✏️</button>
                          <button onClick={async () => { if(confirm("Supprimer?")) await deleteDoc(doc(db, "produits", p.id))}} style={styles.delBtn}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{
                marginTop: "30px", 
                padding: "20px", 
                backgroundColor: darkMode ? "#2c3e50" : "#f8f9fa", 
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-around",
                border: "2px dashed #3498db"
              }}>
                <div style={{textAlign: "center"}}>
                  <small style={{color: "#7f8c8d", fontWeight: "bold"}}>VALEUR TOTALE USD</small>
                  <h3 style={{color: "#2980b9", margin: "5px 0"}}>
                    {products.reduce((acc, p) => p.devise === "USD" ? acc + (Number(p.prix) * Number(p.action)) : acc, 0).toLocaleString()} $
                  </h3>
                </div>
                <div style={{width: "1px", backgroundColor: "#ddd"}}></div>
                <div style={{textAlign: "center"}}>
                  <small style={{color: "#7f8c8d", fontWeight: "bold"}}>VALEUR TOTALE CDF</small>
                  <h3 style={{color: "#27ae60", margin: "5px 0"}}>
                    {products.reduce((acc, p) => p.devise === "CDF" ? acc + (Number(p.prix) * Number(p.action)) : acc, 0).toLocaleString()} FC
                  </h3>
                </div>
              </div>
            </div>
          )}

          {view === 'dettes' && (
            <div style={{...styles.section, backgroundColor: theme.card}}>
              <h3 style={styles.secTitle}>Gestion des Créances</h3>
              <div style={styles.gridAuto}>
                {filteredSales.filter(s => s.debt > 0).map(s => (
                  <div key={s.id} style={styles.debtCard}>
                    <div style={{flex: 1}}><b>{s.client}</b> <br/><small>{s.productName}</small></div>
                    <div style={{textAlign: 'right', marginRight: '15px'}}><b style={{color: "#e74c3c"}}>{s.debt} {s.devise}</b></div>
                    <button style={styles.payBtn} onClick={async () => {
                      const m = prompt(`Montant reçu (${s.devise}) :`, s.debt);
                      if (m) await updateDoc(doc(db, "transactions", s.id), { debt: s.debt - Number(m), paid: increment(Number(m)) });
                    }}>Payer</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'depenses' && (
            <div style={{...styles.section, backgroundColor: theme.card}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'}}>
                  <h3 style={styles.secTitle}>Historique des Sorties</h3>
                  <button onClick={() => {setEditingExpense(null); setExpenseData({motif:"", montant:"", devise:"USD"}); setShowExpenseModal(true)}} style={styles.addBtn}>+ NOUVELLE SORTIE</button>
              </div>
              <div style={styles.tableResponsive}>
                <table style={styles.table}>
                  <thead style={styles.thead}>
                    <tr><th>Motif</th><th>Montant</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(e => (
                      <tr key={e.id} style={styles.tr}>
                        <td>{e.motif}</td>
                        <td style={{color: 'red', fontWeight: 'bold'}}>-{e.montant} {e.devise}</td>
                        <td>{e.date?.toDate().toLocaleDateString() || "..."}</td>
                        <td>
                          <button onClick={() => {setEditingExpense(e); setExpenseData(e); setShowExpenseModal(true)}} style={styles.editBtn}>✏️</button>
                          <button onClick={() => handleDeleteExpense(e.id)} style={styles.delBtn}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{background: '#f8f9fa', fontWeight: 'bold'}}>
                    <tr>
                      <td>TOTAL DÉPENSES</td>
                      <td colSpan="3" style={{color: 'red'}}>
                        {filteredExpenses.reduce((acc, curr) => curr.devise === "USD" ? acc + Number(curr.montant) : acc, 0).toLocaleString()} $ | {filteredExpenses.reduce((acc, curr) => curr.devise === "CDF" ? acc + Number(curr.montant) : acc, 0).toLocaleString()} FC
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {view === 'equipe' && <GestionEquipe />}
        </div>
      </main>

      {/* MODAL PRODUIT */}
      {showProductModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, backgroundColor: theme.card}}>
            <h3 style={{marginBottom: '15px'}}>Gestion Article</h3>
            <form onSubmit={handleSaveProduct} style={styles.form}>
              <input style={styles.input} type="text" placeholder="Désignation" value={prodData.nom} onChange={e => setProdData({...prodData, nom: e.target.value})} required/>
              <input style={styles.input} type="file" accept="image/*" onChange={handleFileChange} />
              <div style={{display: 'flex', gap: '10px'}}>
                <input style={styles.input} type="number" placeholder="Prix Achat" value={prodData.prixAchat} onChange={e => setProdData({...prodData, prixAchat: e.target.value})} required/>
                <input style={styles.input} type="number" placeholder="Prix Vente" value={prodData.prix} onChange={e => setProdData({...prodData, prix: e.target.value})} required/>
              </div>
              <select style={styles.input} value={prodData.devise} onChange={e => setProdData({...prodData, devise: e.target.value})}>
                <option value="USD">USD</option><option value="CDF">CDF</option>
              </select>
              <input style={styles.input} type="number" placeholder="Stock" value={prodData.action} onChange={e => setProdData({...prodData, action: e.target.value})} required/>
              <button style={{...styles.saveBtn, background: '#1a2a3a'}} type="submit">Enregistrer</button>
              <button style={styles.cancelBtn} type="button" onClick={() => setShowProductModal(false)}>Fermer</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VENTE */}
      {showVenteModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, backgroundColor: theme.card}}>
            <h3 style={{marginBottom: '15px'}}>Nouvelle Vente</h3>
            <form onSubmit={handleVente} style={styles.form}>
              <input style={styles.input} type="text" placeholder="Nom du client" value={venteData.client} onChange={e => setVenteData({...venteData, client: e.target.value})} required/>
              <select style={styles.input} value={venteData.productId} onChange={e => setVenteData({...venteData, productId: e.target.value})} required>
                <option value="">Sélectionner Article</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.action} dispos)</option>)}
              </select>
              <input style={styles.input} type="number" placeholder="Quantité" value={venteData.qte} onChange={e => setVenteData({...venteData, qte: Number(e.target.value)})} required/>
              <div style={{display: 'flex', gap: '10px'}}>
                <input style={styles.input} type="number" placeholder="Payé" value={venteData.paye} onChange={e => setVenteData({...venteData, paye: Number(e.target.value)})} required/>
                <select style={styles.input} value={venteData.devise} onChange={e => setVenteData({...venteData, devise: e.target.value})}>
                  <option value="USD">USD</option><option value="CDF">CDF</option>
                </select>
              </div>
              <button style={{...styles.saveBtn, background: '#27ae60'}} type="submit">Valider & Imprimer</button>
              <button style={styles.cancelBtn} type="button" onClick={() => setShowVenteModal(false)}>Annuler</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEPENSE */}
      {showExpenseModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, backgroundColor: theme.card}}>
            <h3 style={{marginBottom: '15px'}}>{editingExpense ? "Modifier Sortie" : "Nouvelle Sortie"}</h3>
            <form onSubmit={handleExpense} style={styles.form}>
              <input style={styles.input} type="text" placeholder="Motif" value={expenseData.motif} onChange={e => setExpenseData({...expenseData, motif: e.target.value})} required/>
              <div style={{display: 'flex', gap: '10px'}}>
                <input style={styles.input} type="number" placeholder="Montant" value={expenseData.montant} onChange={e => setExpenseData({...expenseData, montant: e.target.value})} required/>
                <select style={styles.input} value={expenseData.devise} onChange={e => setExpenseData({...expenseData, devise: e.target.value})}>
                  <option value="USD">USD</option><option value="CDF">CDF</option>
                </select>
              </div>
              <button style={{...styles.saveBtn, background: '#e74c3c'}} type="submit">{editingExpense ? "Mettre à jour" : "Confirmer Sortie"}</button>
              <button style={styles.cancelBtn} type="button" onClick={() => {setShowExpenseModal(false); setEditingExpense(null)}}>Annuler</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES IDENTIQUES À VOTRE CODE ORIGINAL
const styles = {
  container: { display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif", overflow: "hidden" },
  sidebar: { width: "250px", backgroundColor: "#1a2a3a", color: "white", padding: "20px", position: "fixed",top: "0", height: "100vh", zIndex: 2000, transition: "0.3s", display: "flex", flexDirection: "column" },
  sidebarHeader: { display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center" },
  logo: { fontSize: "18px", fontWeight: "bold", letterSpacing: '1px' },
  closeBtn: { background: "none", border: "none", color: "white", fontSize: "20px", cursor: "pointer" },
  sideNav: { flex: 1, overflowY: "auto" },
  link: { padding: "12px 15px", cursor: "pointer", borderRadius: "8px", marginBottom: "5px", color: "#bdc3c7", transition: "0.2s" },
  activeLink: { padding: "12px 15px", backgroundColor: "#3498db", color: "white", borderRadius: "8px", fontWeight: "bold" },
  sidebarBottom: { borderTop: "1px solid #2c3e50", paddingTop: "15px", display: "flex", flexDirection: "column", gap: "8px" },
  btnVente: { width: "100%", padding: "12px", background: "#27ae60", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnDepense: { width: "100%", padding: "12px", background: "#f39c12", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  logoutBtn: { width: "100%", padding: "12px", background: "#e74c3c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" },
  themeBtn: { width: "100%", padding: "8px", background: "#34495e", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" },
  
  main: { flex: 1, display: "flex", flexDirection: "column", height: "100vh", transition: "0.3s", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", position: "sticky", top: 0, zIndex: 100, gap: "10px", flexWrap: "wrap" },
  title: { fontSize: "clamp(16px, 4vw, 22px)", fontWeight: "800", margin: 0 },
  burger: { padding: "8px 12px", borderRadius: "5px", border: "none", backgroundColor: "#1a2a3a", color: "white", cursor: "pointer" },
  searchBar: { padding: "10px 20px", borderRadius: "25px", border: "1px solid #ddd", width: "100%", maxWidth: "250px", outline: "none" },
  
  scrollContainer: { flex: 1, overflowY: "auto", padding: "20px", boxSizing: "border-box" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "25px" },
  card: { padding: "20px", borderRadius: "15px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "5px" },
  twoCol: { display: 'grid', gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: '20px' },
  section: { padding: "20px", borderRadius: "15px", boxShadow: "0 5px 20px rgba(0,0,0,0.05)", marginBottom: "20px", width: "100%", boxSizing: "border-box" },
  secTitle: { marginBottom: "20px", fontSize: '18px', borderLeft: "5px solid #3498db", paddingLeft: "15px", fontWeight: "700" },
  listRow: { display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f1f3f5", alignItems: "center" },
  
  tableResponsive: { overflowX: "auto", width: "100%", marginTop: "15px" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "600px" },
  thead: { background: "#f8f9fa", textAlign: "left" },
  tr: { borderBottom: "1px solid #eee" },
  imgTable: { width: "45px", height: "45px", borderRadius: "10px", objectFit: "cover" },
  addBtn: { padding: "10px 20px", background: "#1a2a3a", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 3000, display: "flex", justifyContent: "center", alignItems: "center", padding: "15px" },
  modal: { padding: "30px", borderRadius: "20px", width: "100%", maxWidth: "450px", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" },
  form: { display: "flex", flexDirection: "column", gap: "15px" },
  input: { padding: "12px 15px", borderRadius: "10px", border: "1px solid #ddd", outline: "none", fontSize: "15px" },
  saveBtn: { padding: "15px", color: "white", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" },
  cancelBtn: { background: "none", border: "none", color: "#888", padding: "5px", cursor: "pointer", fontSize: "14px" },
  
  editBtn: { background: "#3498db", color: "white", border: "none", padding: "8px 12px", borderRadius: "6px", marginRight: "5px", cursor: "pointer" },
  delBtn: { background: "#e74c3c", color: "white", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer" },
  gridAuto: { display: 'grid', gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: '15px' },
  debtCard: { padding: "15px", borderRadius: "12px", display: "flex", alignItems: "center", border: "1px solid #eee", background: "rgba(255,255,255,0.05)" },
  payBtn: { background: "#1a2a3a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  overlaySidebar: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1500 }
};