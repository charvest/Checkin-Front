import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import LoginRequiredModal from "../components/ui/LoginRequiredModal";

export default function RequireLoginModal({ featureName = "this feature" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthed } = useAuth();

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAuthed) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [isAuthed]);

  const fromPath = useMemo(() => location.pathname, [location.pathname]);

  // ✅ If logged in → allow page
  if (isAuthed) return <Outlet />;

  // ❌ If not logged in → block page + show modal
  return (
    <LoginRequiredModal
      open={open}
      featureName={featureName}
      onClose={() => {
        setOpen(false);
        navigate("/", { replace: true });
      }}
      onLogin={() => {
        setOpen(false);
        navigate("/login", {
          replace: true,
          state: { from: fromPath },
        });
      }}
    />
  );
}
