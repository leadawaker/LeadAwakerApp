function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0,2), 16) / 255;
  const g = parseInt(hex.substring(2,4), 16) / 255;
  const b = parseInt(hex.substring(4,6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) { h = ((g - b) / d + (g < b ? 6 : 0)) / 6; }
    else if (max === g) { h = ((b - r) / d + 2) / 6; }
    else { h = ((r - g) / d + 4) / 6; }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

console.log('Brand Blue #5170FF:', hexToHSL('5170FF'));
console.log('Deep Blue #131B49:', hexToHSL('131B49'));
console.log('Brand Yellow #FCB803:', hexToHSL('FCB803'));
console.log('Soft Yellow #FCCA47:', hexToHSL('FCCA47'));
