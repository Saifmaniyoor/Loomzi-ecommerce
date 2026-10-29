
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./AnnouncementBar.css";

const API_URL =
  "http://localhost:5000/api/promotions/announcement";

const SLIDE_INTERVAL = 5000;

function AnnouncementBar() {
  const [offers, setOffers] = useState([]);
  const [coupon, setCoupon] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // ===================================
  // Fetch Active Offers and Coupon
  // ===================================
  useEffect(() => {
    const controller = new AbortController();

    const fetchPromotions = async () => {
      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch promotions");
        }

        const data = await response.json();

        setOffers(
          Array.isArray(data.offers) ? data.offers : []
        );

        setCoupon(data.coupon || null);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(
            "Announcement bar error:",
            error
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchPromotions();

    return () => controller.abort();
  }, []);

  // ===================================
  // Automatic Carousel
  // ===================================
  useEffect(() => {
    if (offers.length <= 1 || isHovered) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((previous) =>
        (previous + 1) % offers.length
      );
    }, SLIDE_INTERVAL);

    return () => clearInterval(interval);
  }, [offers.length, isHovered]);

  // ===================================
  // Carousel Navigation
  // ===================================
  const nextOffer = () => {
    setCurrentIndex((previous) =>
      (previous + 1) % offers.length
    );
  };

  const previousOffer = () => {
    setCurrentIndex((previous) =>
      (previous - 1 + offers.length) % offers.length
    );
  };

  // ===================================
  // Copy Coupon Code
  // ===================================
  const copyCoupon = async () => {
    if (!coupon?.code) return;

    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
    } catch (error) {
      console.error("Unable to copy coupon:", error);
      setCopied(false);
    }
  };

  // ===================================
  // Loading / Empty State
  // ===================================
  if (loading || (offers.length === 0 && !coupon)) {
    return null;
  }

  const offer = offers[currentIndex] || null;

  const backgroundStyle = offer?.bannerImage
    ? {
        backgroundImage: `linear-gradient(
          90deg,
          rgba(35, 15, 25, 0.58),
          rgba(35, 15, 25, 0.12)
        ), url("${offer.bannerImage}")`,
      }
    : {};

  return (
    <section className="loomzi-announcement">
      <div
        className={`announcement-container ${
          !offer ? "announcement-coupon-only" : ""
        } ${
          !coupon ? "announcement-offer-only" : ""
        }`}
      >
        {/* =========================
            OFFER SECTION
        ========================= */}
        {offer && (
          <div
            className="announcement-offer"
            style={backgroundStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="announcement-offer-content">
              <span className="announcement-label">
                LIMITED-TIME OFFER
              </span>

              <h2 className="announcement-offer-title">
                {offer.name}
              </h2>

              <p className="announcement-offer-description">
                {offer.discountPercentage}% OFF on{" "}
                {offer.targetName}
              </p>

              <Link
                to={offer.link}
                className="announcement-shop-link"
              >
                Shop Now
                <span aria-hidden="true"> →</span>
              </Link>
            </div>

            {/* Carousel Arrows */}
            {offers.length > 1 && (
              <>
                <button
                  type="button"
                  className="announcement-arrow announcement-arrow-prev"
                  onClick={previousOffer}
                  aria-label="Previous offer"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="announcement-arrow announcement-arrow-next"
                  onClick={nextOffer}
                  aria-label="Next offer"
                >
                  ›
                </button>
              </>
            )}

            {/* Carousel Dots */}
            {offers.length > 1 && (
              <div className="announcement-dots">
                {offers.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`announcement-dot ${
                      index === currentIndex
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setCurrentIndex(index)
                    }
                    aria-label={`Show offer ${index + 1}`}
                    aria-current={
                      index === currentIndex
                        ? "true"
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================
            COUPON SECTION
        ========================= */}
        {coupon && (
          <div className="announcement-coupon">
            <div className="announcement-coupon-content">
              <span className="announcement-coupon-label">
                SPECIAL COUPON
              </span>

              <div className="announcement-coupon-heading">
                <span
                  className="announcement-coupon-icon"
                  aria-hidden="true"
                >
                  🎟️
                </span>

                <strong>Extra Savings!</strong>
              </div>

              <p className="announcement-coupon-description">
                Get {coupon.discountValue}% OFF
                on your order
              </p>

              <button
                type="button"
                className="announcement-copy-button"
                onClick={copyCoupon}
              >
                <span>{coupon.code}</span>

                <span className="announcement-copy-text">
                  {copied ? "Copied!" : "Copy Code"}
                </span>
              </button>

              <p className="announcement-coupon-details">
                Min. purchase ₹
                {coupon.minimumPurchase}
                {coupon.maximumDiscount > 0 &&
                  ` · Max. ₹${coupon.maximumDiscount} off`}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AnnouncementBar;
