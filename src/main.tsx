import React from "react";
import ReactDOM from "react-dom/client";
import ReactGA from 'react-ga4';
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/context/theme-context";
import { router } from "./router";
import "./index.css";
import { ThemedToaster } from './components/themed-toaster';

ReactGA.initialize('G-2E1LPR4HV6');

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
      <ThemedToaster />
  </ThemeProvider>
  </React.StrictMode>
);