
const mongoose = require("mongoose");

const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

// =====================================================
// VALIDATION HELPERS
// =====================================================

function validateAmount(amountPaise) {
  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new Error(
      "Wallet amount must be a positive integer in paise"
    );
  }
}

function validateContext({ userId, orderId, session }) {
  if (!session) {
    throw new Error("MongoDB transaction session required");
  }

  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid wallet user or order ID");
  }
}

function assertTransaction(
  transaction,
  { userId, orderId, kind, amountPaise }
) {
  if (
    String(transaction.user) !== String(userId) ||
    String(transaction.order) !== String(orderId) ||
    transaction.kind !== kind ||
    (
      amountPaise !== undefined &&
      transaction.amountPaise !== amountPaise
    )
  ) {
    throw new Error(
      "Wallet transaction reference conflict"
    );
  }
}

async function findLedgerEntry(reference, session) {
  return WalletTransaction.findOne({
    reference,
  }).session(session);
}

async function createLedgerEntry({
  userId,
  orderId,
  kind,
  amountPaise,
  reference,
  description,
  session,
}) {
  const [entry] = await WalletTransaction.create(
    [
      {
        user: userId,
        order: orderId,
        kind,
        amountPaise,
        reference,
        description,
      },
    ],
    { session }
  );

  return entry;
}

// =====================================================
// 1. RESERVE WALLET FUNDS FOR CHECKOUT
// =====================================================

// Deducts spendable funds while checkout is pending.
// Call within the same MongoDB transaction that
// creates the pending order and stock reservation.

async function reserveForPurchase({
  userId,
  orderId,
  amountPaise,
  session,
}) {
  validateContext({ userId, orderId, session });
  validateAmount(amountPaise);

  const reference = `purchase-reservation:${orderId}`;

  const existing = await findLedgerEntry(
    reference,
    session
  );

  if (existing) {
    assertTransaction(existing, {
      userId,
      orderId,
      kind: "purchase_reservation",
      amountPaise,
    });

    return {
      alreadyApplied: true,
      amountPaise,
    };
  }

  // Prevent a second reservation after the
  // original reservation has already been released.
  const previousRelease = await findLedgerEntry(
    `reservation-release:${orderId}`,
    session
  );

  if (previousRelease) {
    throw new Error(
      "Wallet reservation has already been released"
    );
  }

  const previousDebit = await findLedgerEntry(
    `purchase:${orderId}`,
    session
  );

  if (previousDebit) {
    throw new Error(
      "Order already has a wallet purchase debit"
    );
  }

  const wallet = await Wallet.findOneAndUpdate(
    {
      user: userId,
      balancePaise: { $gte: amountPaise },
    },
    {
      $inc: {
        balancePaise: -amountPaise,
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    }
  );

  if (!wallet) {
    throw new Error("Insufficient wallet balance");
  }

  await createLedgerEntry({
    userId,
    orderId,
    kind: "purchase_reservation",
    amountPaise,
    reference,
    description: "Wallet funds reserved for checkout",
    session,
  });

  return {
    alreadyApplied: false,
    amountPaise,
    balancePaise: wallet.balancePaise,
  };
}

// =====================================================
// 2. SETTLE RESERVED WALLET FUNDS
// =====================================================

// Called only when the checkout payment is confirmed.
//
// Does NOT deduct wallet funds again.
// Records the final purchase debit in the ledger.

async function settlePurchaseReservation({
  userId,
  orderId,
  session,
}) {
  validateContext({ userId, orderId, session });

  const reservation = await findLedgerEntry(
    `purchase-reservation:${orderId}`,
    session
  );

  if (!reservation) {
    throw new Error(
      "Wallet purchase reservation not found"
    );
  }

  assertTransaction(reservation, {
    userId,
    orderId,
    kind: "purchase_reservation",
  });

  const reference = `purchase:${orderId}`;

  const existing = await findLedgerEntry(
    reference,
    session
  );

  if (existing) {
    assertTransaction(existing, {
      userId,
      orderId,
      kind: "purchase_debit",
      amountPaise: reservation.amountPaise,
    });

    return {
      alreadyApplied: true,
      amountPaise: reservation.amountPaise,
    };
  }

  const released = await findLedgerEntry(
    `reservation-release:${orderId}`,
    session
  );

  if (released) {
    throw new Error(
      "Cannot settle a released wallet reservation"
    );
  }

  await createLedgerEntry({
    userId,
    orderId,
    kind: "purchase_debit",
    amountPaise: reservation.amountPaise,
    reference,
    description: "Reserved wallet payment settled",
    session,
  });

  return {
    alreadyApplied: false,
    amountPaise: reservation.amountPaise,
  };
}

// =====================================================
// 3. RELEASE RESERVED WALLET FUNDS
// =====================================================

// Call only after payment reconciliation confirms
// that releasing the checkout is safe.
//
// For split payments, a locally Pending order
// is NOT sufficient proof that Razorpay failed.

async function releasePurchaseReservation({
  userId,
  orderId,
  session,
}) {
  validateContext({ userId, orderId, session });

  const reservation = await findLedgerEntry(
    `purchase-reservation:${orderId}`,
    session
  );

  if (!reservation) {
    throw new Error(
      "Wallet purchase reservation not found"
    );
  }

  assertTransaction(reservation, {
    userId,
    orderId,
    kind: "purchase_reservation",
  });

  const reference = `reservation-release:${orderId}`;

  const existing = await findLedgerEntry(
    reference,
    session
  );

  if (existing) {
    assertTransaction(existing, {
      userId,
      orderId,
      kind: "reservation_release",
      amountPaise: reservation.amountPaise,
    });

    return {
      alreadyApplied: true,
      amountPaise: reservation.amountPaise,
    };
  }

  const settled = await findLedgerEntry(
    `purchase:${orderId}`,
    session
  );

  if (settled) {
    throw new Error(
      "Cannot release a settled wallet purchase"
    );
  }

  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $inc: {
        balancePaise: reservation.amountPaise,
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    }
  );

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  await createLedgerEntry({
    userId,
    orderId,
    kind: "reservation_release",
    amountPaise: reservation.amountPaise,
    reference,
    description: "Unused checkout reservation released",
    session,
  });

  return {
    alreadyApplied: false,
    amountPaise: reservation.amountPaise,
    balancePaise: wallet.balancePaise,
  };
}

