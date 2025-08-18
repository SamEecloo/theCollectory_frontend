import { Routes, Route } from "react-router-dom";
import AppLayout from "@/layouts/app-layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import UpsertCollection from "@/pages/UpsertCollection";
import UpsertItem from "@/pages/UpsertItem";
import ProtectedRoute from "@/components/protectedRoute";
import ViewCollection from "@/pages/ViewCollection";


function App() {
  return (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AppLayout />}>  
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/collections" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/collections/new" element={<ProtectedRoute><UpsertCollection /></ProtectedRoute>} />
        <Route path="/collections/:collectionId/edit" element={<ProtectedRoute><UpsertCollection /></ProtectedRoute>} />
        <Route path="/collections/:collectionId" element={<ProtectedRoute><ViewCollection /></ProtectedRoute>} />
        <Route path="/collections/:collectionId/add-item" element={<ProtectedRoute><UpsertItem /></ProtectedRoute>} />
        <Route path="/collections/:collectionId/items/:itemId/edit" element={<ProtectedRoute><UpsertItem /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default App;
