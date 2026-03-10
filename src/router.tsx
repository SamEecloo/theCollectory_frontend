import { createBrowserRouter, Outlet } from 'react-router-dom';
import AppLayout from "@/layouts/app-layout";
import AuthLayout from "@/layouts/auth-layout";
import Dashboard from "@/pages/Dashboard";
import PublicDashboard from "@/pages/PublicDashboard";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import UpsertCollection from "@/pages/UpsertCollection";
import ViewItem from "@/pages/ViewItem";
import UpsertItem from "@/pages/UpsertItem";
import ProtectedRoute from "@/components/protectedRoute";
import ViewCollection from "@/pages/ViewCollection";
import Profile from "@/pages/Profile";
import NotFound from '@/pages/NotFound';
import Statistics from '@/pages/Statistics';
import GridLayout from "@/pages/GridLayout";
//import LandingPage from '@/pages/LandingPage';
import ComingSoon from '@/pages/ComingSoon';
import Notifications from "@/pages/Notifications";
import Messages from "@/pages/Messages";
import { AuthProvider } from './context/AuthContext';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';


export const router = createBrowserRouter([
  {
      element: <AuthProvider><Outlet /></AuthProvider>,
      children: [
        { path: '/', element: <ComingSoon />},
        {
          element: <AuthLayout><Outlet /></AuthLayout>,
          children: [
              { path: '/login', element: <Login /> },
              { path: '/signup', element: <Signup /> },
              { path: '/forgot-password', element: <ForgotPassword /> },
              { path: '/reset-password', element: <ResetPassword /> },
          ]
        },        
        { path: '/404', element: <NotFound /> },
        {
          element: <AppLayout />,
          children: [
            { path: '/profile', element: <ProtectedRoute><Profile /></ProtectedRoute> },
            { path: '/dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
            { path: '/notifications', element: <ProtectedRoute><Notifications /></ProtectedRoute> },
            { path: '/messages', element: <ProtectedRoute><Messages /></ProtectedRoute> },
            { path: '/messages/:conversationId', element: <ProtectedRoute><Messages /></ProtectedRoute> },
            { path: '/statistics', element: <ProtectedRoute><Statistics /></ProtectedRoute> },
            { path: '/collections', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
            { path: '/collections/new', element: <ProtectedRoute><UpsertCollection /></ProtectedRoute> },
            { path: '/collections/:collectionName/edit', element: <ProtectedRoute><UpsertCollection /></ProtectedRoute> },
            { path: '/collections/:collectionName', element: <ProtectedRoute><ViewCollection /></ProtectedRoute> },
            { path: '/collections/:collectionName/wishlist', element: <ProtectedRoute><ViewCollection isWishlistView={true} /></ProtectedRoute> },
            { path: '/collections/:collectionName/grid-layout', element: <ProtectedRoute><GridLayout /></ProtectedRoute> },
            { path: '/collections/:collectionName/stats', element: <ProtectedRoute><Statistics /></ProtectedRoute> },
            { path: '/collections/:collectionName/add-item', element: <ProtectedRoute><UpsertItem /></ProtectedRoute> },
            { path: '/collections/:collectionName/items/:itemId/edit', element: <ProtectedRoute><UpsertItem /></ProtectedRoute> },
            { path: '/:username', element: <PublicDashboard /> },
            { path: '/:username/:collectionName', element: <ViewCollection isPublicView={true} /> },
            { path: '/:username/:collectionName/wishlist', element: <ViewCollection isPublicView={true} isWishlistView={true} /> },
            { path: '/:username/:collectionName/items/:itemId', element: <ViewItem /> },
            { path: '*', element: <NotFound /> },
          ]
        }
      ]
    },
]);

