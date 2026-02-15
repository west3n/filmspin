export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function toYear(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function valueToColor(val) {
  const min = 1.0;
  const max = 9.0;
  const ratio = Math.min(1, Math.max(0, (val - min) / (max - min)));
  const hue = 4 + (124 * ratio);
  const saturation = 58;
  const lightness = 34;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function toNamesList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
