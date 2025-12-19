export function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    return false;
  }
}

export function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to read from localStorage', e);
    return null;
  }
}
