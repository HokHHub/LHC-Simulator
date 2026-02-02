import { createBrowserRouter, Navigate } from "react-router-dom";

import Layout from "./Layout";
import About from "./Components/About/About";
import Theory from "./Components/Theory/Theory";
import Simulation from "./Components/Simulation/Simulation";

import ProtectedRoute from "./components/ProtectedRoute";
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

      // защищённый маршрут
      {
        path: "simulation",
        element: (
          <ProtectedRoute>
            <Simulation />
          </ProtectedRoute>
        ),
      },
    ],
  },

  // редирект на главную (как было во втором примере)
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default router;
