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

    // Récupération des Produits
    const qProd = query(collection(db, "produits"), where("adminId", "==", user.adminId));
    const unsubProd = onSnapshot(qProd, (snap) => {
      const pList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(pList);
      setStats(prev => ({ ...prev, alertes: pList.filter(p => Number(p.action || 0) <= 5).length }));
    });

    // Récupération des Transactions
    const qSales = query(collection(db, "transactions"), where("adminId", "==", user.adminId), orderBy("date", "desc"));
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

  // LOGIQUE DE FILTRAGE ET RÉSUMÉ CLIENTS
  const filteredProducts = products.filter(p => p.nom?.toLowerCase().includes(searchTerm.toLowerCase()));

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
      
      {/* SIDEBAR MODERNE */}
      <aside style={{...styles.sidebar, width: isMobile ? '100%' : '280px', height: isMobile ? 'auto' : '100vh', position: isMobile ? 'relative' : 'sticky', top: 0}}>
        <div style={styles.logoArea}>
          <h2 style={styles.logo}>{user?.shopName || "DEV STOCK"}</h2>
          <div style={styles.adminBadge}>ESPACE ADMINISTRATEUR</div>
        </div>
        
        <nav style={{...styles.sideNav, display: isMobile ? 'flex' : 'block', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal'}}>
          <div onClick={() => setView('dashboard')} style={view === 'dashboard' ? styles.activeLink : styles.link}>📊 tableau de bord</div>
          <div onClick={() => setView('inventaire')} style={view === 'inventaire' ? styles.activeLink : styles.link}>📦 Stock actuel</div>
          <div onClick={() => setView('dettes')} style={view === 'dettes' ? styles.activeLink : styles.link}>👥 Créances / dettes</div>
          <div onClick={() => setView('equipe')} style={view === 'equipe' ? styles.activeLink : styles.link}>👥 Créer ton équipe</div>
        </nav>

        <div style={{...styles.footerNav, marginTop: isMobile ? '10px' : 'auto'}}>
          <div style={styles.userInfo}>{user?.email}</div>
          <button onClick={() => signOut(auth)} style={styles.logoutBtn}>Déconnexion</button>
        </div>
      </aside>

      <main style={{...styles.main, padding: isMobile ? '15px' : '30px'}}>
        <header style={{...styles.header, flexDirection: isMobile ? 'column' : 'row'}}>
          <h1 style={styles.viewTitle}>{view.toUpperCase()}</h1>
          {view !== 'dashboard' && (
            <input type="text" placeholder="Rechercher..." style={styles.searchBar} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          )}
        </header>

        {/* --- VUE : TABLEAU DE BORD (STATS + LISTES) --- */}
        {view === 'dashboard' && (
          <>
            <div style={{...styles.statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)'}}>
              <div style={{...styles.card, borderLeft: "5px solid #3498db"}}>
                <span style={styles.cardLabel}>Recettes Totales</span>
                <h2 style={styles.cardValue}>{stats.totalVentes.toLocaleString()} FC</h2>
              </div>
              <div style={{...styles.card, borderLeft: "5px solid #e74c3c"}}>
                <span style={styles.cardLabel}>Dettes Clients</span>
                <h2 style={{...styles.cardValue, color: "#e74c3c"}}>{stats.totalDettes.toLocaleString()} FC</h2>
              </div>
              <div style={{...styles.card, borderLeft: "5px solid #f39c12"}}>
                <span style={styles.cardLabel}>Alertes Stock</span>
                <h2 style={{...styles.cardValue, color: "#f39c12"}}>{stats.alertes}</h2>
              </div>
            </div>

            <div style={{...styles.lowerGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', display: 'grid', gap: '20px', marginTop: '20px'}}>
              {/* STOCKS CRITIQUES */}
              <section style={styles.tableSection}>
                <h3 style={styles.sectionTitle}>⚠️ Stocks Critiques (≤ 10)</h3>
                <div style={styles.scrollBox}>
                  {products.filter(p => p.action <= 10).map(p => (
                    <div key={p.id} style={styles.criticalItem}>
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 'bold'}}>{p.nom}</div>
                        <small style={{color: '#e74c3c'}}>Restant : {p.action}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* DERNIÈRES VENTES / CLIENTS */}
              <section style={styles.tableSection}>
                <h3 style={styles.sectionTitle}>🕒 Activité Récente</h3>
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

        {/* --- VUE : CRÉANCES (LISTE CLIENTS) --- */}
        {view === 'dettes' && (
          <div style={styles.tableSection}>
            {!selectedClient ? (
              <table style={styles.table}>
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

        {view === 'equipe' && <GestionEquipe />}
        
        {view === 'inventaire' && (
           <div style={styles.tableSection}>
             <table style={styles.table}>
                <thead><tr style={styles.thr}><th>Nom</th><th>Prix</th><th>Stock</th><th>Valeur Totale</th></tr></thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} style={styles.tr}>
                      <td style={styles.td}>{p.nom}</td>
                      <td style={styles.td}>{Number(p.prix).toLocaleString()} FC</td>
                      <td style={{...styles.td, color: p.action <= 5 ? 'red' : 'inherit'}}>{p.action}</td>
                      <td style={styles.td}><b>{(Number(p.prix) * Number(p.action)).toLocaleString()} FC</b></td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { display: "flex", minHeight: "100vh", backgroundColor: "#f0f2f5" },
  sidebar: { backgroundColor: "#1a2a3a", color: "white", padding: "20px", display: "flex", flexDirection: "column", boxSizing: 'border-box' },
  logoArea: { marginBottom: '30px', textAlign: 'center' },
  logo: { fontSize: "18px", margin: 0, fontWeight: '800' },
  adminBadge: { fontSize: '10px', background: '#3498db', padding: '3px 8px', borderRadius: '4px', marginTop: '5px', display: 'inline-block' },
  sideNav: { flex: 1 },
  link: { padding: "12px", cursor: "pointer", borderRadius: "8px", color: "#a0aec0", fontSize: '14px' },
  activeLink: { padding: "12px", backgroundColor: "#3498db", borderRadius: "8px", color: "white", fontWeight: "600" },
  footerNav: { borderTop: '1px solid #2d3748', paddingTop: '15px' },
  userInfo: { fontSize: '11px', color: '#718096', marginBottom: '10px', textAlign: 'center' },
  logoutBtn: { width: '100%', padding: '10px', background: '#e74c3c', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' },
  main: { flex: 1, overflowY: "auto" },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '10px' },
  viewTitle: { fontSize: '20px', color: '#2d3748', margin: 0 },
  searchBar: { padding: '10px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' },
  statsGrid: { display: "grid", gap: "15px" },
  card: { backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  cardLabel: { color: "#718096", fontSize: "11px" },
  cardValue: { fontSize: "22px", margin: "5px 0 0 0", fontWeight: 'bold' },
  tableSection: { background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  sectionTitle: { fontSize: '16px', marginBottom: '15px', color: '#2c3e50' },
  scrollBox: { maxHeight: '300px', overflowY: 'auto' },
  criticalItem: { padding: '10px', borderBottom: '1px solid #eee' },
  saleLog: { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px' },
  table: { width: "100%", borderCollapse: "collapse" },
  thr: { textAlign: "left", background: "#f8fafc", padding: '12px' },
  tr: { borderBottom: "1px solid #edf2f7" },
  td: { padding: "12px", fontSize: "14px" },
  detailsBtn: { padding: '5px 10px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  backBtn: { padding: '5px 10px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', marginBottom: '10px', cursor: 'pointer' },
  debtRow: { padding: '10px', background: '#fdf2f2', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', borderRadius: '5px' }
};