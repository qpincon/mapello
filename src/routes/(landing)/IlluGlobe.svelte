<div class="illu">
  <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="ig-clip"><circle cx="240" cy="182" r="128"/></clipPath>
      <radialGradient id="ig-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#2a7d6e" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#2a7d6e" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Inner glow -->
    <circle cx="240" cy="182" r="128" fill="url(#ig-glow)"/>

    <!-- Globe outline -->
    <circle cx="240" cy="182" r="128" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>

    <!-- Graticule lines (clipped) -->
    <g clip-path="url(#ig-clip)">
      <!-- Latitude lines -->
      <ellipse cx="240" cy="182" rx="128" ry="34" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <ellipse cx="240" cy="107" rx="110" ry="29" stroke="rgba(255,255,255,0.09)" stroke-width="0.8"/>
      <ellipse cx="240" cy="257" rx="110" ry="29" stroke="rgba(255,255,255,0.09)" stroke-width="0.8"/>
      <ellipse cx="240" cy="55"  rx="65"  ry="17" stroke="rgba(255,255,255,0.06)" stroke-width="0.7"/>
      <ellipse cx="240" cy="309" rx="65"  ry="17" stroke="rgba(255,255,255,0.06)" stroke-width="0.7"/>
      <!-- Meridians -->
      <line x1="240" y1="54"  x2="240" y2="310" stroke="rgba(255,255,255,0.10)" stroke-width="0.8"/>
      <ellipse cx="240" cy="182" rx="65"  ry="128" stroke="rgba(255,255,255,0.09)" stroke-width="0.8"/>
      <ellipse cx="240" cy="182" rx="110" ry="128" stroke="rgba(255,255,255,0.08)" stroke-width="0.7"/>
      <!-- Highlighted region (Europe-ish blob) -->
      <path d="M237 96 L251 88 L265 92 L274 105 L270 120 L257 130 L242 134 L230 126 L226 112 L231 100 Z"
            fill="rgba(74,184,163,0.28)" stroke="#4ab8a3" stroke-width="1.3" stroke-linejoin="round"/>
    </g>

    <!-- Dot on region -->
    <circle cx="250" cy="111" r="3.5" fill="#4ab8a3"/>

    <!-- Rotation arc handle (right) -->
    <path d="M 385 148 A 38 38 0 0 1 385 216"
          stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <circle cx="385" cy="148" r="4.5" fill="rgba(255,255,255,0.30)"/>
    <circle cx="385" cy="216" r="4.5" fill="rgba(255,255,255,0.30)"/>
    <polyline points="380,211 385,216 390,211"
              stroke="rgba(255,255,255,0.30)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Magnifier (left) -->
    <circle cx="82" cy="182" r="17" stroke="rgba(255,255,255,0.20)" stroke-width="1.5" fill="none"/>
    <line x1="95" y1="195" x2="106" y2="206"
          stroke="rgba(255,255,255,0.20)" stroke-width="2" stroke-linecap="round"/>
    <line x1="77" y1="182" x2="87" y2="182"
          stroke="rgba(255,255,255,0.22)" stroke-width="1.3" stroke-linecap="round"/>
    <line x1="82" y1="177" x2="82" y2="187"
          stroke="rgba(255,255,255,0.22)" stroke-width="1.3" stroke-linecap="round"/>
  </svg>
</div>

<style>
  .illu {
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at 50% 40%, #1d3557 0%, #0d1f3c 70%, #060c1a 100%);
  }
  .illu svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
