
import { Link } from "react-router-dom";
import "./CategorySelection.css";

import dressesImage from "./images/dresses.jpg";
import hairbandsImage from "./images/hairbands.jpg";
import craftsImage from "./images/crafts.jpg";

function CategorySelection() {
  const categories = [
    {
      id: 1,
      title: "Custom Dresses",
      description: "Beautiful dresses made with love for little ones.",
      image: dressesImage,
      link: "/products?category=Dresses",
    },
    {
      id: 2,
      title: "Whimsical Hairbands",
      description: "Cute and playful hairbands for every little style.",
      image: hairbandsImage,
      link: "/products?category=Hairbands",
    },
    {
      id: 3,
      title: "Creative Crafts",
      description: "Unique handmade crafts created with care.",
      image: craftsImage,
      link: "/products?category=Crafts",
    },
  ];

  return (
    <section className="category-section">

      {/* Section Heading */}

      <div className="category-heading">
        <p className="category-subtitle">
          EXPLORE OUR COLLECTION
        </p>

        <h2>Browse by Category</h2>

        <p className="category-description">
          Discover our collection of handmade creations,
          thoughtfully made for your little ones.
        </p>
      </div>


      {/* Category Cards */}

      <div className="category-container">

        {categories.map((category) => (
          <div className="category-card" key={category.id}>

            {/* Image */}

            <div className="category-image">
              <img
                src={category.image}
                alt={category.title}
              />
            </div>


            {/* Content */}

            <div className="category-content">

              <h3>{category.title}</h3>

              <p>{category.description}</p>

              <Link
                to={category.link}
                className="category-link"
              >
                Explore
                <span> →</span>
              </Link>

            </div>

          </div>
        ))}

      </div>

    </section>
  );
}

export default CategorySelection;
