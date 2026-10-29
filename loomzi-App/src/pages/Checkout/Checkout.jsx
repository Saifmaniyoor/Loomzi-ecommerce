import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getCart } from "../../services/cartApi";
import { getAddresses, addAddress } from "../../services/addressApi";

import {
  previewCheckout,
  placeCODOrder,
  getCODCheckoutStatus,
  prepareRazorpayCheckout,
  validateRazorpayCheckout,
  createPendingRazorpayOrder,
  createRazorpayPaymentOrder,
  confirmRazorpayCheckout,
  getRazorpayOrderStatus,
  resumeRazorpayPayment,
} from "../../services/checkoutApi";

import { getCurrentUser } from "../../services/authApi";

import "./Checkout.css";

const emptyAddressForm = {
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

const requiredFields = [
  "fullName",
  "phone",
  "addressLine1",
  "city",
  "state",
  "pincode",
];

const addressFields = [
  ["fullName", "Full Name"],
  ["phone", "Phone Number"],
  ["addressLine1", "Address Line 1"],
  ["addressLine2", "Address Line 2"],
  ["landmark", "Landmark"],
  ["city", "City"],
  ["state", "State"],
  ["pincode", "Pincode"],
];

const formatPrice = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const normalizeCart = (response) => {
  const data = response?.cart ?? response;

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    subtotal: Number(data?.subtotal ?? 0),
    shippingCharge: Number(data?.shippingCharge ?? 0),
    total: Number(data?.total ?? 0),
    hasUnavailableItems: Boolean(data?.hasUnavailableItems),
  };
};

const normalizeAddresses = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.addresses)) {
    return response.addresses;
  }

  if (Array.isArray(response?.data?.addresses)) {
    return response.data.addresses;
  }

  return [];
};

