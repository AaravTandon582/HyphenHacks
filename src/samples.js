// Bundled sample datasets, served statically from public/samples/ — see
// src/csv.js for the parser both these and user uploads run through.
export const SAMPLES = [
  {
    id: "people",
    file: "/samples/people-connections.csv",
    label: "Team activity",
    description: "24 people — connections, collaborations, messages, hours active.",
  },
  {
    id: "stars",
    file: "/samples/star-catalog.csv",
    label: "Star catalog",
    description: "60 synthetic stars — temperature, luminosity, radius. Clusters cleanly.",
  },
];
