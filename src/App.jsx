import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTrip from "./pages/admin/AdminTrip";
import TripPublicPage from "./pages/TripPublicPage";
import "./styles/atelier.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/trip/:id" element={<AdminTrip />} />
        <Route path="/trip/:slug" element={<TripPublicPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
