
import { Search, UserCircle } from "lucide-react";

function AdminHeader({ admin }) {
  return (
    <header className="loomzi-admin-header">
      <div className="loomzi-header-search">
        <Search size={19} />
        <input
          type="text"
          placeholder="Search orders, products or customers..."
          aria-label="Search"
          disabled
          title="Search coming soon"
        />
      </div>

      <div className="loomzi-header-profile">
        <div className="loomzi-profile-info">
          <strong>{admin?.fullName || "Super Admin"}</strong>
          <span>Super Admin</span>
        </div>

        <div className="loomzi-profile-avatar">
          <UserCircle size={36} />
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
