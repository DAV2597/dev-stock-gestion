import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardAdmin from "./pages/DashboardAdmin";
im
<<<<<<< HEAD
import DashboardAdjoint from "./pages/DashboardAjoint"; 
=======
import DashboardAjoint from "./pages/DashboardAjoint";
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
import DashboardSecretaire from "./pages/DashboardSecretaire";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Routes>
<<<<<<< HEAD
      {/* 1. Accès Public */}
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 2. Espace Admin - Strictement réservé à l'admin */}
=======
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
      <Route
        path="/admin"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <DashboardAdmin />
          </PrivateRoute>
        }
      />

<<<<<<< HEAD
      {/* 3. Espace Ajoint - Accessible par l'admin et l'ajoint */}
=======
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
      <Route
        path="/ajoint"
        element={
          <PrivateRoute allowedRoles={["admin", "ajoint"]}>
<<<<<<< HEAD
            <DashboardAdjoint />
=======
            <DashboardAjoint />
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
          </PrivateRoute>
        }
      />

<<<<<<< HEAD
      {/* 4. Espace Secretaire - Accessible par admin, ajoint et secretaire */}
=======
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
      <Route
        path="/secretaire"
        element={
          <PrivateRoute allowedRoles={["admin", "ajoint", "secretaire"]}>
            <DashboardSecretaire />
          </PrivateRoute>
        }
      />
<<<<<<< HEAD

      {/* 5. Redirection de secours si l'URL n'existe pas */}
      <Route path="*" element={<Login />} />
=======
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
    </Routes>
  );
}

<<<<<<< HEAD
export default App;
=======
export default App;
>>>>>>> 3bd0c86ee8b1bb7ff6441068087eff367a8b7bd9
