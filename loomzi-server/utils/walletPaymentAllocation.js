// Pure calculation only. Never use this without an atomic wallet reservation
// in the order-creation transaction and reconciliation-safe payment finalization.
const allocateWalletPayment = ({ totalPaise, availableWalletPaise, useWallet }) => {
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    throw new Error("Invalid order total in paise");
  }
  if (!Number.isSafeInteger(availableWalletPaise) || availableWalletPaise < 0) {
    throw new Error("Invalid available wallet balance in paise");
  }
  if (typeof useWallet !== "boolean") {
    throw new Error("useWallet must be boolean");
  }
  const walletPaise = useWallet ? Math.min(totalPaise, availableWalletPaise) : 0;
  const razorpayPaise = totalPaise - walletPaise;
  // Existing Razorpay checkout assumes minimum 100 paise.
  // A small nonzero remainder must not be sent to Razorpay.
  if (razorpayPaise > 0 && razorpayPaise < 100) {
    throw new Error("Remaining Razorpay payment is below the supported minimum. Adjust wallet usage.");
  }
  return {
    totalPaise,
    walletPaise,
    razorpayPaise,
    paymentMethod: walletPaise === 0 ? "Razorpay" : razorpayPaise === 0 ? "Wallet" : "Wallet+Razorpay",
  };
};
module.exports = { allocateWalletPayment };
