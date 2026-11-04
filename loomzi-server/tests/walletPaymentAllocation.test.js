const assert = require("node:assert/strict");
const test = require("node:test");
const { allocateWalletPayment } = require("../utils/walletPaymentAllocation");

test("Razorpay-only payment", () => {
  assert.deepEqual(allocateWalletPayment({ totalPaise: 100000, availableWalletPaise: 40000, useWallet: false }), {
    totalPaise: 100000, walletPaise: 0, razorpayPaise: 100000, paymentMethod: "Razorpay"
  });
});
test("wallet-only payment", () => {
  assert.deepEqual(allocateWalletPayment({ totalPaise: 100000, availableWalletPaise: 150000, useWallet: true }), {
    totalPaise: 100000, walletPaise: 100000, razorpayPaise: 0, paymentMethod: "Wallet"
  });
});
test("split payment", () => {
  assert.deepEqual(allocateWalletPayment({ totalPaise: 100000, availableWalletPaise: 40000, useWallet: true }), {
    totalPaise: 100000, walletPaise: 40000, razorpayPaise: 60000, paymentMethod: "Wallet+Razorpay"
  });
});
test("reject unsafe small remainder", () => {
  assert.throws(() => allocateWalletPayment({ totalPaise: 100000, availableWalletPaise: 99950, useWallet: true }), /minimum/);
});
test("reject fractional paise", () => {
  assert.throws(() => allocateWalletPayment({ totalPaise: 100.5, availableWalletPaise: 10, useWallet: true }), /Invalid/);
});