// =====================================================
// 4. DIRECT WALLET PURCHASE DEBIT
// =====================================================

// For wallet-only purchases that are completed
// atomically without a separate wallet reservation.
//
// Do not call after reserveForPurchase().
// Use settlePurchaseReservation() instead.

async function debitForPurchase({
  userId,
  orderId,
  amountPaise,
  session,
}) {
  validateContext({ userId, orderId, session });
  validateAmount(amountPaise);

  const reference = `purchase:${orderId}`;

  const existing = await findLedgerEntry(
    reference,
    session
  );

  if (existing) {
    assertTransaction(existing, {
      userId,
      orderId,
      kind: "purchase_debit",
      amountPaise,
    });

    return {
      alreadyApplied: true,
      amountPaise,
    };
  }

  const reservation = await findLedgerEntry(
    `purchase-reservation:${orderId}`,
    session
  );

  if (reservation) {
    throw new Error(
      "Wallet funds already reserved; settle the reservation instead"
    );
  }

  const previousReversal = await findLedgerEntry(
    `purchase-reversal:${orderId}`,
    session
  );

  if (previousReversal) {
    throw new Error(
      "Wallet purchase was previously reversed"
    );
  }

  const wallet = await Wallet.findOneAndUpdate(
    {
      user: userId,
      balancePaise: { $gte: amountPaise },
    },
    {
      $inc: {
        balancePaise: -amountPaise,
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    }
  );

  if (!wallet) {
    throw new Error("Insufficient wallet balance");
  }

  await createLedgerEntry({
    userId,
    orderId,
    kind: "purchase_debit",
    amountPaise,
    reference,
    description: "Wallet payment for order",
    session,
  });

  return {
    alreadyApplied: false,
    amountPaise,
    balancePaise: wallet.balancePaise,
  };
}

// =====================================================
// 5. REVERSE A COMPLETED WALLET PURCHASE
// =====================================================

// This is a purchase reversal, not a normal
// cancellation refund.
//
// Call only when a confirmed purchase must
// be reversed, and only once per order.
//
// A reservation that has already been released
// must never be reversed again.

async function reversePurchaseDebit({
  userId,
  orderId,
  session,
}) {
  validateContext({ userId, orderId, session });

  const debit = await findLedgerEntry(
    `purchase:${orderId}`,
    session
  );

  if (!debit) {
    throw new Error(
      "Original wallet debit not found"
    );
  }

  assertTransaction(debit, {
    userId,
    orderId,
    kind: "purchase_debit",
  });

  const reference = `purchase-reversal:${orderId}`;

  const existing = await findLedgerEntry(
    reference,
    session
  );

  if (existing) {
    assertTransaction(existing, {
      userId,
      orderId,
      kind: "purchase_reversal",
      amountPaise: debit.amountPaise,
    });

    return {
      alreadyApplied: true,
      amountPaise: debit.amountPaise,
    };
  }

  const released = await findLedgerEntry(
    `reservation-release:${orderId}`,
    session
  );

  if (released) {
    throw new Error(
      "Cannot reverse an already released reservation"
    );
  }

  const wallet = await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $inc: {
        balancePaise: debit.amountPaise,
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    }
  );

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  await createLedgerEntry({
    userId,
    orderId,
    kind: "purchase_reversal",
    amountPaise: debit.amountPaise,
    reference,
    description: "Wallet purchase payment reversed",
    session,
  });

  return {
    alreadyApplied: false,
    amountPaise: debit.amountPaise,
    balancePaise: wallet.balancePaise,
  };
}

module.exports = {
  reserveForPurchase,
  settlePurchaseReservation,
  releasePurchaseReservation,
  debitForPurchase,
  reversePurchaseDebit,
};
