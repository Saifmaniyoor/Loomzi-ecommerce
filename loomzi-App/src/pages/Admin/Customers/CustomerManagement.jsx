import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";
import "./CustomerManagement.css";

const API_URL = "http://localhost:5000";

function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  const limit = 10;

  useEffect(() => {
    let cancelled = false;

    const fetchCustomers = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search,
          page: String(page),
          limit: String(limit),
        });

        const response = await fetch(
          `${API_URL}/api/admin/customers?${params}`,
          { credentials: "include" },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to fetch customers");
        }

        if (!cancelled) {
          setCustomers(data.customers || []);
          setTotalPages(data.totalPages || 1);
          setTotalCustomers(data.totalCustomers || 0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCustomers();

    return () => {
      cancelled = true;
    };
  }, [search, page]);

  const changeStatus = async (customer) => {
    const action = customer.isBlocked ? "unblock" : "block";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${customer.fullName}?`,
    );

    if (!confirmed) return;

    setUpdatingId(customer._id);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/customers/${customer._id}/${action}`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update customer");
      }

      setCustomers((previous) =>
        previous.map((item) =>
          item._id === customer._id
            ? { ...item, isBlocked: data.customer.isBlocked }
            : item,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="customer-management">
      <div className="customer-heading">
        <div>
          <h1>Customer Management</h1>
          <p>View and manage Loomzi customers.</p>
        </div>
        <span>Total Customers: {totalCustomers}</span>
      </div>

      <input
        className="customer-search"
        type="search"
        placeholder="Search name, email or phone..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      {error && <p className="customer-error">{error}</p>}

      <div className="customer-table-wrapper">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5">Loading customers...</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan="5">No customers found.</td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer._id}>
                  <td>{customer.fullName}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>
                    <span
                      className={
                        customer.isBlocked
                          ? "customer-status blocked"
                          : "customer-status active"
                      }
                    >
                      {customer.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td>
                    <button
                      className={
                        customer.isBlocked
                          ? "customer-action unblock"
                          : "customer-action block"
                      }
                      disabled={updatingId === customer._id}
                      onClick={() => changeStatus(customer)}
                    >
                      {updatingId === customer._id
                        ? "Updating..."
                        : customer.isBlocked
                          ? "Unblock"
                          : "Block"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="customer-pagination">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default CustomerManagement;
