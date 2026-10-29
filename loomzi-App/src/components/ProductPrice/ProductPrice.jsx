
import "./ProductPrice.css";

function ProductPrice({ product }) {
  const regularPrice = Number(
    product.regularPrice ??
    product.originalPrice ??
    product.price
  );

  const finalPrice = Number(
    product.finalPrice ??
    product.offerPrice ??
    product.price
  );

  const hasDiscount =
    Number.isFinite(regularPrice) &&
    Number.isFinite(finalPrice) &&
    finalPrice < regularPrice;

  return (
    <div className="loomzi-product-price">
      <span className="loomzi-final-price">
        ₹{finalPrice.toFixed(2)}
      </span>

      {hasDiscount && (
        <span className="loomzi-regular-price">
          ₹{regularPrice.toFixed(2)}
        </span>
      )}
    </div>
  );
}

export default ProductPrice;
