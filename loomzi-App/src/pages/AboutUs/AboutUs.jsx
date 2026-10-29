import React from "react";
import { Link } from "react-router-dom";
import "./AboutUs.css";
import imagineImage from "./images/imagine.jpg";
import createImage from "./images/create.jpg";
import perfectImage from "./images/perfect.jpg";

const steps = [
  {
    number: "01",
    title: "Whimsical Conception",
    description: "Our designs start far away from computer screens. We begin with a pencil, a sketchbook, and a dream. We imagine worlds where forest animals talk and hairbands hold the secrets of spring gardens. Every pattern is hand-drawn to capture the elusive spark of childhood wonder.",
    image: imagineImage,
    alt: "A handmade children's dress being sketched",
  },
  {
    number: "02",
    title: "Masterful Stitching",
    description: 'This is where the magic happens. Our skilled artisans use traditional embroidery techniques that have been passed down through generations. A single "Meadow Mist Dress" can take over 20 hours of concentrated hand-work, ensuring that every floral accent is perfectly placed and durably finished.',
    image: createImage,
    alt: "Hand embroidery on pink fabric",
  },
  {
    number: "03",
    title: "Personal Touches",
    description: "The final step is making it theirs. Whether it's an embroidered name on a pillow or a custom color for a hairband, we believe personalization creates a bond between the child and their handmade treasure. It transforms a craft into a legacy.",
    image: perfectImage,
    alt: "Colorful handmade children's hairbands",
  },
];

export default function AboutUs() {
  return (
    <main className="loomzi-about">
      <section className="loomzi-about__mission loomzi-about__container">
        <div className="loomzi-about__mission-image">
          <img src={perfectImage} alt="Pink embroidered handmade children's dress" />
        </div>
        <div className="loomzi-about__mission-copy">
          <span className="loomzi-about__eyebrow" aria-hidden="true" />
          <h1>A Mission to<br />Spark Childhood Joy</h1>
          <p>At Loomzi, our heartbeat is the laughter of children. In a world of fast fashion and mass-produced toys, we stand for the slow, the intentional, and the artisanal. Each item we create is more than just a product; it’s a companion for adventures, a treasure for keepsakes, and a reminder of the magic of childhood.</p>
          <div className="loomzi-about__values">
            <div><span className="loomzi-about__value-icon loomzi-about__value-icon--mint" aria-hidden="true">🌱</span><h3>Ethical Making</h3><p>Supporting local artisans and fair trade practices in every stitch.</p></div>
            <div><span className="loomzi-about__value-icon loomzi-about__value-icon--pink" aria-hidden="true">🧵</span><h3>Pure Materials</h3><p>Using organic cotton, pure wool felt, and non-toxic dyes for safety.</p></div>
          </div>
        </div>
      </section>

      <section className="loomzi-about__process loomzi-about__container" aria-labelledby="loomzi-process-title">
        <div className="loomzi-about__section-heading"><h2 id="loomzi-process-title">The Art of the Stitch</h2><p>Every creation at Loomzi passes through a journey of meticulous attention and artistic flair.</p></div>
        <div className="loomzi-about__steps">
          {steps.map((step, index) => (
            <article className={`loomzi-about__step ${index % 2 ? "loomzi-about__step--reverse" : ""}`} key={step.number}>
              <div className="loomzi-about__step-copy"><span className="loomzi-about__number">{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></div>
              <div className="loomzi-about__step-image"><img src={step.image} alt={step.alt} loading="lazy" /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="loomzi-about__cta"><div className="loomzi-about__container"><h2>Want a Glimpse Into Our Studio?</h2><p>Follow our daily process and sneak peeks of upcoming collections on our social channels.</p><Link className="loomzi-about__cta-button" to="/products">Shop Our Collection</Link></div></section>
    </main>
  );
}
