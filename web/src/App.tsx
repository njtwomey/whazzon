import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LandingPage } from "@/routes/landing-page";
import { LocationPage } from "@/routes/location-page";

/**
 * Routes are keyed by location, so a second city is a URL rather than a fork:
 *
 *   /                       pick a city
 *   /gb-bristol             everything on there
 *   /gb-bristol/theatre     one category
 */
export default function App() {
  return (
    <TooltipProvider>
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/:locationId" element={<LocationPage />} />
          <Route path="/:locationId/:category" element={<LocationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </TooltipProvider>
  );
}
