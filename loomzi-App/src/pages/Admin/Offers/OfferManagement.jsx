
import { useCallback, useEffect, useRef, useState } from "react";
import "./OfferManagement.css";

const API = "http://localhost:5000";

const blank = () => ({
  name: "",
  type: "product",
  target: "",
  discountPercentage: "10",
  maximumDiscount: "100",
  startsAt: new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16),
  expiresAt: "",
  isActive: true,
  bannerImage: "",
});

const toLocal = (value) =>
  value
    ? new Date(
        new Date(value).getTime() -
          new Date(value).getTimezoneOffset() * 60000
      ).toISOString().slice(0, 16)
    : "";

const request = async (path, options = {}) => {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed (${response.status})`
    );
  }

  return data;
};

export default function OfferManagement() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);

  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fileInputRef = useRef(null);

  // ====================================
  // Load Offers
  // ====================================
  const load = useCallback(async () => {
    try {
      const data = await request("/api/admin/offers");
      setOffers(data.offers || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();

    Promise.all([
      request("/api/admin/products?page=1&limit=100"),
      request("/api/admin/categories?page=1&limit=100"),
    ])
      .then(([p, c]) => {
        setProducts(p.products || []);
        setCategories(c.categories || []);
      })
      .catch((e) => setError(e.message));
  }, [load]);

  // ====================================
  // Update Form
  // ====================================
  const update = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "type" ? { target: "" } : {}),
    }));
  };

  // ====================================
  // Select Banner Image
  // ====================================
  const handleBannerChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Banner image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setBannerFile(file);

    const previewUrl = URL.createObjectURL(file);
    setBannerPreview(previewUrl);
  };

  // ====================================
  // Remove Banner
  // ====================================
  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview("");
    update("bannerImage", "");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ====================================
  // Reset Form
  // ====================================
  const reset = () => {
    setForm(blank());
    setEditing(null);
    setBannerFile(null);
    setBannerPreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ====================================
  // Upload Banner Image
  // ====================================
  const uploadBanner = async (file) => {
    const formData = new FormData();
    formData.append("image", file);

    // This backend endpoint will be
    // implemented in the next step.
    const response = await fetch(
      `${API}/api/admin/offers/upload-banner`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Banner image upload failed"
      );
    }

    if (!data.imageUrl) {
      throw new Error(
        "Upload response did not include imageUrl"
      );
    }

    return data.imageUrl;
  };

  // ====================================
  // Save Offer
  // ====================================
  const save = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      let bannerImage = form.bannerImage;

      // Upload a newly selected image first.
      if (bannerFile) {
        bannerImage = await uploadBanner(bannerFile);
      }

      const payload = {
        ...form,
        bannerImage,
        discountPercentage: Number(
          form.discountPercentage
        ),
        maximumDiscount: Number(
          form.maximumDiscount
        ),
        startsAt: new Date(
          form.startsAt
        ).toISOString(),
        expiresAt: new Date(
          form.expiresAt
        ).toISOString(),
      };

      await request(
        editing
          ? `/api/admin/offers/${editing}`
          : "/api/admin/offers",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setNotice(
        editing
          ? "Offer updated successfully"
          : "Offer created successfully"
      );

      reset();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ====================================
  // Edit Offer
  // ====================================
  const edit = (offer) => {
    setEditing(offer._id);

    setForm({
      name: offer.name,
      type: offer.type,
      target: offer.target,
      discountPercentage: String(
        offer.discountPercentage
      ),
      maximumDiscount: String(
        offer.maximumDiscount
      ),
      startsAt: toLocal(offer.startsAt),
      expiresAt: toLocal(offer.expiresAt),
      isActive: offer.isActive,
      bannerImage: offer.bannerImage || "",
    });

    setBannerFile(null);
    setBannerPreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ====================================
  // Toggle Offer
  // ====================================
  const toggle = async (offer) => {
    setError("");

    try {
      await request(
        `/api/admin/offers/${offer._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !offer.isActive,
          }),
        }
      );

      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  // ====================================
  // Delete Offer
  // ====================================
  const remove = async (offer) => {
    if (
      !window.confirm(
        `Delete offer "${offer.name}"?`
      )
    ) {
      return;
    }

    setError("");

    try {
      await request(
        `/api/admin/offers/${offer._id}`,
        { method: "DELETE" }
      );

      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const targets =
    form.type === "product"
      ? products
      : categories;

  const targetName = (offer) =>
    (
      offer.type === "product"
        ? products
        : categories
    ).find(
      (item) => item._id === offer.target
    )?.name || offer.target;

  const displayedBanner =
    bannerPreview || form.bannerImage;

  return (
    <main className="loomzi-offers">
      <header>
        <h1>Offer Management</h1>
        <p>
          Product and category offers · highest
          actual discount wins
        </p>
      </header>

      {error && (
        <p
          className="offer-alert offer-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          className="offer-alert offer-success"
          role="status"
        >
          {notice}
        </p>
      )}

      {/* ==========================
          CREATE / EDIT OFFER
      ========================== */}
      <section className="offer-panel">
        <h2>
          {editing
            ? "Edit offer"
            : "Create new offer"}
        </h2>

        <form
          onSubmit={save}
          className="offer-form"
        >
          <label>
            Offer name
            <input
              required
              maxLength="100"
              value={form.name}
              onChange={(e) =>
                update("name", e.target.value)
              }
              placeholder="Kids Fashion Sale"
            />
          </label>

          <label>
            Offer type
            <select
              value={form.type}
              onChange={(e) =>
                update("type", e.target.value)
              }
            >
              <option value="product">
                Product
              </option>
              <option value="category">
                Category
              </option>
            </select>
          </label>

          <label>
            {form.type === "product"
              ? "Product"
              : "Category"}

            <select
              required
              value={form.target}
              onChange={(e) =>
                update("target", e.target.value)
              }
            >
              <option value="">
                Select {form.type}
              </option>

              {targets.map((item) => (
                <option
                  key={item._id}
                  value={item._id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Discount percentage (%)
            <input
              required
              type="number"
              min="1"
              max="100"
              step="0.01"
              value={form.discountPercentage}
              onChange={(e) =>
                update(
                  "discountPercentage",
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Maximum discount (₹)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.maximumDiscount}
              onChange={(e) =>
                update(
                  "maximumDiscount",
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Start date & time
            <input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) =>
                update(
                  "startsAt",
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Expiry date & time
            <input
              required
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) =>
                update(
                  "expiresAt",
                  e.target.value
                )
              }
            />
          </label>

          {/* ==========================
              BANNER IMAGE UPLOAD
          ========================== */}
          <div className="offer-banner-field">
            <label htmlFor="offer-banner-input">
              Offer banner background image
            </label>

            <p className="offer-banner-help">
              Recommended: wide image (3:1).
              JPG, PNG, or WebP. Maximum 5 MB.
            </p>

            <input
              id="offer-banner-input"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBannerChange}
            />

            {displayedBanner && (
              <div className="offer-banner-preview">
                <img
                  src={displayedBanner}
                  alt="Offer banner preview"
                />

                <div className="offer-banner-overlay">
                  <span>LIMITED-TIME OFFER</span>
                  <h3>
                    {form.name || "Offer Name"}
                  </h3>
                  <p>
                    {form.discountPercentage}%
                    OFF
                  </p>
                  <span className="offer-preview-button">
                    Shop Now →
                  </span>
                </div>
              </div>
            )}

            {displayedBanner && (
              <button
                type="button"
                className="secondary"
                onClick={removeBanner}
                disabled={busy}
              >
                Remove banner image
              </button>
            )}
          </div>

          <label className="offer-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                update(
                  "isActive",
                  e.target.checked
                )
              }
            />
            Active
          </label>

          <div className="offer-actions">
            <button
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Saving…"
                : editing
                ? "Save changes"
                : "Create offer"}
            </button>

            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={reset}
                disabled={busy}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ==========================
          ALL OFFERS
      ========================== */}
      <section className="offer-panel">
        <h2>
          All offers ({offers.length})
        </h2>

        <div className="offer-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Applies to</th>
                <th>Discount</th>
                <th>Banner</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {offers.map((offer) => (
                <tr key={offer._id}>
                  <td>
                    <strong>
                      {offer.name}
                    </strong>
                  </td>

                  <td>
                    {offer.type}:{" "}
                    {targetName(offer)}
                  </td>

                  <td>
                    {offer.discountPercentage}%
                    (max ₹
                    {offer.maximumDiscount})
                  </td>

                  <td>
                    {offer.bannerImage ? (
                      <img
                        className="offer-table-banner"
                        src={offer.bannerImage}
                        alt={`${offer.name} banner`}
                      />
                    ) : (
                      "No image"
                    )}
                  </td>

                  <td>
                    {new Date(
                      offer.startsAt
                    ).toLocaleString()}
                    {" – "}
                    {new Date(
                      offer.expiresAt
                    ).toLocaleString()}
                  </td>

                  <td>
                    {!offer.isActive
                      ? "Inactive"
                      : new Date(
                          offer.expiresAt
                        ) <= new Date()
                      ? "Expired"
                      : new Date(
                          offer.startsAt
                        ) > new Date()
                      ? "Scheduled"
                      : "Active"}
                  </td>

                  <td className="offer-row-actions">
                    <button
                      type="button"
                      onClick={() =>
                        edit(offer)
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggle(offer)
                      }
                    >
                      {offer.isActive
                        ? "Disable"
                        : "Enable"}
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        remove(offer)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!offers.length && (
                <tr>
                  <td colSpan="7">
                    No offers created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