const getAddressId = (address) => String(address?._id ?? address?.id ?? "");
const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const existing = document.querySelector('script[data-loomzi-razorpay]');
  if (existing) {
    existing.addEventListener("load", () => resolve(), { once: true });
    existing.addEventListener("error", () => reject(new Error("Could not load Razorpay")), { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  script.dataset.loomziRazorpay = "true";
  script.onload = () => resolve();
  script.onerror = () => reject(new Error("Could not load Razorpay"));
  document.head.appendChild(script);
});


function Checkout() {
  // ======================================
  // Cart and Address State
  // ======================================
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("COD");

  // Logged-in customer ID (from the authenticated backend session).
  const [currentUserId, setCurrentUserId] = useState(null);

  // ======================================
  // COD Order State
  // ======================================
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [checkingCODRecovery, setCheckingCODRecovery] = useState(true);

  // Stores the key for the current checkout attempt.
  const codAttemptRef = useRef(null);
  const razorpayBusyRef = useRef(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [razorpayPendingOrderId, setRazorpayPendingOrderId] = useState(() => {
    try { return sessionStorage.getItem("loomzi-razorpay-pending-order") || ""; }
    catch { return ""; }
  });

  // ======================================
  // Address Form State
  // ======================================
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [addressForm, setAddressForm] = useState({
    ...emptyAddressForm,
  });

  const [savingAddress, setSavingAddress] = useState(false);

  const [addressError, setAddressError] = useState("");

  const [addressMessage, setAddressMessage] = useState("");

  // ======================================
  // Checkout Preview and Coupon State
  // ======================================
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");

  const [couponError, setCouponError] = useState("");

  // Prevent older API responses from replacing
  // the latest checkout preview.
  const previewRequestId = useRef(0);

  // ======================================
  // Fetch Cart and Addresses
  // ======================================
  const fetchCheckoutData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [cartResponse, addressResponse] = await Promise.all([
        getCart(),
        getAddresses(),
      ]);

      const normalizedCart = normalizeCart(cartResponse);

      const normalizedAddresses = normalizeAddresses(addressResponse);

      setCart(normalizedCart);
      setAddresses(normalizedAddresses);

      const defaultAddress = normalizedAddresses.find(
        (address) => address.isDefault,
      );

      const initialAddress = defaultAddress || normalizedAddresses[0];

      setSelectedAddressId(initialAddress ? getAddressId(initialAddress) : "");
    } catch (err) {
      setError(err.message || "Failed to load checkout details");
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckoutData();
  }, [fetchCheckoutData]);

  // ======================================
  // Fetch Current Logged-in Customer
  // ======================================
  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const user = await getCurrentUser();

        if (!cancelled) {
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error("Failed to load current user:", error);

        if (!cancelled) {
          setCurrentUserId(null);
        }
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // ======================================
  // Fetch Checkout Preview
  // ======================================
  useEffect(() => {
    const requestId = ++previewRequestId.current;

    if (loading || !cart || cart.items.length === 0 || !selectedAddressId) {
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    let active = true;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError("");
      setPreview(null);

      try {
        const response = await previewCheckout({
          addressId: selectedAddressId,
          couponCode: appliedCouponCode,
        });

        if (!active || requestId !== previewRequestId.current) {
          return;
        }

        setPreview(response);
      } catch (err) {
        if (!active || requestId !== previewRequestId.current) {
          return;
        }

        setPreviewError(err.message || "Failed to calculate checkout total");
      } finally {
        if (active && requestId === previewRequestId.current) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
    };
  }, [loading, cart, selectedAddressId, appliedCouponCode]);

  // ======================================
  // Address Form Functions
  // ======================================
  const openAddressForm = () => {
    setAddressForm({ ...emptyAddressForm });
    setAddressError("");
    setAddressMessage("");
    setShowAddressForm(true);
  };

  const closeAddressForm = () => {
    if (savingAddress) return;

    setShowAddressForm(false);
    setAddressForm({ ...emptyAddressForm });
    setAddressError("");
  };

  const handleAddressChange = (event) => {
    const { name, value } = event.target;

    setAddressForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ======================================
  // Save New Address
  // ======================================
  const handleSaveAddress = async (event) => {
    event.preventDefault();

    if (savingAddress) return;

    try {
      setSavingAddress(true);
      setAddressError("");
      setAddressMessage("");

      const response = await addAddress(addressForm);
      const addressResponse = await getAddresses();

      const updatedAddresses = normalizeAddresses(addressResponse);

      setAddresses(updatedAddresses);

      const createdAddress = response?.address ?? response?.data?.address;

      let newAddressId = getAddressId(createdAddress);

      if (
        !newAddressId ||
        !updatedAddresses.some(
          (address) => getAddressId(address) === newAddressId,
        )
      ) {
        const matchingAddresses = updatedAddresses.filter(
          (address) =>
            address.fullName === addressForm.fullName &&
            address.phone === addressForm.phone &&
            address.addressLine1 === addressForm.addressLine1 &&
            address.pincode === addressForm.pincode,
        );

        newAddressId =
          matchingAddresses.length === 1
            ? getAddressId(matchingAddresses[0])
            : "";
      }

      if (newAddressId) {
        setSelectedAddressId(newAddressId);
      } else if (updatedAddresses.length === 1) {
        setSelectedAddressId(getAddressId(updatedAddresses[0]));
      } else {
        setSelectedAddressId((previous) =>
          updatedAddresses.some((address) => getAddressId(address) === previous)
            ? previous
            : "",
        );
      }

      setShowAddressForm(false);
      setAddressForm({ ...emptyAddressForm });

      setAddressMessage(
        newAddressId || updatedAddresses.length === 1
          ? "Address added and selected successfully."
          : "Address saved. Please select it from the list.",
      );
    } catch (err) {
      setAddressError(err.message || "Failed to save delivery address");
    } finally {
      setSavingAddress(false);
    }
  };

  // ======================================
  // Coupon Functions
  // ======================================

  const handleApplyCoupon = async (event) => {
    event.preventDefault();

    const code = couponInput.trim().toUpperCase();

    if (!code) {
      setCouponError("Please enter a coupon code");
      return;
    }

    if (!selectedAddressId) {
      setCouponError("Please select a delivery address first");
      return;
    }

    setCouponError("");

    if (code === appliedCouponCode && preview) {
      return;
    }

    const requestId = ++previewRequestId.current;

    setPreviewLoading(true);
    setPreviewError("");

    // IMPORTANT:
    // Do not clear the existing preview here.
    // The previous total remains visible.

    try {
      const response = await previewCheckout({
        addressId: selectedAddressId,
        couponCode: code,
      });

      if (requestId !== previewRequestId.current) {
        return;
      }

      // Update only after successful validation.
      setAppliedCouponCode(code);
      setPreview(response);
    } catch (err) {
      if (requestId !== previewRequestId.current) {
        return;
      }

      setCouponError(err.message || "Unable to apply coupon");

      // Keep the previous preview and coupon.
    } finally {
      if (requestId === previewRequestId.current) {
        setPreviewLoading(false);
      }
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode("");
    setCouponInput("");
    setCouponError("");
  };

  // ======================================
  // Recover a saved COD attempt after refresh
  // ======================================
  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;
    const storageKey = `loomzi-cod-checkout-attempt-${currentUserId}`;

    const checkSavedAttempt = async () => {
      setCheckingCODRecovery(true);
      setOrderError("");

      let stored;
      try {
        const raw = sessionStorage.getItem(storageKey);
        stored = raw ? JSON.parse(raw) : null;
      } catch {
        if (!cancelled) {
          setOrderError("Could not read the saved checkout attempt. Please do not place another order yet.");
          setCheckingCODRecovery(false);
        }
        return;
      }

      if (!stored) {
        if (!cancelled) {
          codAttemptRef.current = null;
          setCheckingCODRecovery(false);
        }
        return;
      }

      if (typeof stored.key !== "string" || !stored.key ||
          typeof stored.signature !== "string") {
        if (!cancelled) {
          setOrderError("Saved checkout attempt is invalid. Please contact support before trying again.");
          setCheckingCODRecovery(false);
        }
        return;
      }

      try {
        const result = await getCODCheckoutStatus(stored.key);
        if (cancelled) return;

        if (result.status === "Completed" && result.orderId) {
          sessionStorage.removeItem(storageKey);
          codAttemptRef.current = null;
          navigate(`/order-success/${result.orderId}`, { replace: true });
          return;
        }

        // Keep the saved key even for Pending/Failed/unknown statuses.
        // Never silently replace an attempt with a fresh key.
        codAttemptRef.current = { ...stored, submitting: false };
        setOrderError("A previous COD attempt needs confirmation. Please do not submit another order yet.");
      } catch (err) {
        if (!cancelled) {
          codAttemptRef.current = { ...stored, submitting: false };
          setOrderError("Unable to verify your previous COD attempt. Please try refreshing later or contact support.");
        }
      } finally {
        if (!cancelled) setCheckingCODRecovery(false);
      }
    };

    checkSavedAttempt();
    return () => { cancelled = true; };
  }, [currentUserId, navigate]);

  // ======================================
  // Place COD Order
  // ======================================
  const handlePlaceCODOrder = async () => {
    if (placingOrder || checkingCODRecovery || codAttemptRef.current?.submitting) return;

    if (!currentUserId) {
      setOrderError("Unable to verify your login session. Please refresh the page.");
      return;
    }
    if (paymentMethod !== "COD") {
      setOrderError("Online payment is not available yet.");
      return;
    }
    if (!selectedAddressId || !preview || previewLoading || previewError) {
      setOrderError("Please wait for valid checkout details to load.");
      return;
    }
    if (!cart?.items?.length || cart.hasUnavailableItems ||
        cart.items.some((item) => item.available === false)) {
      setOrderError("Please review your cart before ordering.");
      return;
    }

    const couponCode = appliedCouponCode.trim().toUpperCase();
    const requestSignature = JSON.stringify({
      addressId: selectedAddressId,
      couponCode,
      items: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    });
    const storageKey = `loomzi-cod-checkout-attempt-${currentUserId}`;

    // Always check storage before creating a new attempt. If one exists,
    // resolve it first, even when the cart/address has changed.
    let savedAttempt;
    try {
      const raw = sessionStorage.getItem(storageKey);
      savedAttempt = raw ? JSON.parse(raw) : null;
    } catch {
      setOrderError("Cannot access saved checkout data. Order not submitted.");
      return;
    }

    if (savedAttempt) {
      if (typeof savedAttempt.key !== "string" || !savedAttempt.key) {
        setOrderError("Previous checkout data is invalid. Please contact support.");
        return;
      }
      setPlacingOrder(true);
      try {
        const status = await getCODCheckoutStatus(savedAttempt.key);
        if (status.status === "Completed" && status.orderId) {
          sessionStorage.removeItem(storageKey);
          codAttemptRef.current = null;
          navigate(`/order-success/${status.orderId}`, { replace: true });
          return;
        }
        setOrderError("Previous COD attempt is not confirmed. Please do not place another order yet.");
      } catch {
        setOrderError("Unable to confirm your previous COD attempt. Please try again later or contact support.");
      } finally {
        setPlacingOrder(false);
      }
      return;
    }

    const attempt = {
      signature: requestSignature,
      key: `cod-${crypto.randomUUID()}`,
      submitting: true,
    };

    try {
      // Persist BEFORE the request so a refresh can recover the same attempt.
      sessionStorage.setItem(storageKey, JSON.stringify({
        signature: attempt.signature,
        key: attempt.key,
      }));
    } catch {
      setOrderError("Could not save checkout recovery information. Order not submitted.");
      return;
    }

    codAttemptRef.current = attempt;
    setPlacingOrder(true);
    setOrderError("");

    try {
      const response = await placeCODOrder({
        addressId: selectedAddressId,
        couponCode,
        idempotencyKey: attempt.key,
      });

      if (!response.orderId) {
        throw new Error("Order response did not include an order ID");
      }

      sessionStorage.removeItem(storageKey);
      codAttemptRef.current = null;
      navigate(`/order-success/${response.orderId}`, { replace: true });
    } catch (err) {
      // A timeout does not mean failure: the backend may have committed.
      try {
        const result = await getCODCheckoutStatus(attempt.key);
        if (result.status === "Completed" && result.orderId) {
          sessionStorage.removeItem(storageKey);
          codAttemptRef.current = null;
          navigate(`/order-success/${result.orderId}`, { replace: true });
          return;
        }
        setOrderError("COD order status is not confirmed. Do not place another order yet.");
      } catch (recoveryError) {
        console.error("COD recovery failed:", recoveryError);
        setOrderError("We couldn't confirm your order status. Do not place another order yet.");
      }
    } finally {
      attempt.submitting = false;
      setPlacingOrder(false);
    }
  };

  // Reused for both first-time checkout and payment continuation.
  const openExistingRazorpayCheckout = async (gateway, orderId) => {
    if (!gateway.keyId || !gateway.razorpayOrderId ||
        !Number.isSafeInteger(gateway.amountInPaise)) {
      throw new Error("Invalid Razorpay payment details");
    }
    await loadRazorpayScript();
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };
      const checkout = new window.Razorpay({
        key: gateway.keyId,
        amount: gateway.amountInPaise,
        currency: gateway.currency,
        order_id: gateway.razorpayOrderId,
        name: "Loomzi",
        description: "Loomzi online order",
        handler: async (payment) => {
          try {
            const confirmed = await confirmRazorpayCheckout({
              orderId,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            });
            if (!confirmed.success) throw new Error("Payment confirmation pending");
            sessionStorage.removeItem("loomzi-razorpay-pending-order");
            setRazorpayPendingOrderId("");
            navigate(`/order-success/${orderId}`, { replace: true });
            finish();
          } catch (error) { finish(error); }
        },
        modal: {
          ondismiss: () => finish(new Error(
            "Payment window closed. You can check status or continue the existing payment."
          )),
        },
      });
      checkout.on("payment.failed", () => finish(new Error(
        "Payment failed. Check the payment status before continuing."
      )));
      checkout.open();
    });
  };

  const handleContinuePayment = async () => {
    if (razorpayBusyRef.current || !razorpayPendingOrderId || !currentUserId) return;
    razorpayBusyRef.current = true;
    setPayingOnline(true);
    setOrderError("");
    try {
      const orderId = razorpayPendingOrderId;
      // The backend must authorize continuation; do not create another order.
      const gateway = await resumeRazorpayPayment(orderId);
      if (gateway.paymentStatus === "Paid") {
        sessionStorage.removeItem("loomzi-razorpay-pending-order");
        setRazorpayPendingOrderId("");
        navigate(`/order-success/${orderId}`, { replace: true });
        return;
      }
      await openExistingRazorpayCheckout(gateway, orderId);
    } catch (error) {
      setOrderError(error.message || "Could not continue payment safely.");
    } finally {
      razorpayBusyRef.current = false;
      setPayingOnline(false);
    }
  };

  // Razorpay checkout: prepare -> validate -> reserve stock -> create gateway order -> verify captured payment.
  const handleOnlinePayment = async () => {
    if (razorpayBusyRef.current || payingOnline || !currentUserId) return;
    if (razorpayPendingOrderId) {
      setOrderError("An earlier online payment needs verification. Check its status before creating another order.");
      return;
    }
    if (!selectedAddressId || !preview || previewLoading || previewError || hasUnavailableItems || !items.length) {
      setOrderError("Please wait for valid checkout details and select an address.");
      return;
    }
    razorpayBusyRef.current = true;
    setPayingOnline(true);
    setOrderError("");
    let createdOrderId = "";
    try {
      await loadRazorpayScript();
      const body = { addressId: selectedAddressId };
      if (appliedCouponCode.trim()) body.couponCode = appliedCouponCode.trim().toUpperCase();
      const key = `razorpay-${crypto.randomUUID()}`;
      const prepared = await prepareRazorpayCheckout(body, key);
      await validateRazorpayCheckout(body, key);
      const pending = await createPendingRazorpayOrder(body, key);
      createdOrderId = String(pending.orderId || prepared.orderId || "");
      if (!createdOrderId) throw new Error("Pending order ID missing");
      sessionStorage.setItem("loomzi-razorpay-pending-order", createdOrderId);
      setRazorpayPendingOrderId(createdOrderId);
      const gateway = await createRazorpayPaymentOrder(prepared.attemptId, createdOrderId);
      await openExistingRazorpayCheckout(gateway, createdOrderId);
    } catch (error) {
      setOrderError(error.message || "Online payment could not be confirmed. Check your order status.");
    } finally {
      razorpayBusyRef.current = false;
      setPayingOnline(false);
    }
  };

  const checkOnlinePaymentStatus = async () => {
    if (!razorpayPendingOrderId) return;
    try {
      const status = await getRazorpayOrderStatus(razorpayPendingOrderId);
      if (status.paymentStatus === "Paid") {
        sessionStorage.removeItem("loomzi-razorpay-pending-order");
        setRazorpayPendingOrderId("");
        navigate(`/order-success/${razorpayPendingOrderId}`, { replace: true });
      } else {
        setOrderError("Payment is not confirmed yet. Do not create another order. Contact support if you were charged.");
      }
    } catch (error) { setOrderError(error.message || "Could not check payment status"); }
  };

  // ======================================
  // Cart Details
  // ======================================
  const items = cart?.items ?? [];

  const hasUnavailableItems =
    Boolean(cart?.hasUnavailableItems) ||
    items.some((item) => item.available === false);

  // ======================================
  // JSX
  // ======================================
  return (
    <main className="checkout-page">
      <div className="checkout-container">
        <p className="checkout-eyebrow">ALMOST THERE</p>

        <h1>Checkout</h1>

        <p className="checkout-subtitle">Review your order before payment.</p>

        {loading ? (
          <p className="checkout-placeholder">
            Loading your checkout details...
          </p>
        ) : error ? (
          <section className="checkout-section" role="alert">
            <p>{error}</p>

            <button type="button" onClick={fetchCheckoutData}>
              Try Again
            </button>
          </section>
        ) : items.length === 0 ? (
          <section className="checkout-section">
            <h2>Your cart is empty</h2>

            <p className="checkout-placeholder">
              Add some products before proceeding to checkout.
            </p>

            <Link to="/products">Continue Shopping</Link>
          </section>
        ) : (
          <div className="checkout-layout">
            <div className="checkout-main">
              {/* DELIVERY ADDRESS */}
              <section className="checkout-section">
                <div className="checkout-section-heading">
                  <h2>Delivery Address</h2>

                  {!showAddressForm && (
                    <button
                      type="button"
                      className="checkout-add-address-btn"
                      onClick={openAddressForm}
                    >
                      + Add New Address
                    </button>
                  )}
                </div>

                {/* ADD ADDRESS FORM AT TOP */}
                {showAddressForm && (
                  <div className="checkout-address-form-wrapper">
                    <h3>Add New Delivery Address</h3>

                    <form onSubmit={handleSaveAddress}>
                      <div className="checkout-address-form-grid">
                        {addressFields.map(([name, label]) => (
                          <div className="checkout-address-field" key={name}>
                            <label htmlFor={`checkout-${name}`}>{label}</label>

                            <input
                              id={`checkout-${name}`}
                              name={name}
                              value={addressForm[name]}
                              onChange={handleAddressChange}
                              required={requiredFields.includes(name)}
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
                              inputMode={
                                name === "phone" || name === "pincode"
                                  ? "numeric"
                                  : undefined
                              }
                              disabled={savingAddress}
                            />
                          </div>
                        ))}

                        <div className="checkout-address-field">
                          <label htmlFor="checkout-addressType">
                            Address Type
                          </label>

                          <select
                            id="checkout-addressType"
                            name="addressType"
                            value={addressForm.addressType}
                            onChange={handleAddressChange}
                            disabled={savingAddress}
                          >
                            <option value="Home">Home</option>
                            <option value="Work">Work</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      {addressError && (
                        <p className="checkout-item-warning" role="alert">
                          {addressError}
                        </p>
                      )}

                      <div className="checkout-address-form-actions">
                        <button
                          type="submit"
                          className="checkout-save-address-btn"
                          disabled={savingAddress}
                        >
                          {savingAddress ? "Saving..." : "Save Address"}
                        </button>

                        <button
                          type="button"
                          className="checkout-cancel-address-btn"
                          onClick={closeAddressForm}
                          disabled={savingAddress}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {addressMessage && (
                  <p className="checkout-address-success" role="status">
                    {addressMessage}
                  </p>
                )}

                {addresses.length === 0 && !showAddressForm && (
                  <div className="checkout-no-address">
                    <p>You have no saved delivery addresses.</p>

                    <button type="button" onClick={openAddressForm}>
                      Add Delivery Address
                    </button>
                  </div>
                )}

                {addresses.length > 0 && (
                  <div className="checkout-address-list">
                    {addresses.map((address) => {
                      const addressId = getAddressId(address);

                      const isSelected = selectedAddressId === addressId;

                      return (
                        <label
                          key={addressId}
                          className={`checkout-address-card ${
                            isSelected ? "selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryAddress"
                            value={addressId}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedAddressId(addressId);
                              setAddressMessage("");
                              setCouponError("");
                            }}
                          />

                          <div className="checkout-address-details">
                            <div className="checkout-address-top">
                              <strong>{address.fullName}</strong>

                              {address.addressType && (
                                <span className="checkout-address-type">
                                  {address.addressType}
                                </span>
                              )}

                              {address.isDefault && (
                                <span className="checkout-default-badge">
                                  Default
                                </span>
                              )}
                            </div>

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
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* PAYMENT METHOD */}
              <section className="checkout-section">
                <h2>Payment Method</h2>

                <div className="checkout-payment-options">
                  <label
                    className={`checkout-payment-option ${
                      paymentMethod === "COD" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={paymentMethod === "COD"}
                      onChange={() => setPaymentMethod("COD")}
                    />

                    <div>
                      <strong>Cash on Delivery (COD)</strong>
                      <p>Pay when your order is delivered.</p>
                    </div>
                  </label>

                  <label
                    className={`checkout-payment-option ${
                      paymentMethod === "Razorpay" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Razorpay"
                      checked={paymentMethod === "Razorpay"}
                      onChange={() => setPaymentMethod("Razorpay")}
                    />

                    <div>
                      <strong>Online Payment (Razorpay)</strong>
                      <p>Pay securely using an online payment method.</p>
                    </div>
                  </label>
                </div>
              </section>
            </div>

            {/* ORDER SUMMARY */}
            <aside className="checkout-summary">
              <h2>Order Summary</h2>

              <div className="checkout-order-items">
                {(preview?.items ?? items).map((item, index) => {
                  const itemId =
                    item.itemId ??
                    item._id ??
                    `${item.productId ?? "item"}-${index}`;

                  const lineTotal =
                    item.lineTotal ??
                    Number(item.price || 0) * Number(item.quantity || 0);

                  return (
                    <div className="checkout-order-item" key={String(itemId)}>
                      <div className="checkout-order-product">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="checkout-product-image"
                          />
                        ) : (
                          <div className="checkout-product-placeholder">
                            No Image
                          </div>
                        )}

                        <div className="checkout-product-info">
                          <h3>{item.name}</h3>
                          <p>Qty: {item.quantity}</p>

                          {(item.color || item.size) && (
                            <p>
                              {item.color}
                              {item.color && item.size && " / "}
                              {item.size}
                            </p>
                          )}

                          {item.available === false && (
                            <p className="checkout-item-warning">
                              {item.message || "Product is unavailable"}
                            </p>
                          )}
                        </div>
                      </div>

                      <strong>{formatPrice(lineTotal)}</strong>
                    </div>
                  );
                })}
              </div>

              {/* COUPON */}
              <div className="checkout-coupon-section">
                <h3>Have a Coupon?</h3>

                <form
                  className="checkout-coupon-form"
                  onSubmit={handleApplyCoupon}
                >
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponInput}
                    onChange={(event) => {
                      setCouponInput(event.target.value);
                      setCouponError("");
                    }}
                    disabled={previewLoading}
                  />

                  <button
                    type="submit"
                    disabled={previewLoading || !selectedAddressId}
                  >
                    Apply
                  </button>
                </form>

                {couponError && (
                  <p className="checkout-item-warning" role="alert">
                    {couponError}
                  </p>
                )}

                {appliedCouponCode && preview?.coupon && (
                  <div className="checkout-applied-coupon">
                    <span>{appliedCouponCode} applied</span>

                    <button type="button" onClick={handleRemoveCoupon}>
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* BACKEND CALCULATED TOTALS */}
              {previewLoading && (
                <p className="checkout-help-text">
                  Calculating latest checkout total...
                </p>
              )}

              {previewError && (
                <p className="checkout-item-warning" role="alert">
                  {previewError}
                </p>
              )}

              {preview && (
                <div className="checkout-totals">
                  <div className="checkout-total-row">
                    <span>Original Subtotal</span>
                    <span>
                      {formatPrice(
                        preview.originalSubtotal ?? preview.subtotal
                      )}
                    </span>
                  </div>

                  {Number(preview.offerSavings) > 0 && (
                    <div className="checkout-total-row checkout-savings-row">
                      <span>Product Offers</span>
                      <span>-{formatPrice(preview.offerSavings)}</span>
                    </div>
                  )}

                  <div className="checkout-total-row">
                    <span>Subtotal After Offers</span>
                    <span>{formatPrice(preview.subtotal)}</span>
                  </div>

                  {Number(preview.discount) > 0 && (
                    <div className="checkout-total-row checkout-savings-row">
                      <span>Coupon Discount</span>
                      <span>-{formatPrice(preview.discount)}</span>
                    </div>
                  )}

                  <div className="checkout-total-row">
                    <span>Shipping</span>
                    <span>{formatPrice(preview.shippingCharge)}</span>
                  </div>

                  <div className="checkout-total-row">
                    <span>Tax</span>
                    <span>{formatPrice(preview.tax)}</span>
                  </div>

                  <div className="checkout-total-row checkout-final-total">
                    <strong>Total Payable</strong>
                    <strong>{formatPrice(preview.finalTotal)}</strong>
                  </div>

                  {Number(preview.totalSavings) > 0 && (
                    <div className="checkout-savings-message">
                      You saved {formatPrice(preview.totalSavings)} on this order!
                    </div>
                  )}
                </div>
              )}

              {hasUnavailableItems && (
                <p className="checkout-item-warning" role="alert">
                  Some products are unavailable. Please update your cart.
                </p>
              )}

              {!selectedAddressId && (
                <p className="checkout-item-warning">
                  Please select a delivery address before placing an order.
                </p>
              )}

              {orderError && (
                <p className="checkout-item-warning" role="alert">
                  {orderError}
                </p>
              )}

              <button
                type="button"
                onClick={paymentMethod === "COD" ? handlePlaceCODOrder : handleOnlinePayment}
                disabled={
                  (paymentMethod === "Razorpay" && (payingOnline || Boolean(razorpayPendingOrderId))) ||
                  !currentUserId ||
                  checkingCODRecovery ||
                  placingOrder ||
                  loading ||
                  previewLoading ||
                  Boolean(previewError) ||
                  !preview ||
                  !selectedAddressId ||
                  hasUnavailableItems ||
                  !items.length
                }
              >
                {paymentMethod === "Razorpay"
                  ? payingOnline ? "Processing Online Payment..." : "Pay Online"
                  : checkingCODRecovery
                    ? "Checking Previous Order..."
                    : placingOrder
                      ? "Placing Order..."
                      : "Place Order"}
              </button>

              <p className="checkout-help-text">
                Orders may be cancelled before shipment, subject to payment eligibility. Once shipped, standard cancellation is unavailable. <Link to="/cancellation-policy">Cancellation &amp; Returns Policy</Link>.
              </p>

              <p className="checkout-help-text">
                {paymentMethod === "COD"
                  ? "Pay when your order is delivered."
                  : "Secure online payment via Razorpay."}
              </p>

              {razorpayPendingOrderId && (
                <div role="status" className="checkout-item-warning">
                  <p>Online order {razorpayPendingOrderId} needs payment status verification.</p>
                  <button type="button" onClick={checkOnlinePaymentStatus} disabled={payingOnline}>
                    Check Online Payment Status
                  </button>
                  <button type="button" onClick={handleContinuePayment} disabled={payingOnline || !currentUserId}>
                    {payingOnline ? "Checking..." : "Continue Payment"}
                  </button>
                </div>
              )}
              <Link to="/cart" className="checkout-back">
                ← Back to Cart
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default Checkout;
