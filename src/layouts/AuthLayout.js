import NavbarAuth from "../components/NavbarAuth";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-white">
      <NavbarAuth />
      <div className="px-6 py-6">
        <Outlet />
      </div>
    </div>
  );
}
