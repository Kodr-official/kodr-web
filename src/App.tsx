import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";

import Index from "./pages/Index";
import Browse from "./pages/Browse";
import Projects from "./pages/Projects";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CoderProfile from "./pages/CoderProfile";
import TeamProfile from "./pages/TeamProfile";
import Teams from "./pages/Teams";
import CreateTeam from "./pages/CreateTeam";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Study from "./pages/Study";
import PaymentReturn from "./pages/PaymentReturn";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="kodr-ui-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/create" element={<CreateTeam />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/study" element={<Study />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/coder/:id" element={<CoderProfile />} />
              <Route path="/team/:id" element={<TeamProfile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/payment/return" element={<PaymentReturn />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
