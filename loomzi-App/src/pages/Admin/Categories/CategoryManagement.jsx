import { useEffect, useState } from "react";
import "./CategoryManagement.css";

const API_URL = "http://localhost:5000";

function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCategories, setTotalCategories] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search,
          page: String(page),
          limit: "10",
        });

        const response = await fetch(
          `${API_URL}/api/admin/categories?${params}`,
          {
            credentials: "include",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch categories");
        }

        if (!cancelled) {
          setCategories(data.categories || []);
          setTotalCategories(data.totalCategories || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Something went wrong");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => {
      cancelled = true;
    };
  }, [search, page, refreshKey]);

  const openAddForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setDescription("");
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEditForm = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setDescription(category.description || "");
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCategory(null);
    setCategoryName("");
    setDescription("");
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      setError("Category name is required");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = Boolean(editingCategory);

      const url = isEditing
        ? `${API_URL}/api/admin/categories/${editingCategory._id}`
        : `${API_URL}/api/admin/categories`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: categoryName.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save category");
      }

      closeForm();

      setSuccess(
        isEditing
          ? "Category updated successfully"
          : "Category added successfully",
      );

      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const changeCategoryStatus = async (category) => {
    const action = category.isListed ? "unlist" : "list";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${category.name}?`,
    );

    if (!confirmed) return;

    setUpdatingId(category._id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/categories/${category._id}/${action}`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update category status");
      }

      setCategories((previous) =>
        previous.map((item) =>
          item._id === category._id
            ? { ...item, isListed: data.category.isListed }
            : item,
        ),
      );

      setSuccess(
        action === "list"
          ? "Category listed successfully"
          : "Category unlisted successfully",
      );
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="category-management">
      <div className="category-heading">
        <div>
          <h1>Category Management</h1>
          <p>Manage Loomzi product categories.</p>
        </div>

        <div className="category-heading-actions">
          <span>Total Categories: {totalCategories}</span>

          <button
            type="button"
            className="category-add-btn"
            onClick={openAddForm}
          >
            + Add Category
          </button>
        </div>
      </div>

      {showForm && (
        <div className="category-form-card">
          <h2>{editingCategory ? "Edit Category" : "Add Category"}</h2>

          <form onSubmit={handleSaveCategory}>
            <label htmlFor="category-name">Category Name</label>

            <input
              id="category-name"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter category name"
              required
            />

            <label htmlFor="category-description">Description</label>

            <textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter category description"
              rows={3}
            />

            <div className="category-form-actions">
              <button type="button" onClick={closeForm} disabled={saving}>
                Cancel
              </button>

              <button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingCategory
                    ? "Update Category"
                    : "Add Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        className="category-search"
        type="search"
        placeholder="Search categories..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      {error && <p className="category-error">{error}</p>}
      {success && <p className="category-success">{success}</p>}

      <div className="category-table-wrapper">
        <table className="category-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4">Loading categories...</td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan="4">No categories found.</td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr key={category._id}>
                  <td>{category.name}</td>

                  <td>{category.description || "—"}</td>

                  <td>
                    <span
                      className={
                        category.isListed
                          ? "category-status listed"
                          : "category-status unlisted"
                      }
                    >
                      {category.isListed ? "Listed" : "Unlisted"}
                    </span>
                  </td>

                  {/* Action buttons belong inside each category row */}
                  <td>
                    <div className="category-row-actions">
                      <button
                        type="button"
                        className="category-edit-btn"
                        onClick={() => openEditForm(category)}
                        disabled={updatingId !== null}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className={
                          category.isListed
                            ? "category-unlist-btn"
                            : "category-list-btn"
                        }
                        onClick={() => changeCategoryStatus(category)}
                        disabled={updatingId !== null}
                      >
                        {updatingId === category._id
                          ? "Updating..."
                          : category.isListed
                            ? "Unlist"
                            : "List"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="category-pagination">
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

export default CategoryManagement;
