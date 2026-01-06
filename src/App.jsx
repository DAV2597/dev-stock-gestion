import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardAdmin from "./pages/DashboardAdmin";
import DashboardAjoint from "./pages/DashboardAjoint"; 
import DashboardSecretaire from "./pages/DashboardSecretaire";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Routes>
      {/* 1. Accès Public */}
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 2. Espace Admin - Strictement réservé à l'admin */}
      <Route
        path="/admin"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <DashboardAdmin />
          </PrivateRoute>
        }
      />

      {/* 3. Espace Adjoint - Accessible par l'admin et l'adjoint */}
      <Route
        path="/ajoint"
        element={
          <PrivateRoute allowedRoles={["admin", "ajoint"]}>
            <DashboardAjoint />
          </PrivateRoute>
        }
      />

      {/* 4. Espace Secretaire - Accessible par admin, adjoint et secretaire */}
      <Route
        path="/secretaire"
        element={
          <PrivateRoute allowedRoles={["admin", "ajoint", "secretaire"]}>
            <DashboardSecretaire />
          </PrivateRoute>
        }
      />

      {/* 5. Redirection de secours si l'URL n'existe pas */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}

export default App;