import type { Color, PatternDefinition } from "src/types";

/**
 * Creates SVG pattern definitions similar to matplotlib's hatch styles
 */
export interface PatternInfo {
  char: string;
  label: string;
  id: string;
}

export class HatchPatternGenerator {
  static readonly PATTERNS: PatternInfo[] = [
    { char: "-", label: "Horizontal", id: "horizontal" },
    { char: "|", label: "Vertical", id: "vertical" },
    { char: "/", label: "Diagonal /", id: "diagfwd" },
    { char: "\\", label: "Diagonal \\", id: "diagbck" },
    { char: ".", label: "Dots", id: "dots" },
    { char: "o", label: "Circles", id: "circles" },
    { char: "O", label: "Large circles", id: "lgcircles" },
    { char: "0", label: "Diamonds", id: "diamonds" },
    { char: "v", label: "V-shape", id: "vshape" },
  ];

  private patternScale: number;
  private size: number;
  private strokeWidth: number;
  private baseColor: Color;

  constructor() {
    this.patternScale = 1;
    this.size = 10;
    this.strokeWidth = 3;
    this.baseColor = '#000000';
  }

  /**
   * Generate an SVG pattern definition from a matplotlib-style hatch string
   * @param options - Additional options (color, size, etc.)
   * @returns {SVGPatternElement} SVG pattern element
   */
  updateOrCreatePattern(options: PatternDefinition): SVGPatternElement {
    const {
      hatch,
      id,
      color = this.baseColor,
      scale = this.patternScale,
      strokeWidth = this.strokeWidth,
      backgroundColor = 'none',
    } = options;

    let pattern = document.getElementById(id!) as SVGPatternElement | null;
    if (pattern) pattern.remove();
    // Create SVG pattern element
    pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', id!);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', this.size.toString());
    pattern.setAttribute('height', this.size.toString());
    pattern.setAttribute('patternTransform', `scale(${scale})`);

    // If a background color is specified, add it
    if (backgroundColor !== 'none') {
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', this.size.toString());
      background.setAttribute('height', this.size.toString());
      background.setAttribute('fill', backgroundColor);
      pattern.appendChild(background);
    }
    // Parse the hatch string and add appropriate elements
    for (const char of hatch!) {
      switch (char) {
        case '/': // Forward diagonal lines
          this._addDiagonalLine(pattern, color, strokeWidth, true);
          break;
        case '\\': // Backward diagonal lines
          this._addDiagonalLine(pattern, color, strokeWidth, false);
          break;
        case '-': // Horizontal lines
          this._addHorizontalLine(pattern, color, strokeWidth);
          break;
        case '|': // Vertical lines
          this._addVerticalLine(pattern, color, strokeWidth);
          break;
        case '.': // Dots
          this._addDot(pattern, color, strokeWidth);
          break;
        case 'o': // Circles
          this._addCircle(pattern, color, strokeWidth);
          break;
        case 'O': // Larger circles
          this._addCircle(pattern, color, strokeWidth, 0.3);
          break;
        case '0': // Diamond
          this._createDiamondPattern(pattern, color, strokeWidth);
          break;
        case 'v': // V-shape
          this._createPathPattern('M0 0 5 5 10 0M0 5 5 10 10 5M-1 9 5 15 11 9M0-5 5 0 10-5', pattern, color, strokeWidth);
          break;
      }
    }

