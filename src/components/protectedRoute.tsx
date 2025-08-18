// src/components/ProtectedRoute.tsx
import { useEffect, useState, type JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import api from "@/lib/api";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token, setToken } = useAuth();
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    const validate = async () => {
      if (!token) return setIsValid(false);
      try {
        await api.get("/auth/validate-token", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsValid(true);
      } catch {
        setToken(null);
        localStorage.removeItem("token");
        setIsValid(false);
      }
    };
    validate();
  }, [setToken, token]);

  if (isValid === null) return null; // or loading spinner
  if (!isValid) return <Navigate to="/login" />;
  return children;
}
