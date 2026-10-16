
const StockReservation = require(
  "../models/StockReservation"
);

// Create reservation
const createReservation = async (
  reservationData,
  session
) => {
  const [reservation] = await StockReservation.create(
    [reservationData],
    { session }
  );

  return reservation;
};

// Find reservation by order ID
const findReservationByOrderId = async (orderId) => {
  return await StockReservation.findOne({
    order: orderId,
  });
};

// Find expired active reservations
const findExpiredReservations = async () => {
  return await StockReservation.find({
    status: "Active",
    expiresAt: { $lte: new Date() },
  });
};

// Mark reservation completed, only if still active
const completeReservation = async (
  reservationId,
  session
) => {
  return await StockReservation.findOneAndUpdate(
    {
      _id: reservationId,
      status: "Active",
    },
    {
      $set: {
        status: "Completed",
        completedAt: new Date(),
      },
    },
    {
      new: true,
      session,
    }
  );
};

// Mark reservation released, only if still active
const releaseReservation = async (
  reservationId,
  session
) => {
  return await StockReservation.findOneAndUpdate(
    {
      _id: reservationId,
      status: "Active",
    },
    {
      $set: {
        status: "Released",
        releasedAt: new Date(),
      },
    },
    {
      new: true,
      session,
    }
  );
};

module.exports = {
  createReservation,
  findReservationByOrderId,
  findExpiredReservations,
  completeReservation,
  releaseReservation,
};
