<script lang="ts">
  interface Props {
    size?: number;
    accent?: 'teal' | 'gold' | 'none';
    withContours?: boolean;
    class?: string;
  }
  let {
    size = 32,
    accent = 'teal',
    withContours = false,
    class: className = '',
  }: Props = $props();

  const clipId = `mark-${Math.random().toString(36).slice(2, 9)}`;

  const accentColor = $derived(
    accent === 'teal' ? '#2a7d6e' :
    accent === 'gold' ? '#c9943a' :
    'transparent'
  );

  // M-shape outline path (closed polygon with flat bottom)
  // viewBox 0 0 120 96
  // Points: bottom-left → outer-top-left → left-peak → center-valley → right-peak → outer-top-right → bottom-right → close
  const mPath = 'M 8,80 L 12,22 L 38,14 L 60,60 L 82,14 L 108,22 L 112,80 Z';
</script>

<svg
  width={size}
  viewBox="0 0 120 96"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
  class={className}
>
  <defs>
    {#if withContours}
      <clipPath id={clipId}>
        <path d={mPath} />
      </clipPath>
    {/if}
  </defs>

  <!-- Contour lines (topographic texture) clipped to M shape -->
  {#if withContours}
    <g
      clip-path="url(#{clipId})"
      stroke="currentColor"
      stroke-width="0.9"
      fill="none"
    >
      <!-- Sweeping horizontal waves across M panels -->
      <path d="M 8,30 C 22,27 33,33 46,28 C 54,25 62,32 74,28 C 86,24 98,30 112,28" opacity="0.35"/>
      <path d="M 8,38 C 20,35 34,41 47,36 C 56,33 64,40 76,36 C 88,32 100,38 112,36" opacity="0.38"/>
      <path d="M 8,46 C 22,43 36,49 49,44 C 58,41 66,48 78,44 C 90,40 102,46 112,44" opacity="0.40"/>
      <path d="M 8,54 C 24,51 38,57 52,52 C 60,49 68,56 80,52 C 92,48 104,54 112,52" opacity="0.38"/>
      <!-- Left-panel oval island -->
      <path d="M 22,45 C 18,41 20,35 28,34 C 36,33 40,38 38,43 C 36,48 30,50 24,48 C 22,47 21,46 22,45 Z" opacity="0.3"/>
      <!-- Right-panel oval island -->
      <path d="M 78,45 C 76,40 80,34 88,34 C 96,34 100,40 98,45 C 96,50 90,52 84,50 C 80,48 79,47 78,45 Z" opacity="0.3"/>
      <!-- Lower waves (visible in bottom panels) -->
      <path d="M 16,62 C 26,59 38,65 50,61 C 62,57 74,63 86,59 C 98,55 106,61 112,60" opacity="0.32"/>
      <path d="M 10,70 C 22,67 36,73 50,69 C 64,65 78,71 92,67 C 100,65 106,68 112,68" opacity="0.28"/>
    </g>
  {/if}

  <!-- Main M silhouette outline -->
  <path
    d={mPath}
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linejoin="round"
    vector-effect="non-scaling-stroke"
  />

  <!-- Outer fold crease lines (lighter, show panel depth) -->
  <line x1="12" y1="22" x2="14" y2="80"
    stroke="currentColor" stroke-width="1" stroke-opacity="0.45"
    vector-effect="non-scaling-stroke" />
  <line x1="108" y1="22" x2="106" y2="80"
    stroke="currentColor" stroke-width="1" stroke-opacity="0.45"
    vector-effect="non-scaling-stroke" />

  <!-- Main inner fold crease lines -->
  <line x1="38" y1="14" x2="36" y2="80"
    stroke="currentColor" stroke-width="1.1"
    vector-effect="non-scaling-stroke" />
  <line x1="60" y1="60" x2="60" y2="80"
    stroke="currentColor" stroke-width="1.1"
    vector-effect="non-scaling-stroke" />
  <line x1="82" y1="14" x2="84" y2="80"
    stroke="currentColor" stroke-width="1.1"
    vector-effect="non-scaling-stroke" />

  <!-- Corner accent flag (teal or gold, shown at bottom-right) -->
  {#if accent !== 'none'}
    <polygon
      points="107,73 116,84 100,84"
      fill={accentColor}
      stroke={accentColor}
      stroke-width="1"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  {/if}
</svg>
