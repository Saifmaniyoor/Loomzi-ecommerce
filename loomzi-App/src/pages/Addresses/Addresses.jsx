
import { useEffect, useState } from "react";
import {
  FaMapMarkerAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheckCircle,
} from "react-icons/fa";

import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../../services/addressApi";

import "./Addresses.css";

const emptyForm = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  addressType: "Home",
};

function Addresses() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAddresses = async () => {
    const data = await getAddresses();
    setAddresses(data.addresses || []);
  };

  useEffect(() => {
    let active = true;

    getAddresses()
      .then((data) => {
        if (active) {
          setAddresses(data.addresses || []);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openAddForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = (address) => {
    const values = {};

    for (const key of Object.keys(emptyForm)) {
      values[key] = address[key] ?? emptyForm[key];
    }

    setForm(values);
    setEditingId(address._id);
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (editingId) {
        await updateAddress(editingId, form);
        setMessage("Address updated successfully");
      } else {
        await addAddress(form);
        setMessage("Address added successfully");
      }

      await loadAddresses();
      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this address?")) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await deleteAddress(id);
      await loadAddresses();
      setMessage("Address deleted successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = async (id) => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await setDefaultAddress(id);
      await loadAddresses();
      setMessage("Default address updated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p>Loading addresses...</p>;
  }

  return (
    <div className="addresses-page">
      <div className="addresses-heading">
        <div>
          <h1>My Addresses</h1>
          <p>Manage your saved delivery addresses.</p>
        </div>

        {!showForm && (
          <button
            className="addresses-primary-btn"
            onClick={openAddForm}
            disabled={busy}
          >
            <FaPlus /> Add New Address
          </button>
        )}
      </div>

      {error && (
        <p className="addresses-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="addresses-success" role="status">
          {message}
        </p>
      )}

      {showForm ? (
        <section className="addresses-card">
          <h2>
            {editingId ? "Edit Address" : "Add New Address"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="addresses-form-grid">
              {[
                ["fullName", "Full Name"],
                ["phone", "Phone Number"],
                ["addressLine1", "Address Line 1"],
                ["addressLine2", "Address Line 2"],
                ["landmark", "Landmark"],
                ["city", "City"],
                ["state", "State"],
                ["pincode", "Pincode"],
              ].map(([name, label]) => (
                <div className="addresses-field" key={name}>
                  <label htmlFor={`address-${name}`}>
                    {label}
                  </label>

                  <input
                    id={`address-${name}`}
                    name={name}
                    value={form[name]}
                    onChange={handleChange}
                    required={[
                      "fullName",
                      "phone",
                      "addressLine1",
                      "city",
                      "state",
                      "pincode",
                    ].includes(name)}
                    pattern={
                      name === "phone"
                        ? "[6-9][0-9]{9}"
                        : name === "pincode"
                        ? "[0-9]{6}"
                        : undefined
                    }
                    maxLength={
                      name === "phone"
                        ? 10
                        : name === "pincode"
                        ? 6
                        : undefined
                    }
                  />
                </div>
              ))}

              <div className="addresses-field">
                <label htmlFor="address-type">
                  Address Type
                </label>

                <select
                  id="address-type"
                  name="addressType"
                  value={form.addressType}
                  onChange={handleChange}
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="addresses-form-actions">
              <button
                type="submit"
                className="addresses-primary-btn"
                disabled={busy}
              >
                {busy ? "Saving..." : "Save Address"}
              </button>

              <button
                type="button"
                className="addresses-secondary-btn"
                onClick={closeForm}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="addresses-list">
          {addresses.length === 0 ? (
            <section className="addresses-card addresses-empty">
              <FaMapMarkerAlt />
              <h2>No saved addresses</h2>
              <p>Add an address to make checkout easier.</p>
              <button
                className="addresses-primary-btn"
                onClick={openAddForm}
              >
                Add Address
              </button>
            </section>
          ) : (
            addresses.map((address) => (
              <article
                className="addresses-card"
                key={address._id}
              >
                <div className="addresses-card-top">
                  <div className="addresses-badges">
                    <span className="addresses-type">
                      {address.addressType}
                    </span>

                    {address.isDefault && (
                      <span className="addresses-default">
                        <FaCheckCircle /> Default
                      </span>
                    )}
                  </div>
                </div>

                <h3>{address.fullName}</h3>

                <p>{address.addressLine1}</p>

                {address.addressLine2 && (
                  <p>{address.addressLine2}</p>
                )}

                {address.landmark && (
                  <p>Landmark: {address.landmark}</p>
                )}

                <p>
                  {address.city}, {address.state} -{" "}
                  {address.pincode}
                </p>

                <p>Phone: {address.phone}</p>

                <div className="addresses-card-actions">
                  <button
                    type="button"
                    onClick={() => openEditForm(address)}
                    disabled={busy}
                  >
                    <FaEdit /> Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(address._id)
                    }
                    disabled={busy}
                  >
                    <FaTrash /> Delete
                  </button>

                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSetDefault(address._id)
                      }
                      disabled={busy}
                    >
                      <FaCheckCircle /> Set as Default
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Addresses;
