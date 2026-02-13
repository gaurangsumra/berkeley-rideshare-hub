import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Events from "./pages/Events";
import MyRides from "./pages/MyRides";
import Profile from "./pages/Profile";
import EventDetail from "./pages/EventDetail";
import RideDetail from "./pages/RideDetail";
import UserProfile from "./pages/UserProfile";
import Notifications from "./pages/Notifications";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import HaasEventDetail from "./pages/HaasEventDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/haas-events/:eventUid" element={<HaasEventDetail />} />
          <Route path="/rides/:rideId" element={<RideDetail />} />
          <Route path="/users/:userId" element={<UserProfile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/my-rides" element={<MyRides />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<Admin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
