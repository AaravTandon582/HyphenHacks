import { Suspense, lazy } from "react";
import { usePath } from "./router.jsx";
import Landing from "./Landing.jsx";
import Workspace from "./Workspace.jsx";
import CardNav from "./CardNav.jsx";
import logo from "./logo.svg";

// Three.js pulls in ~1MB — split it out so the homepage never pays for it
const Constellation = lazy(() => import("./Constellation.jsx"));

const navItems = [
  {
    label: "Workspace",
    bgColor: "#111111",
    textColor: "#ffffff",
    links: [
      { label: "Open workspace", href: "/workspace", ariaLabel: "Open the workspace" },
      { label: "Demo data", href: "/workspace?demo=1", ariaLabel: "Open the workspace with demo data" },
    ],
  },
  {
    label: "Constellation",
    bgColor: "#1c1c1c",
    textColor: "#ffffff",
    links: [{ label: "Home", href: "/", ariaLabel: "Back to the landing page" }],
  },
];

export default function App() {
  const path = usePath();

  if (path === "/workspace") return <Workspace />;
  if (path === "/constellation") {
    return (
      <Suspense fallback={<div className="workspace-root" />}>
        <Constellation />
      </Suspense>
    );
  }

  return (
    <>
      <CardNav
        logo={logo}
        logoAlt="Constellation"
        items={navItems}
        baseColor="#0a0a0a"
        menuColor="#ffffff"
        buttonBgColor="#ffffff"
        buttonTextColor="#000000"
        ease="power3.out"
      />
      <Landing />
    </>
  );
}
