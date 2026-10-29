import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import AnnouncementBar from "../AnnouncementBar/AnnouncementBar";

function MainLayout() {
  const { pathname } = useLocation();

  // Show announcements only on product pages
  const showAnnouncement =
    pathname === "/products" ||
    /^\/products\/[^/]+\/?$/.test(pathname);

  return (
    <>
      <Navbar />

      {showAnnouncement && <AnnouncementBar />}

      <Outlet />

      <Footer />
    </>
  );
}

export default MainLayout;