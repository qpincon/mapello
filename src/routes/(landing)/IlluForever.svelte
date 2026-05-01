<div class="illu">
  <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ifv-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#2a7d6e" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#2a7d6e" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Radial glow -->
    <ellipse cx="240" cy="196" rx="170" ry="130" fill="url(#ifv-glow)"/>

    <!-- Infinity symbol (∞) — two interlocking loops -->
    <path d="M240 196
             C240 156 140 136 120 196
             C100 256 200 276 240 196
             C280 116 380 136 360 196
             C340 256 240 236 240 196 Z"
          stroke="rgba(74,184,163,0.75)" stroke-width="3" fill="rgba(74,184,163,0.08)"
          stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Inner highlight lines on each loop -->
    <path d="M 180 174 Q 148 190 158 216"
          stroke="rgba(255,255,255,0.12)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M 300 174 Q 332 190 322 216"
          stroke="rgba(255,255,255,0.12)" stroke-width="1.2" fill="none" stroke-linecap="round"/>

    <!-- Open padlock (above, centered) -->
    <!-- Shackle (open — arc, not closed) -->
    <path d="M218 104 A22 22 0 0 1 262 104"
          stroke="rgba(255,255,255,0.45)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <!-- Shackle left leg going down, right leg open/floating -->
    <line x1="218" y1="104" x2="218" y2="120"
          stroke="rgba(255,255,255,0.45)" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Body -->
    <rect x="208" y="120" width="64" height="44" rx="6"
          fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.30)" stroke-width="1.8"/>
    <!-- Keyhole -->
    <circle cx="240" cy="137" r="7" fill="rgba(255,255,255,0.22)"/>
    <rect x="237" y="137" width="6" height="10" rx="2" fill="rgba(255,255,255,0.22)"/>

    <!-- SVG file badge (below infinity) -->
    <rect x="200" y="278" width="80" height="34" rx="5"
          fill="rgba(255,255,255,0.06)" stroke="rgba(74,184,163,0.40)" stroke-width="1.2"/>
    <!-- < / > -->
    <path d="M216 290 L210 295 L216 300"
          stroke="rgba(74,184,163,0.7)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <line x1="223" y1="288" x2="227" y2="302"
          stroke="rgba(74,184,163,0.35)" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M233 290 L239 295 L233 300"
          stroke="rgba(74,184,163,0.7)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <!-- "svg" bars -->
    <rect x="248" y="290" width="18" height="3.5" rx="1.5" fill="rgba(74,184,163,0.65)"/>
    <rect x="248" y="297" width="12" height="3.5" rx="1.5" fill="rgba(74,184,163,0.38)"/>

    <!-- Subtle tick marks suggesting "no expiry" timeline -->
    <line x1="64"  y1="196" x2="64"  y2="206" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="96"  y1="196" x2="96"  y2="202" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-linecap="round"/>
    <line x1="128" y1="196" x2="128" y2="202" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-linecap="round"/>
    <line x1="352" y1="196" x2="352" y2="202" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-linecap="round"/>
    <line x1="384" y1="196" x2="384" y2="202" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-linecap="round"/>
    <line x1="416" y1="196" x2="416" y2="206" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
</div>

<style>
  .illu {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #100e08 0%, #261e10 50%, #100e08 100%);
  }
  .illu svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
