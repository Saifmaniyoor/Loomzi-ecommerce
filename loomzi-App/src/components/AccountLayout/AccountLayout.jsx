
import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import AccountSidebar from "./AccountSidebar";
import { getProfile } from "../../services/profileApi";
import "./AccountLayout.css";

function AccountLayout() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await getProfile();
        setUser(data.user);
      } catch (error) {
        console.error("Account layout error:", error);
      }
    };

    fetchUser();

    const handleProfileUpdated = () => {
      fetchUser();
    };

    window.addEventListener(
      "loomzi:profile-updated",
      handleProfileUpdated
    );

    return () => {
      window.removeEventListener(
        "loomzi:profile-updated",
        handleProfileUpdated
      );
    };
  }, []);

  return (
    <div className="account-layout">
      <div className="account-layout-container">
        <AccountSidebar user={user} />

        <div className="account-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AccountLayout;
