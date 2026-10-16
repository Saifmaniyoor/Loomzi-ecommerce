
const {
  verifyWebhookCapturedPayment,
} = require("./webhookPaymentReconciliationServices");

const {
  confirmCapturedPaymentTransaction,
} = require("./paymentConfirmationTransactionServices");

// Verify a captured payment and confirm
// its matching Loomzi order.
const confirmWebhookCapturedPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
}) => {
  // 1. Verify the payment using Razorpay's API
  // and match it to an existing Loomzi order.
  const verification = await verifyWebhookCapturedPayment({
    razorpayOrderId,
    razorpayPaymentId,
    amountInPaise,
  });

  // 2. Stop if verification was unsuccessful.
  // Never update an order based only on
  // the webhook payload.
  if (!verification || !verification.verified) {
    return {
      confirmed: false,
      requiresReconciliation: true,
      reason:
        verification?.reason ||
        "Webhook payment verification was unsuccessful",
    };
  }

  // 3. Payment was already confirmed previously.
  if (verification.alreadyPaid) {
    return {
      confirmed: true,
      alreadyPaid: true,
      orderId: verification.orderId,
    };
  }

  // 4. Confirm payment inside a MongoDB transaction.
  // The transaction must independently recheck
  // the order, attempt and reservation state.
  const result = await confirmCapturedPaymentTransaction({
    userId: verification.userId,
    orderId: verification.orderId,
    razorpayOrderId: verification.razorpayOrderId,
    razorpayPaymentId: verification.razorpayPaymentId,
  });

  // 5. Return the transaction result.
  return {
    confirmed: true,
    alreadyPaid: false,
    orderId: verification.orderId,
    result,
  };
};

module.exports = {
  confirmWebhookCapturedPayment,
};
