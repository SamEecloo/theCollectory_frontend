import { createContext, useState, type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  token: string | null;
  username: string | null;
  setToken: (token: string | null) => void;
  login: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
  const [username, setUsernameState] = useState<string | null>(localStorage.getItem("username"));
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    if (saved) setToken(saved);
    if (savedUsername) setUsernameState(savedUsername);
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("token", newToken);
    } else {
      localStorage.removeItem("token");
    }
    setTokenState(newToken);
  };

  const login = (newToken: string, newUsername: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", newUsername);
    setTokenState(newToken);
    setUsernameState(newUsername);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setTokenState(null);
    setUsernameState(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{ token, username, setToken, login, logout, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;