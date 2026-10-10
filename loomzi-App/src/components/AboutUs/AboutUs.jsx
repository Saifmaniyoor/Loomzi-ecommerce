import "./AboutUs.css";

import imagineImage from "./images/imagine.jpg";
import createImage from "./images/create.jpg";
import perfectImage from "./images/perfect.jpg";

const steps = [
  {
    id: 1,
    number: "01",
    title: "Design with love",
    description:
      "Every Loomzi creation begins with a simple idea, inspired by little moments and beautiful details.",
    image: imagineImage,
  },
  {
    id: 2,
    number: "02",
    title: "Create with care",
    description:
      "Our designs are carefully crafted by hand, with attention to every stitch, colour and detail.",
    image: createImage,
  },
  {
    id: 3,
    number: "03",
    title: "Made to be special",
    description:
      "Before it reaches you, every piece is checked and finished with care to make sure it feels just right.",
    image: perfectImage,
  },
];

function AboutUs() {
  return (
    <section className="about-us">

      {/* Section Header */}
      <div className="about-heading">

        <p className="about-subtitle">
          THE LOOMZI WAY
        </p>

        <h2>
          How We Create Magic
        </h2>

        <p className="about-description">
          From a little idea to something made with love, every Loomzi
          creation has a story behind it.
        </p>

      </div>


      {/* About Steps */}
      <div className="about-steps">

        {steps.map((step) => (
          <div
            className={`about-step ${
              step.id % 2 === 0 ? "reverse" : ""
            }`}
            key={step.id}
          >

            {/* Image */}
            <div className="about-image">
              <img
                src={step.image}
                alt={step.title}
              />
            </div>


            {/* Content */}
            <div className="about-content">

              <span className="about-number">
                {step.number}
              </span>

              <h3>
                {step.title}
              </h3>

              <p>
                {step.description}
              </p>

            </div>

          </div>
        ))}

      </div>

    </section>
  );
}

export default AboutUs;