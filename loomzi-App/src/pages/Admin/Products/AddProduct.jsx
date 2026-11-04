import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import "./AddProduct.css";

const API_URL = "";

const AGE_SIZES = [

  "0-3 months",

  "3-6 months",

  "6-12 months",

  "1-2 years",

  "2-3 years",

  "3-4 years",

  "4-5 years",

  "5-6 years",

  "6-7 years",

  "7-8 years",

  "8-9 years",

  "9-10 years",

  "10-11 years",

  "11-12 years",

];

const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const createEmptyVariant = () => ({

  color: "",

  size: "",

  stock: "",

  price: "",

  sku: "",

});

// Built-in image cropper: no additional npm package or CSS file required.
function ImageCropper({ file, onSave, onCancel }) {
  const [source, setSource] = useState("");
  const [dimensions, setDimensions] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [working, setWorking] = useState(false);
  const [cropError, setCropError] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    setDimensions(null);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    setCropError("");
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const saveCrop = async () => {
    if (!dimensions || working) return;
    setWorking(true);
    setCropError("");
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      const size = 800;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image cropping is not supported in this browser.");
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const maxX = Math.max(0, (width - size) / 2);
      const maxY = Math.max(0, (height - size) / 2);
      const drawX = (size - width) / 2 + (horizontal / 100) * maxX;
      const drawY = (size - height) / 2 + (vertical / 100) * maxY;
      ctx.drawImage(image, drawX, drawY, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Unable to create the cropped image.");
      const filename = file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg";
      const cropped = new File([blob], filename, { type: "image/jpeg" });
      if (cropped.size > 5 * 1024 * 1024) throw new Error("Cropped image exceeds 5 MB.");
      onSave(cropped);
    } catch (err) {
      setCropError(err.message || "Could not crop this image.");
    } finally {
      setWorking(false);
    }
  };

  const baseScale = dimensions ? Math.max(320 / dimensions.width, 320 / dimensions.height) : 1;
  const shownWidth = dimensions ? dimensions.width * baseScale * zoom : 320;
  const shownHeight = dimensions ? dimensions.height * baseScale * zoom : 320;
  const shiftX = Math.max(0, (shownWidth - 320) / 2) * horizontal / 100;
  const shiftY = Math.max(0, (shownHeight - 320) / 2) * vertical / 100;
  const sliderStyle = { width: "100%" };

  return (
    <div role="dialog" aria-modal="true" aria-label="Crop product image"
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.72)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <div style={{ background: "white", color: "#222", borderRadius: 12, padding: 20, width: "min(100%, 420px)", maxHeight: "95vh", overflowY: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Crop product image</h3>
        <p style={{ fontSize: 13 }}>Adjust the square crop, then click Use cropped image.</p>
        <div style={{ width: 320, height: 320, maxWidth: "100%", margin: "0 auto", position: "relative", overflow: "hidden", background: "#eee" }}>
          {source && <img src={source} alt="Image crop preview"
            onLoad={(e) => setDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            style={{ position: "absolute", width: shownWidth, height: shownHeight, maxWidth: "none", left: `calc(50% + ${shiftX}px)`, top: `calc(50% + ${shiftY}px)`, transform: "translate(-50%, -50%)" }} />}
        </div>
        <label style={{ display: "block", marginTop: 14 }}>Zoom: {zoom.toFixed(1)}×
          <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={sliderStyle} />
        </label>
        <label style={{ display: "block" }}>Move left / right
          <input type="range" min="-100" max="100" value={horizontal} onChange={(e) => setHorizontal(Number(e.target.value))} style={sliderStyle} />
        </label>
        <label style={{ display: "block" }}>Move up / down
          <input type="range" min="-100" max="100" value={vertical} onChange={(e) => setVertical(Number(e.target.value))} style={sliderStyle} />
        </label>
        {cropError && <p role="alert" style={{ color: "#b91c1c" }}>{cropError}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onCancel} disabled={working}>Cancel</button>
          <button type="button" onClick={saveCrop} disabled={!dimensions || working}>
            {working ? "Cropping..." : "Use cropped image"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProduct() {

  const navigate = useNavigate();

  const { id } = useParams();

  const isEditMode = Boolean(id);

  const [categories, setCategories] = useState([]);

  const [loadingCategories, setLoadingCategories] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [loadingProduct, setLoadingProduct] = useState(isEditMode);

  const [selectedImages, setSelectedImages] = useState([]);
  const [cropQueue, setCropQueue] = useState([]);

  const [uploadingImages, setUploadingImages] = useState(false);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({

    name: "",

    description: "",

    category: "",

    price: "",

    offerPrice: "",

    sizeType: "none",

    stock: "",

    images: [],

    variants: [],

  });

  // =====================================

  // 1. FETCH CATEGORIES

  // =====================================

  useEffect(() => {

    let cancelled = false;

    const fetchCategories = async () => {

      try {

        const response = await fetch(

          `${API_URL}/api/admin/categories?limit=100`,

          {

            credentials: "include",

          },

        );

        const data = await response.json();

        if (!response.ok) {

          throw new Error(data.message || "Failed to load categories");

        }

        if (!cancelled) {

          setCategories(

            (data.categories || []).filter((category) => category.isListed),

          );

        }

      } catch (err) {

        if (!cancelled) {

          setError(err.message || "Failed to load categories");

        }

      } finally {

        if (!cancelled) {

          setLoadingCategories(false);

        }

      }

    };

    fetchCategories();

    return () => {

      cancelled = true;

    };

  }, []);

  useEffect(() => {

    if (!isEditMode) return;

    let cancelled = false;

    const fetchProduct = async () => {

      try {

        const response = await fetch(`${API_URL}/api/admin/products/${id}`, {

          credentials: "include",

        });

        const data = await response.json();

        if (!response.ok) {

          throw new Error(data.message || "Failed to load product");

        }

        const product = data.product;

        if (!cancelled) {

          setForm({

            name: product.name || "",

            description: product.description || "",

            category: product.category?._id || product.category || "",

            price: String(product.price ?? ""),

            offerPrice: product.offerPrice == null ? "" : String(product.offerPrice),

            sizeType: product.sizeType || "none",

            stock: String(product.stock ?? 0),

            images: product.images || [],

            variants: (product.variants || []).map((variant) => ({

              color: variant.color || "Default",

              size: variant.size || "",

              stock: String(variant.stock ?? 0),

              price:

                variant.price === undefined || variant.price === null

                  ? ""

                  : String(variant.price),

              sku: variant.sku || "",

            })),

          });

        }

      } catch (err) {

        if (!cancelled) {

          setError(err.message);

        }

      } finally {

        if (!cancelled) {

          setLoadingProduct(false);

        }

      }

    };

    fetchProduct();

    return () => {

      cancelled = true;

    };

  }, [id, isEditMode]);


  useEffect(() => {
    const urls = selectedImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedImages]);

  // Crop each selected image before adding it to the upload list.
  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (form.images.length + selectedImages.length + cropQueue.length + files.length > 5) {
      setError("You can add a maximum of 5 product images.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (files.some((file) => !allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Select JPG, PNG or WebP images, up to 5 MB each.");
      return;
    }
    setError("");
    setCropQueue((previous) => [...previous, ...files]);
  };

  const saveCroppedImage = (file) => {
    setSelectedImages((previous) => [...previous, file]);
    setCropQueue((previous) => previous.slice(1));
  };

  const cancelCrop = () => {
    setCropQueue((previous) => previous.slice(1));
  };

  const removeSelectedImage = (index) => {
    setSelectedImages((previous) => previous.filter((_, i) => i !== index));
  };

  const removeUploadedImage = (index) => {
    setForm((previous) => ({
      ...previous,
      images: previous.images.filter((_, i) => i !== index),
    }));
  };

  const uploadProductImages = async () => {
    if (selectedImages.length === 0) return form.images;
    const formData = new FormData();
    selectedImages.forEach((file) => formData.append("images", file));
    const response = await fetch(`${API_URL}/api/admin/images`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Image upload failed");
    if (!Array.isArray(data.images)) throw new Error("Invalid image upload response");
    return [...form.images, ...data.images];
  };

  // =====================================

  // 2. HANDLE BASIC INPUTS

  // =====================================

  const handleChange = (event) => {

    const { name, value } = event.target;

    setForm((previous) => ({

      ...previous,

      [name]: value,

    }));

  };

  // =====================================

  // 3. HANDLE SIZE TYPE

  // =====================================

  const handleSizeTypeChange = (event) => {

    const sizeType = event.target.value;

    setForm((previous) => ({

      ...previous,

      sizeType,

      variants: [],

      stock: "",

    }));

    setError("");

  };

  // =====================================

  // 4. ADD VARIANT

  // =====================================

  const addVariant = () => {

    setForm((previous) => ({

      ...previous,

      variants: [...previous.variants, createEmptyVariant()],

    }));

  };

  // =====================================

  // 5. UPDATE VARIANT

  // =====================================

  const updateVariant = (index, field, value) => {

    setForm((previous) => ({

      ...previous,

      variants: previous.variants.map((variant, variantIndex) =>

        variantIndex === index ? { ...variant, [field]: value } : variant,

      ),

    }));

  };

  // =====================================

  // 6. REMOVE VARIANT

  // =====================================

  const removeVariant = (index) => {

    setForm((previous) => ({

      ...previous,

      variants: previous.variants.filter(

        (_, variantIndex) => variantIndex !== index,

      ),

    }));

  };

  // =====================================

  // 7. HANDLE FORM SUBMISSION

  // =====================================

  const handleSubmit = async (event) => {

    event.preventDefault();

    setError("");

    const hasVariants = form.variants.length > 0;

    // Sized products must have variants.

    if (form.sizeType !== "none" && !hasVariants) {

      setError("Please add at least one color and size.");

      return;

    }

    // Products without variants use main stock.

    if (!hasVariants && form.stock === "") {

      setError("Please enter product stock.");

      return;

    }

    if (hasVariants) {

      for (const variant of form.variants) {

        if (!variant.color.trim()) {

          setError("Please enter a color for every variant.");

          return;

        }

        if (form.sizeType !== "none" && !variant.size) {

          setError("Please select a size for every variant.");

          return;

        }

        if (variant.stock === "") {

          setError("Please enter stock for every variant.");

          return;

        }

      }

      // Prevent duplicate color + size combinations.

      const combinations = form.variants.map((variant) =>

        JSON.stringify([

          variant.color.trim().toLowerCase(),

          form.sizeType === "none" ? "" : variant.size.toLowerCase(),

        ]),

      );

      if (new Set(combinations).size !== combinations.length) {

        setError("The same color and size combination cannot be added twice.");

        return;

      }

    }

    const regularPrice = Number(form.price);
    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      setError("Regular Price must be greater than zero.");
      return;
    }

    if (form.offerPrice !== "") {
      const manualOfferPrice = Number(form.offerPrice);
      if (
        !Number.isFinite(manualOfferPrice) ||
        manualOfferPrice < 0 ||
        manualOfferPrice >= regularPrice
      ) {
        setError("Offer Price must be lower than Regular Price.");
        return;
      }
    }

    const payload = {

      name: form.name.trim(),

      description: form.description.trim(),

      category: form.category,

      price: regularPrice,

      offerPrice: form.offerPrice === "" ? null : Number(form.offerPrice),

      images: form.images,

      sizeType: form.sizeType,

      stock: hasVariants ? 0 : Number(form.stock),

      variants: form.variants.map((variant) => ({

        color: variant.color.trim(),

        size: form.sizeType === "none" ? "" : variant.size,

        stock: Number(variant.stock),

        ...(variant.price !== "" ? { price: Number(variant.price) } : {}),

        ...(variant.sku.trim() ? { sku: variant.sku.trim() } : {}),

      })),

    };

    if (cropQueue.length) {
      setError("Finish cropping your selected images before saving.");
      return;
    }

    if (form.images.length + selectedImages.length < 3) {
      setError("Please upload at least 3 product images before saving.");
      return;
    }

    setSaving(true);
    setUploadingImages(true);

    try {
      payload.images = await uploadProductImages();
      if (payload.images.length < 3) {
        throw new Error("Please upload at least 3 product images before saving.");
      }
      setUploadingImages(false);

      const response = await fetch(

        isEditMode

          ? `${API_URL}/api/admin/products/${id}`

          : `${API_URL}/api/admin/products`,

        {

          method: isEditMode ? "PATCH" : "POST",

          credentials: "include",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify(payload),

        },

      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(

          data.message ||

            (isEditMode ? "Failed to update product" : "Failed to add product"),

        );

      }

      navigate("/admin/products");

    } catch (err) {

      setError(err.message || "Something went wrong");

    } finally {
      setUploadingImages(false);
      setSaving(false);

    }

  };

  // =====================================

  // 8. AVAILABLE SIZE OPTIONS

  // =====================================

  const sizeOptions = form.sizeType === "age" ? AGE_SIZES : STANDARD_SIZES;

  const hasVariants = form.variants.length > 0;

  // =====================================

  // 9. JSX

  // =====================================

  return (

    <div className="add-product-page">
      {cropQueue.length > 0 && (
        <ImageCropper file={cropQueue[0]} onSave={saveCroppedImage} onCancel={cancelCrop} />
      )}

      <div className="add-product-heading">

        <h1>{isEditMode ? "Edit Product" : "Add Product"}</h1>

        <p>

          {isEditMode

            ? "Update product details, colors, sizes, and stock."

            : "Add products with colors, sizes, and stock quantities."}

        </p>

      </div>

      {error && <p className="add-product-error">{error}</p>}

      <form className="add-product-form" onSubmit={handleSubmit}>

        {/* PRODUCT NAME */}

        <div className="add-product-field">

          <label htmlFor="product-name">Product Name</label>

          <input

            id="product-name"

            name="name"

            value={form.name}

            onChange={handleChange}

            required

          />

        </div>

        {/* DESCRIPTION */}

        <div className="add-product-field">

          <label htmlFor="product-description">Description</label>

          <textarea

            id="product-description"

            name="description"

            rows="4"

            value={form.description}

            onChange={handleChange}

            required

          />

        </div>

        {/* CATEGORY, PRICE, SIZE TYPE */}

        <div className="add-product-grid">

          <div className="add-product-field">

            <label htmlFor="product-category">Category</label>

            <select

              id="product-category"

              name="category"

              value={form.category}

              onChange={handleChange}

              required

              disabled={loadingCategories}

            >

              <option value="">

                {loadingCategories

                  ? "Loading categories..."

                  : "Select category"}

              </option>

              {categories.map((category) => (

                <option key={category._id} value={category._id}>

                  {category.name}

                </option>

              ))}

            </select>

          </div>

          <div className="add-product-field">

            <label htmlFor="product-price">Regular Price (₹)</label>

            <input

              id="product-price"

              type="number"

              name="price"

              min="0"

              step="0.01"

              value={form.price}

              onChange={handleChange}

              required

            />

          </div>

          <div className="add-product-field">
            <label htmlFor="product-offer-price">Offer Price (₹) — Optional</label>
            <input
              id="product-offer-price"
              type="number"
              name="offerPrice"
              min="0"
              max={form.price || undefined}
              step="0.01"
              placeholder="Leave empty for no manual offer"
              value={form.offerPrice}
              onChange={handleChange}
            />
            <small>Manual offer price must be lower than the regular price.</small>
          </div>

          <div className="add-product-field">

            <label htmlFor="product-size-type">Size Type</label>

            <select

              id="product-size-type"

              value={form.sizeType}

              onChange={handleSizeTypeChange}

            >

              <option value="none">No Size (Accessories / Crafts)</option>

              <option value="age">Age-Based (Baby / Kids)</option>

              <option value="standard">Standard (Adult Clothing)</option>

            </select>

          </div>

        </div>

        {/* STOCK WITHOUT VARIANTS */}

        {form.sizeType === "none" && !hasVariants && (

          <div className="add-product-field">

            <label htmlFor="product-stock">Stock Quantity</label>

            <input

              id="product-stock"

              name="stock"

              type="number"

              min="0"

              step="1"

              value={form.stock}

              onChange={handleChange}

              required

            />

          </div>

        )}

        {/* VARIANTS SECTION */}

        <div className="add-product-variants">

          <div className="add-product-variant-heading">

            <h2>

              {form.sizeType === "none"

                ? "Color Variants (Optional)"

                : "Color & Size Variants"}

            </h2>

            <button type="button" onClick={addVariant}>

              + Add Variant

            </button>

          </div>

          {form.variants.length === 0 && (

            <p>

              {form.sizeType === "none"

                ? "Add color variants if this product is available in multiple colors."

                : "Add at least one color and size combination."}

            </p>

          )}

          {form.variants.map((variant, index) => (

            <div className="add-product-variant-row" key={index}>

              {/* COLOR NAME */}

              <div className="add-product-field">

                <label>Color Name</label>

                <input

                  type="text"

                  placeholder="e.g. Pink"

                  value={variant.color}

                  onChange={(event) =>

                    updateVariant(index, "color", event.target.value)

                  }

                  required

                />

              </div>

              {/* SIZE */}

              {form.sizeType !== "none" && (

                <div className="add-product-field">

                  <label>Size</label>

                  <select

                    value={variant.size}

                    onChange={(event) =>

                      updateVariant(index, "size", event.target.value)

                    }

                    required

                  >

                    <option value="">Select size</option>

                    {sizeOptions.map((size) => (

                      <option key={size} value={size}>

                        {size}

                      </option>

                    ))}

                  </select>

                </div>

              )}

              {/* STOCK */}

              <div className="add-product-field">

                <label>Stock</label>

                <input

                  type="number"

                  min="0"

                  step="1"

                  value={variant.stock}

                  onChange={(event) =>

                    updateVariant(index, "stock", event.target.value)

                  }

                  required

                />

              </div>

              {/* VARIANT PRICE */}

              <div className="add-product-field">

                <label>Variant Price (Optional)</label>

                <input

                  type="number"

                  min="0"

                  step="0.01"

                  value={variant.price}

                  onChange={(event) =>

                    updateVariant(index, "price", event.target.value)

                  }

                />

              </div>

              {/* SKU */}

              <div className="add-product-field">

                <label>SKU (Optional)</label>

                <input

                  type="text"

                  value={variant.sku}

                  onChange={(event) =>

                    updateVariant(index, "sku", event.target.value)

                  }

                />

              </div>

              {/* REMOVE */}

              <button

                type="button"

                className="remove-variant-btn"

                onClick={() => removeVariant(index)}

              >

                Remove

              </button>

            </div>

          ))}

        </div>

<div className="product-image-section">

  <h3>Product Images</h3>

  <p>Upload at least 3 and up to 5 images (JPG, PNG or WebP, maximum 5 MB each). You can crop each image before uploading.</p>

  <input

    type="file"

    accept="image/jpeg,image/png,image/webp"

    multiple

    onChange={handleImageSelect}

    disabled={uploadingImages || saving || loadingProduct || cropQueue.length > 0}

  />

  <div className="product-image-grid">

    {form.images.map((image, index) => (

      <div className="product-image-item" key={`uploaded-${index}`}>

        <img src={image} alt={`Product ${index + 1}`} />

        <button

          type="button"

          onClick={() => removeUploadedImage(index)}

          disabled={uploadingImages || saving || loadingProduct}

        >

          Remove

        </button>

      </div>

    ))}

    {selectedImages.map((file, index) => (

      <div className="product-image-item" key={`selected-${index}`}>

        <img

          src={previewUrls[index]}

          alt={`Selected ${index + 1}`}

        />

        <button

          type="button"

          onClick={() => removeSelectedImage(index)}

          disabled={uploadingImages || saving || loadingProduct}

        >

          Remove

        </button>

      </div>

    ))}

  </div>

</div>

        {/* ACTION BUTTONS */}

        <div className="add-product-actions">

          <button

            type="button"

            className="cancel-product-btn"

            onClick={() => navigate("/admin/products")}

          >

            Cancel

          </button>



          <button

            type="submit"

            className="save-product-btn"

            disabled={saving || uploadingImages || loadingCategories || loadingProduct}

          >

            {uploadingImages
        ? "Uploading images..."
        : saving

              ? "Saving..."

              : isEditMode

                ? "Update Product"

                : "Save Product"}

          </button>

        </div>

      </form>

    </div>

  );

}

export default AddProduct;
