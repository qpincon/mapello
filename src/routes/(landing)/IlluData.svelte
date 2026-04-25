<div class="illu">
  <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="id-scale" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#2a7d6e" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#4ab8a3" stop-opacity="0.95"/>
      </linearGradient>
    </defs>

    <!-- Left: abstract CSV table (label col + bar col) -->
    <!-- Header row -->
    <rect x="42" y="58"  width="48" height="9" rx="2.5" fill="rgba(255,255,255,0.12)"/>
    <rect x="96" y="58"  width="72" height="9" rx="2.5" fill="rgba(74,184,163,0.35)"/>
    <!-- Divider -->
    <line x1="42" y1="73" x2="172" y2="73" stroke="rgba(255,255,255,0.07)" stroke-width="0.8"/>
    <!-- Row 1 -->
    <rect x="42" y="79"  width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="79"  width="28" height="8" rx="2" fill="rgba(74,184,163,0.28)"/>
    <!-- Row 2 -->
    <rect x="42" y="94"  width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="94"  width="54" height="8" rx="2" fill="rgba(74,184,163,0.55)"/>
    <!-- Row 3 (highest) -->
    <rect x="42" y="109" width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="109" width="72" height="8" rx="2" fill="rgba(74,184,163,0.90)"/>
    <!-- Row 4 -->
    <rect x="42" y="124" width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="124" width="18" height="8" rx="2" fill="rgba(74,184,163,0.18)"/>
    <!-- Row 5 -->
    <rect x="42" y="139" width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="139" width="38" height="8" rx="2" fill="rgba(74,184,163,0.40)"/>
    <!-- Row 6 -->
    <rect x="42" y="154" width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="154" width="60" height="8" rx="2" fill="rgba(74,184,163,0.65)"/>
    <!-- Row 7 -->
    <rect x="42" y="169" width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="169" width="44" height="8" rx="2" fill="rgba(74,184,163,0.45)"/>
    <!-- Row 8 -->
    <rect x="42" y="184" width="48" height="8" rx="2" fill="rgba(255,255,255,0.07)"/>
    <rect x="96" y="184" width="32" height="8" rx="2" fill="rgba(74,184,163,0.32)"/>
    <!-- Faint file label dots -->
    <rect x="42" y="206" width="30" height="5" rx="2" fill="rgba(255,255,255,0.05)"/>
    <rect x="78" y="206" width="44" height="5" rx="2" fill="rgba(255,255,255,0.04)"/>

    <!-- Arrow -->
    <line x1="194" y1="132" x2="248" y2="132"
          stroke="rgba(255,255,255,0.40)" stroke-width="2.2" stroke-linecap="round"/>
    <polyline points="240,125 248,132 240,139"
              stroke="rgba(255,255,255,0.40)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Right: choropleth shapes (Europe-ish, teal fill at varying opacity) -->
    <!-- France -->
    <path d="M280 108 L306 98 L332 108 L344 132 L336 156 L312 166 L288 162 L272 142 L274 122 Z"
          fill="rgba(74,184,163,0.50)" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>
    <!-- Germany -->
    <path d="M326 88 L354 80 L376 90 L382 112 L372 130 L350 136 L334 126 L328 108 Z"
          fill="rgba(74,184,163,0.88)" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>
    <!-- Norway/Scandinavia -->
    <path d="M340 50 L362 42 L380 52 L384 72 L374 88 L354 92 L338 82 L334 64 Z"
          fill="rgba(74,184,163,0.28)" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>
    <!-- Portugal/Spain -->
    <path d="M270 162 L296 162 L306 186 L298 212 L272 214 L256 196 L256 178 Z"
          fill="rgba(74,184,163,0.18)" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>
    <!-- Italy -->
    <path d="M330 158 L350 152 L364 164 L362 188 L350 208 L338 206 L328 190 L324 168 Z"
          fill="rgba(74,184,163,0.62)" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>
    <!-- Benelux-ish small -->
    <rect x="314" y="128" width="18" height="14" rx="2"
          fill="rgba(74,184,163,0.42)" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>

    <!-- Color scale legend -->
    <rect x="268" y="278" width="168" height="9" rx="3" fill="url(#id-scale)"/>
    <rect x="268" y="291" width="8"   height="4" rx="1" fill="rgba(255,255,255,0.10)"/>
    <rect x="426" y="291" width="8"   height="4" rx="1" fill="rgba(74,184,163,0.65)"/>
  </svg>
</div>

<style>
  .illu {
    width: 100%;
    height: 100%;
    background: linear-gradient(160deg, #1e3a5f 0%, #2a5780 60%, #1a3050 100%);
  }
  .illu svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
