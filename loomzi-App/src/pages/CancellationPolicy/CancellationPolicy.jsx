import { Link } from "react-router-dom";

export default function CancellationPolicy() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
      <h1>Cancellation &amp; Returns Policy</h1>
      <h2>Order cancellation</h2>
      <p>Eligible orders may be cancelled before shipment, while their status is Pending, Confirmed, or Processing. Once an order has shipped, standard cancellation is no longer available.</p>
      <p>To request cancellation, open My Orders and select the order. If cancellation is available, use the Cancel Order button. Eligibility also depends on payment status and payment method.</p>
      <h2>Refunds</h2>
      <p>For eligible prepaid cancellations, refunds are initiated through the original payment provider. Processing time depends on the payment provider and bank. If a refund is delayed, contact support.</p>
      <h2>Returns and customer rights</h2>
      <p>Cancellation restrictions do not remove applicable consumer rights or remedies for defective, damaged, incorrect, or misrepresented goods. Please contact Loomzi support for assistance with these issues, including after shipment or delivery.</p>
      <p><Link to="/products">Continue shopping</Link></p>
    </main>
  );
}
