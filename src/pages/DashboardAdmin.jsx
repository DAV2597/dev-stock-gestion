import { useState, useEffect } from "react";
import { db, auth } from "../firebase/config";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";
import GestionEquipe from "../components/GestionEquipe"; 

export default function DashboardAdmin() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState({ totalVentes: 0, totalDettes: 0, alertes: 0 });
  const [view, setView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user?.adminId) return;

    // Récupération des Produits de la boutique
    const qProd = query(collection(db, "produits"), where("adminId", "==", user.adminId));
    const unsubProd = onSnapshot(qProd, (snap) => {
      const pList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(pList);
      setStats(prev => ({ ...prev, alertes: pList.filter(p => Number(p.action || 0) <= 5).length }));
    });

    // Récupération des Transactions de la boutique
    const qSales = query(
      collection(db, "transactions"), 
      where("adminId", "==", user.adminId), 
      orderBy("date", "desc")
    );

    const unsubSales = onSnapshot(qSales, (snap) => {
      const sList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(sList);
      let v = 0; let d = 0;
      sList.forEach(s => { 
        v += Number(s.paid || 0); 
        d += Number(s.debt || 0); 
      });
      setStats(prev => ({ ...prev, totalVentes: v, totalDettes: d }));
    });

    return () => { unsubProd(); unsubSales(); };
  }, [user]);

  const filteredProducts = products.filter(p => 
    p.nom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const customerSummary = sales.reduce((acc, sale) => {
    if (sale.debt > 0) {
      if (!acc[sale.client]) {
        acc[sale.client] = { total: 0, phone: sale.phone, items: [] };
      }
      acc[sale.client].total += Number(sale.debt);
      acc[sale.client].items.push(sale);
    }
    return acc;
  }, {});

  const filteredClients = Object.entries(customerSummary).filter(([name]) => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{...styles.container, flexDirection: isMobile ? 'column' : 'row'}}>
      
      {/* --- SIDEBAR --- */}
      <aside style={{...styles.sidebar, width: isMobile ? '100%' : '280px'}}>
        <div style={styles.logoArea}>
          <h2 style={styles.logo}>{user?.shopName || "DEV STOCK"}</h2>
          <div style={styles.adminBadge}>{user?.email}</div>
        </div>
        
        <nav style={{...styles.sideNav, display: isMobile ? 'flex' : 'block',gap: isMobile?"5px":"0rem", overflowX: isMobile ? 'auto' : 'visible', fontSize: isMobile ? "9px": "16px",}}>
          <div onClick={() => {setView('dashboard'); setSearchTerm("");}} style={view === 'dashboard' ? styles.activeLink : styles.link}>📊 Tableau de bord</div><br />
          <div onClick={() => {setView('inventaire'); setSearchTerm("");}} style={view === 'inventaire' ? styles.activeLink : styles.link}>📦 Mon Stock</div><br />
          <div onClick={() => {setView('dettes'); setSearchTerm("");}} style={view === 'dettes' ? styles.activeLink : styles.link}>👥 Mes Créances</div><br />
          <div onClick={() => {setView('equipe'); setSearchTerm("");}} style={view === 'equipe' ? styles.activeLink : styles.link}>👥 Mon Équipe</div><br />
          <div onClick={() => {setView('messages'); setSearchTerm("");}} style={view === 'messages' ? styles.activeLink : styles.link}>
            💬 Alertes {stats.alertes > 0 && <span style={styles.notifBadge}>{stats.alertes}</span>}
          </div>
        </nav>

        <div style={styles.footerNav}>
          <div style={styles.userInfo}>{user?.email}</div>
          <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Déconnexion</button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main style={{...styles.main, padding: isMobile ? '15px' : '40px'}}>
        <header style={{...styles.header, flexDirection: isMobile ? 'column' : 'row'}}>
          <div>
            <h1 style={{...styles.viewTitle, fontSize: isMobile ? '22px' : '28px'}}>
              {view === 'dashboard' && 'Rapport d\'activité'}
              {view === 'inventaire' && 'Gestion des Stocks'}
              {view === 'dettes' && 'Portefeuille Créances'}
              {view === 'equipe' && 'Gestion du Personnel'}
              {view === 'messages' && 'Notifications Système'}
            </h1>
          </div>

          {view !== 'dashboard' && view !== 'messages' && (
            <input 
              type="text" 
              placeholder="Rechercher..." 
              style={{...styles.searchBar, width: isMobile ? '100%' : '300px'}}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          )}
        </header>

        {/* --- VUE : TABLEAU DE BORD --- */}
        {view === 'dashboard' && (
          <>
            <div style={{...styles.statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)'}}>
              <div style={{...styles.card, borderLeft: "5px solid #3498db"}}>
                <span style={styles.cardLabel}>Recettes Boutique</span>
                <h2 style={styles.cardValue}>{stats.totalVentes.toLocaleString()} FC</h2>
              </div>
              <div style={{...styles.card, borderLeft: "5px solid #e74c3c"}}>
                <span style={styles.cardLabel}>Dettes à Recouvrer</span>
                <h2 style={{...styles.cardValue, color: "#e74c3c"}}>{stats.totalDettes.toLocaleString()} FC</h2>
              </div>
              <div style={{...styles.card, borderLeft: "5px solid #f39c12"}}>
                <span style={styles.cardLabel}>Ruptures</span>
                <h2 style={{...styles.cardValue, color: "#f39c12"}}>{stats.alertes}</h2>
              </div>
            </div>

            <div style={{...styles.lowerGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', display: 'grid', gap: '20px'}}>
              <section style={styles.tableSection}>
                <h3 style={styles.sectionTitle}>⚠️ Stocks Critiques (≤ 10)</h3>
                <div style={styles.scrollBox}>
                  {products.filter(p => p.action <= 10).map(p => (
                    <div key={p.id} style={styles.criticalItem}>
                      <img src={p.imageUrl || 'https://via.placeholder.com/40'} style={styles.imgThumb} alt=""/>
                      <div style={{flex: 1, marginLeft: '10px'}}>
                        <div style={{fontWeight: 'bold'}}>{p.nom}</div>
                        <small style={{color: '#e74c3c'}}>Stock : {p.action}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={styles.tableSection}>
                <h3 style={styles.sectionTitle}>🕒 Dernières Ventes</h3>
                <div style={styles.scrollBox}>
                  {sales.slice(0, 10).map(s => (
                    <div key={s.id} style={styles.saleLog}>
                      <span><b>{s.client}</b></span>
                      <span>{s.productName}</span>
                      <span style={{color: '#27ae60', fontWeight: 'bold'}}>{Number(s.paid).toLocaleString()} FC</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {/* --- VUE : MON ÉQUIPE --- */}
        {view === 'equipe' && <GestionEquipe />}

        {/* --- VUE : INVENTAIRE --- */}
        {view === 'inventaire' && (
          <div style={{...styles.tableSection, overflowX: 'auto'}}>
            <table style={{...styles.table, minWidth: isMobile ? '600px' : '100%'}}>
              <thead>
                <tr style={styles.thr}><th>Image</th><th>Désignation</th><th>P.U</th><th>Stock</th><th>Valeur</th></tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} style={styles.tr}>
                    <td style={styles.td}><img src={p.imageUrl} style={styles.imgThumb} alt=""/></td>
                    <td style={styles.td}><b>{p.nom}</b></td>
                    <td style={styles.td}>{Number(p.prix).toLocaleString()} FC</td>
                    <td style={{...styles.td, color: p.action <= 5 ? 'red' : 'inherit'}}>{p.action}</td>
                    <td style={styles.td}><b>{(Number(p.prix) * Number(p.action)).toLocaleString()} FC</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- VUE : DETTES --- */}
        {view === 'dettes' && (
          <div style={{...styles.tableSection, overflowX: 'auto'}}>
            {!selectedClient ? (
              <table style={{...styles.table, minWidth: isMobile ? '600px' : '100%'}}>
                <thead>
                  <tr style={styles.thr}><th>Client</th><th>Téléphone</th><th>Dette</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {filteredClients.map(([name, data]) => (
                    <tr key={name} style={styles.tr}>
                      <td style={styles.td}>👤 <b>{name}</b></td>
                      <td style={styles.td}>{data.phone}</td>
                      <td style={{...styles.td, color: '#e74c3c', fontWeight: 'bold'}}>{data.total.toLocaleString()} FC</td>
                      <td style={styles.td}>
                        <button onClick={() => setSelectedClient({name, ...data})} style={styles.detailsBtn}>Détails</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div>
                <button onClick={() => setSelectedClient(null)} style={styles.backBtn}>⬅ Retour</button>
                <h3>Dossier : {selectedClient.name}</h3>
                {selectedClient.items.map((item, idx) => (
                  <div key={idx} style={styles.debtRow}>
                    <div><b>{item.productName}</b> (x{item.quantity})</div>
                    <div style={{color: '#e74c3c', fontWeight: 'bold'}}>{item.debt.toLocaleString()} FC</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- VUE : ALERTES --- */}
        {view === 'messages' && (
          <div style={styles.msgContainer}>
            {products.filter(p => p.action <= 5).map(p => (
              <div key={p.id} style={styles.msgAlert}>
                <b>RUPTURE IMMINENTE : {p.nom}</b> (Reste {p.action})
              </div>
            ))}
            {stats.alertes === 0 && <div style={styles.emptyMsg}>Tout est en ordre. ✅</div>}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { display: "flex", minHeight: "100vh", backgroundColor: "#f0f2f5", fontFamily: "'Inter', sans-serif" },
  sidebar: { backgroundColor: "#1a2a3a", color: "white", padding: "30px 20px", display: "flex", flexDirection: "column", boxSizing: 'border-box' },
  logoArea: { textAlign: 'center', marginBottom: '40px' },
  logo: { fontSize: "20px", letterSpacing: '1px', margin: 0, fontWeight: '800' },
  adminBadge: { fontSize: '9px', background: '#3498db', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '5px' },
  sideNav: { flex: 1 , width: "100%"},
  link: { cursor: "pointer", borderRadius: "10px", color: "#a0aec0"},
  activeLink: { borderRadius: "10px", color: "#fff", fontWeight: "600" },
  notifBadge: { backgroundColor: '#e74c3c', padding: '2px 7px', borderRadius: '50%', fontSize: '11px' },
  footerNav: { borderTop: '1px solid #2d3748', paddingTop: '20px' },
  userInfo: { fontSize: '11px', color: '#718096', marginBottom: '10px', textAlign: 'center' },
  logoutBtn: { width: '100%', padding: '12px', background: '#e74c3c', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold' },
  main: { flex: 1, overflowY: "auto", boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '40px', gap: '15px' },
  viewTitle: { fontSize: '28px', color: '#2d3748', margin: 0 },
  searchBar: { padding: '12px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' },
  statsGrid: { display: "grid", gap: "25px", marginBottom: "40px" },
  card: { backgroundColor: "white", padding: "25px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" },
  cardLabel: { color: "#718096", fontSize: "12px", fontWeight: "600" },
  cardValue: { fontSize: "28px", margin: "10px 0 0 0", color: "#2d3748" },
  lowerGrid: { display: "grid", gap: "30px" },
  tableSection: { backgroundColor: "white", padding: "25px", borderRadius: "16px" },
  sectionTitle: { marginBottom: '20px', fontSize: '16px', fontWeight: 'bold' },
  scrollBox: { maxHeight: '350px', overflowY: 'auto' },
  criticalItem: { display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f7fafc' },
  saleLog: { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #f7fafc', fontSize: '13px' },
  table: { width: "100%", borderCollapse: "collapse" },
  thr: { textAlign: "left", background: "#f8fafc", padding: '10px' },
  tr: { borderBottom: "1px solid #edf2f7" },
  td: { padding: "12px", fontSize: "14px" },
  imgThumb: { width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' },
  detailsBtn: { padding: '5px 10px', background: '#ebf8ff', color: '#3182ce', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  backBtn: { padding: '8px 12px', background: '#eee', border: 'none', borderRadius: '4px', marginBottom: '10px' },
  debtRow: { display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff5f5', marginBottom: '5px' },
  msgAlert: { padding: '15px', background: '#fffaf0', borderLeft: '4px solid #ed8936', marginBottom: '10px' },
  emptyMsg: { textAlign: 'center', padding: '20px', color: '#ccc' }
};