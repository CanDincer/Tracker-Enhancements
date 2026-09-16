export class CeUtility {
  static getProgressCircleHtml(data) {
    return `<svg class="progress-ring progress-ring--${data.class}" aria-hidden="true" viewBox="0 0 ${data.diameter} ${data.diameter}" width="${data.diameter}" height="${data.diameter}">
      <circle class="progress-ring__circle" stroke-width="${data.strokeWidth}"
        stroke-dasharray="${data.circumference}" stroke-dashoffset="${data.offset}"
        fill="transparent" r="${data.radius}" cx="${data.position}" cy="${data.position}" />
    </svg>`;
  }

  static getProgressCircle({ current = 0, max = 0, radius = 16 } = {}) {
    const circumference = radius * 2 * Math.PI;
    const percent = Number.isFinite(current) && Number.isFinite(max) && max > 0
      ? Math.min(1, Math.max(0, current / max)) : 0;
    const strokeWidth = 4;
    const diameter = (radius * 2) + strokeWidth;
    return {
      radius, diameter, strokeWidth, circumference,
      offset: circumference * (1 - percent),
      position: diameter / 2,
      class: Math.round(percent * 10) * 10,
    };
  }
}
