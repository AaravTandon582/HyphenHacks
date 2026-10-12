// Carries the active dataset and the last generation result between the
// workspace and the constellation view across client-side navigation.
// sessionStorage backs it so a refresh on /constellation doesn't blank the
// page; it's tab-local and small (a parsed CSV + result), so no real cost.

const KEY = "constellation:workspace";

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable — state just won't survive a refresh
  }
}

export function getDataset() {
  return read().dataset ?? null;
}

export function setDataset(dataset) {
  write({ ...read(), dataset, result: null });
}

export function getResult() {
  return read().result ?? null;
}

export function setResult(result) {
  write({ ...read(), result });
}

export function clearWorkspace() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