    return pattern;
  }

  /**
 * Add a seamless diagonal line to the pattern that works with any stroke width
 */
  _addDiagonalLine(pattern: SVGElement, color: Color, strokeWidth: number, isForward: boolean) {
    // Calculate the extension needed to ensure seamless tiling
    // We extend the line beyond the pattern boundaries by half the stroke width
    const ext = this.size / 4;

    // Create path instead of line for more control
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    // Define the path data - extending beyond the pattern boundary in both directions
    let d;
    if (isForward) {
      // Forward diagonal (/) extended in both directions
      d = `M${0} ${this.size} L${this.size} ${0} M${-ext} ${ext} L${ext} ${-ext} M${this.size - ext} ${this.size + ext} L${this.size + ext} ${this.size - ext}`;
    } else {
      // Backward diagonal (\) extended in both directions
      d = `M0 0 L${this.size} ${this.size} M${this.size - ext} ${-ext} L${this.size + ext} ${ext} M${-ext} ${this.size - ext} L${ext} ${this.size + ext}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${strokeWidth}`);
    path.setAttribute('stroke-linecap', 'square'); // Sharp ends for better tiling

    // Ensure the path doesn't create a fill
    path.setAttribute('fill', 'none');

    pattern.appendChild(path);
  }

  /**
   * Add a horizontal line to the pattern
   */
  _addHorizontalLine(pattern: SVGElement, color: Color, strokeWidth: number) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '0');
    line.setAttribute('y1', `${this.size / 2}`);
    line.setAttribute('x2', `${this.size}`);
    line.setAttribute('y2', `${this.size / 2}`);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', `${strokeWidth}`);
    pattern.appendChild(line);
  }

  /**
   * Add a vertical line to the pattern
   */
  _addVerticalLine(pattern: SVGElement, color: Color, strokeWidth: number) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', `${this.size / 2}`);
    line.setAttribute('y1', '0');
    line.setAttribute('x2', `${this.size / 2}`);
    line.setAttribute('y2', `${this.size}`);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', `${strokeWidth}`);
    pattern.appendChild(line);
  }

  /**
   * Add a dot to the pattern
   */
  _addDot(pattern: SVGElement, color: Color, strokeWidth: number) {
    this._addCirclePattern(pattern, strokeWidth, color);
  }

  /**
   * Add a circle to the pattern
   */
  _addCircle(pattern: SVGElement, color: Color, strokeWidth: number, scale = 0.18) {
    this._addCirclePattern(pattern, this.size * scale, 'none', color, strokeWidth);
  }

  _addCirclePattern(pattern: SVGElement, radius: number, fillColor?: Color, strokeColor?: Color, strokeWidth?: number) {
    pattern.appendChild(this._createCircle(this.size / 2, this.size / 2, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0, 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(0, this.size, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(this.size, 0, radius, fillColor, strokeColor, strokeWidth));
    pattern.appendChild(this._createCircle(this.size, this.size, radius, fillColor, strokeColor, strokeWidth));
  }

  _createCircle(cx: number, cy: number, radius: number, fillColor?: Color, strokeColor?: Color, strokeWidth?: number) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', `${cx}`);
    circle.setAttribute('cy', `${cy}`);
    circle.setAttribute('r', `${radius}`);
    if (fillColor) circle.setAttribute('fill', fillColor);
    if (strokeColor) circle.setAttribute('stroke', strokeColor);
    if (strokeWidth) circle.setAttribute('stroke-width', `${strokeWidth}`);
    return circle;
  }

  addOrUpdatePatternsForSVG(defs: SVGDefsElement, patternDefs: PatternDefinition[]) {
    for (const def of patternDefs) {
      const pattern = this.updateOrCreatePattern(def);
      defs.appendChild(pattern);
    }
  }

  /**
   * Create a diamond pattern
   */
  _createDiamondPattern(pattern: SVGElement, color: Color, strokeWidth: number) {
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const numDiamonds = 4;
    const diamondSize = (this.size * 0.6) / (1 + numDiamonds % 3);

    // Create multiple nested diamonds based on character code

    for (let i = 1; i <= numDiamonds; i++) {
      const currentSize = diamondSize * i;
      const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const points = `
        ${centerX},${centerY - currentSize}
        ${centerX + currentSize},${centerY}
        ${centerX},${centerY + currentSize}
        ${centerX - currentSize},${centerY}
      `;

      diamond.setAttribute('points', points);
      diamond.setAttribute('stroke', color);
      diamond.setAttribute('stroke-width', `${strokeWidth}`);
      diamond.setAttribute('fill', 'none');
      pattern.appendChild(diamond);
    }
  }

  _createPathPattern(d: string, pattern: SVGElement, color: Color, strokeWidth: number) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${strokeWidth}`);
    path.setAttribute('fill', 'none');
    pattern.appendChild(path);
  }

}

export const patternGenerator = new HatchPatternGenerator();
