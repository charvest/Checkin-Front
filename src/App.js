import { BrowserRouter, useLocation } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import TawkToWidget from "./components/LandingPage/TawkToWidget";

function AppShell() {
  const { pathname } = useLocation();

  // TEMP: show everywhere until you confirm it loads
  // const enabled = true;

  // Then switch to landing-only when confirmed:
  const enabled = pathname === "/";

  return (
    <>
      <TawkToWidget
        enabled={enabled}
        anchorSelector="#landing-hero-illustration"
        anchorOffset={{ x: 16, y: 16 }}
        fallback={{ bottom: 24, right: 24 }}
        debug={false}
      />
      <AppRoutes />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
