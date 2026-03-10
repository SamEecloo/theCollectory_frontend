// src/pages/Home.tsx (NEW FILE)
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user has valid token
        await api.get('/auth/validate-token');
        // Logged in - go to dashboard
        navigate('/dashboard');
      } catch {
        // Not logged in - go to login
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  // Show loading while checking
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}