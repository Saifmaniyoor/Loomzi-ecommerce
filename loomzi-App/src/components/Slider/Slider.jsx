import { Link } from "react-router-dom";
import "./Slider.css";
import heroImage from "./main-banner.jpg";

function Slider() {
  return (
    <section className="hero">

      {/* Background Image */}
      <img
        src={heroImage}
        alt="Loomzi handmade fashion"
        className="hero-image"
      />

      {/* Dark Overlay */}
      <div className="hero-overlay"></div>

      {/* Hero Content */}
      <div className="hero-content">

        <p className="hero-small-text">
          HANDMADE WITH LOVE
        </p>

        <h1>
          Hand-Stitched Magic
          <br />
          for Your Little Ones
        </h1>

        <p className="hero-description">
          Beautiful handmade dresses, playful hairbands,
          and creative crafts made with love for little ones.
        </p>

        <Link to="/products" className="hero-button">
          Shop the Collection
        </Link>

      </div>

    </section>
  );
}

export default Slider;