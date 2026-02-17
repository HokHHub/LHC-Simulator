import { createBrowserRouter, Navigate } from "react-router-dom";

import Layout from "./Layout";
import About from "./Components/About/About";
import Theory from "./Components/Theory/Theory";
import TheoryParticles from "./Components/TheoryParticles/TheoryParticles";
import TheoryLHC from "./Components/TheoryLHC/TheoryLHC";
import TheorySimulation from "./Components/TheorySimulation/TheorySimulation";
import Simulation from "./Components/Simulation/Simulation";
import ProfilePage from "./pages/Profile/ProfilePage";
import ProtectedRoute from "./Components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

const router = createBrowserRouter([
  // публичные страницы авторизации
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },

  // основной layout со вложенными страницами
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <About /> },
      { path: "theory", element: <Theory /> },
      { path: "theory/particles", element: <TheoryParticles /> },
      { path: "theory/lhc", element: <TheoryLHC /> },
      { path: "theory/simulation", element: <TheorySimulation /> },

      // защищённый маршрут
      {
        path: "simulation",
        element: (
          <ProtectedRoute>
            <Simulation />
          </ProtectedRoute>
        ),
      },

      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      }
    
    ],
  },

  // редирект на главную (как было во втором примере)
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default router;
