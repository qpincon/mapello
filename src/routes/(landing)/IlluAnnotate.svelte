<div class="illu">
  <svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg">

    <!-- Faint geography (simplified country outlines) -->
    <path d="M163 106 L200 96 L238 108 L254 134 L246 162 L220 174 L192 170 L168 150 L160 128 Z"
          stroke="rgba(255,255,255,0.08)" stroke-width="1.2" fill="rgba(255,255,255,0.04)"/>
    <path d="M148 128 L164 118 L176 130 L170 154 L152 160 L140 148 L140 136 Z"
          stroke="rgba(255,255,255,0.06)" stroke-width="1" fill="rgba(255,255,255,0.03)"/>
    <path d="M244 96 L280 86 L306 98 L312 122 L298 140 L272 146 L252 132 L244 114 Z"
          stroke="rgba(255,255,255,0.08)" stroke-width="1.2" fill="rgba(255,255,255,0.04)"/>
    <path d="M268 58 L298 48 L322 60 L324 84 L310 100 L286 102 L268 88 L264 70 Z"
          stroke="rgba(255,255,255,0.06)" stroke-width="1" fill="rgba(255,255,255,0.03)"/>
    <path d="M296 138 L338 132 L360 148 L352 176 L328 188 L302 178 L290 158 Z"
          stroke="rgba(255,255,255,0.08)" stroke-width="1.2" fill="rgba(255,255,255,0.04)"/>
    <path d="M248 166 L268 160 L284 174 L280 200 L260 208 L246 196 L244 178 Z"
          stroke="rgba(255,255,255,0.06)" stroke-width="1" fill="rgba(255,255,255,0.03)"/>

    <!-- Annotation 1: curved dashed arrow between two points -->
    <path d="M 294 76 Q 374 56 394 132"
          stroke="rgba(255,255,255,0.62)" stroke-width="1.8" fill="none"
          stroke-dasharray="6 4" stroke-linecap="round"/>
    <polyline points="387,124 394,132 387,138"
              stroke="rgba(255,255,255,0.62)" stroke-width="1.8" fill="none"
              stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="294" cy="76" r="4.5" fill="#4ab8a3"/>
    <circle cx="394" cy="132" r="4.5" fill="#4ab8a3"/>

    <!-- Annotation 2: label box -->
    <rect x="270" y="46" width="56" height="24" rx="4"
          fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.32)" stroke-width="1"/>
    <rect x="280" y="54"  width="24" height="4" rx="2" fill="rgba(255,255,255,0.45)"/>
    <rect x="280" y="62"  width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.22)"/>
    <!-- Connector -->
    <line x1="298" y1="70" x2="294" y2="76"
          stroke="rgba(255,255,255,0.28)" stroke-width="1" stroke-dasharray="2 2"/>

    <!-- Annotation 3: freehand highlight circle (slightly irregular) -->
    <path d="M168 96 Q198 82 250 96 Q282 104 282 130 Q284 158 256 170 Q222 184 188 174 Q154 162 152 136 Q148 110 168 96 Z"
          stroke="rgba(255,210,70,0.72)" stroke-width="2.4" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Annotation 4: click popover -->
    <circle cx="352" cy="172" r="6" fill="rgba(74,184,163,0.55)" stroke="#4ab8a3" stroke-width="1.2"/>
    <circle cx="352" cy="172" r="2.5" fill="#4ab8a3"/>
    <rect x="308" y="188" width="82" height="52" rx="5"
          fill="rgba(22,16,44,0.88)" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
    <path d="M 352 188 L 347 178 L 357 188 Z"
          fill="rgba(22,16,44,0.88)" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-linejoin="round"/>
    <rect x="318" y="198" width="38" height="4" rx="2" fill="rgba(74,184,163,0.75)"/>
    <rect x="318" y="208" width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.28)"/>
    <rect x="318" y="215" width="36" height="3" rx="1.5" fill="rgba(255,255,255,0.20)"/>
    <rect x="318" y="222" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.20)"/>

    <!-- Annotation 5: map pin -->
    <path d="M 420 56 C 420 38 408 30 400 30 C 392 30 380 38 380 56 C 380 74 400 96 400 96 C 400 96 420 74 420 56 Z"
          fill="rgba(74,184,163,0.75)"/>
    <circle cx="400" cy="56" r="6" fill="rgba(18,12,36,0.65)"/>
  </svg>
</div>

<style>
  .illu {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #2c2a4a 0%, #3d3870 50%, #2a2640 100%);
  }
  .illu svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
