import { Link } from "./router.jsx";
import SideRays from "./SideRays.jsx";
import TechText from "./TechText.jsx";
import BlurText from "./BlurText.jsx";
import Starfield from "./Starfield.jsx";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Landing() {
  return (
    <>
      {!reducedMotion && (
        <div className="backdrop" aria-hidden="true">
          <SideRays
            speed={5}
            rayColor1="#EAB308"
            rayColor2="#96c8ff"
            intensity={3}
            spread={2}
            origin="top-right"
            tilt={60}
            saturation={1.3}
            blend={0.75}
            falloff={1.6}
            opacity={1.0}
          />
        </div>
      )}

      <Starfield animate={!reducedMotion} />

      <main className="page">
        <h1 className="wordmark">
          <TechText
            text="Asterism"
            fontWeight={600}
            fontSize={150}
            color="#FFFFFF"
            accentColor="#9CA3AF"
            reveal="letter"
            lineStyle="dashed"
            selection={false}
            labels={false}
            draggable={false}
            sweep
            speed={0.6}
            specks={6}
            dashLength={4}
            dashGap={2}
            strokeWidth={1.5}
          />
        </h1>

        <BlurText
          className="lede"
          text="Turn complex datasets into interactive networks. Explore connections, uncover clusters, and discover patterns."
          animateBy="words"
          direction="top"
          delay={25}
          stepDuration={0.3}
        />

        <Link to="/workspace" className="button">
          <BlurText
            as="span"
            text="Enter Workspace"
            animateBy="words"
            direction="top"
            delay={60}
            stepDuration={0.3}
          />
        </Link>

        <Link to="/workspace?demo=1" className="quiet-link">
          <BlurText
            as="span"
            text="Explore demo data"
            animateBy="words"
            direction="top"
            delay={25}
            stepDuration={0.3}
          />
        </Link>
      </main>
    </>
  );
}
