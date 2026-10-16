
const paymentServices = require("./paymentServices");

// Internal, read-only payment activity inspection.
//
// IMPORTANT:
// This function does not authorize payment retry,
// payment resumption, stock release, or cancellation.
//
// Even a response containing zero payments is only
// a snapshot of Razorpay's state at inspection time.
const inspectRazorpayPaymentActivity = async ({
  razorpayOrderId,
  amountInPaise,
}) => {
  // 1. Validate Razorpay order ID
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId)
  ) {
    throw new Error("Invalid Razorpay order ID");
  }

  // 2. Validate expected amount
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error("Invalid payment amount");
  }

  // 3. Fetch payment activity directly from Razorpay
  //
  // Network errors propagate to the recovery service.
  // They must never be interpreted as zero payments.
  const response =
    await paymentServices.fetchPaymentsForRazorpayOrder(
      razorpayOrderId
    );

  // 4. Validate response structure
  if (
    !response ||
    typeof response !== "object" ||
    !Array.isArray(response.items)
  ) {
    throw new Error(
      "Invalid Razorpay payment response"
    );
  }

  const payments = response.items;
  const totalCount = response.count;

  const reconciliationRequired = (
    reason,
    extra = {}
  ) => ({
    safeToResume: false,
    requiresReconciliation: true,
    reason,
    ...extra,
  });

  // 5. Check response completeness
  if (
    !Number.isSafeInteger(totalCount) ||
    totalCount < 0 ||
    totalCount !== payments.length
  ) {
    return reconciliationRequired(
      "Complete payment history could not be confirmed",
      {
        paymentCount: payments.length,
        reportedCount: totalCount ?? null,
      }
    );
  }

  // IMPORTANT:
  // Matching counts do not guarantee that another
  // payment will not appear after this inspection.
  // This result must never authorize an automatic retry.

  // 6. Validate every payment record
  for (const payment of payments) {
    if (
      !payment ||
      typeof payment !== "object" ||
      typeof payment.id !== "string" ||
      !/^pay_[a-zA-Z0-9]+$/.test(payment.id) ||
      typeof payment.status !== "string"
    ) {
      return reconciliationRequired(
        "Invalid payment record returned by Razorpay",
        {
          paymentCount: payments.length,
        }
      );
    }

    if (
      payment.order_id !== razorpayOrderId ||
      payment.amount !== amountInPaise ||
      payment.currency !== "INR"
    ) {
      return reconciliationRequired(
        "Razorpay payment details do not match the order",
        {
          paymentCount: payments.length,
        }
      );
    }
  }

  // 7. Identify captured payments
  const capturedPayments = payments.filter(
    (payment) => payment.status === "captured"
  );

  if (capturedPayments.length > 0) {
    return reconciliationRequired(
      "A captured payment exists. Reconcile it before proceeding.",
      {
        paymentStatus: "captured",
        paymentCount: payments.length,
      }
    );
  }

  // 8. Identify authorized payments
  const authorizedPayments = payments.filter(
    (payment) => payment.status === "authorized"
  );

  if (authorizedPayments.length > 0) {
    return reconciliationRequired(
      "An authorized payment exists. Capture or resolve it before proceeding.",
      {
        paymentStatus: "authorized",
        paymentCount: payments.length,
      }
    );
  }

  // 9. Handle all other payment attempts
  if (payments.length > 0) {
    return reconciliationRequired(
      "Previous payment attempts require reconciliation",
      {
        paymentStatus: "other",
        paymentCount: payments.length,
      }
    );
  }

  // 10. No payment records returned
  return {
    safeToResume: false,
    requiresReconciliation: false,
    paymentCount: 0,
    message:
      "No payments were returned by Razorpay at inspection time. This does not authorize retry or stock release.",
  };
};

module.exports = {
  inspectRazorpayPaymentActivity,
};
