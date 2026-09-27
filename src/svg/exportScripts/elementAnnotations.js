// Element annotation interactions for exported SVGs
// Depends on overlay.js (createOverlayHost, placeOverlay, placeOverlayAnchored), concatenated
// before this script.
var _annData = __ELEMENT_ANNOTATIONS__;
var _openPopoverId = '';

var _ttHost = createOverlayHost(mapElement);
var _ttCurrentId = '';
var _ttMeasuring = false;

// Popover host: created fresh each time one is shown, removed on dismiss — mirrors
// src/popover.ts (the in-app equivalent), so both behave identically.
var _poHost = null;
var _poArrowEl = null;
var _poTargetEl = null;
var _poBgColor = 'white';
var _poRepositionScheduled = false;

function _hidePopoverAnn() {
    if (_poHost) { _poHost.fo.remove(); _poHost = null; }
    _openPopoverId = '';
    _poArrowEl = null;
    _poTargetEl = null;
    window.removeEventListener('resize', _repositionPopoverAnn);
    window.removeEventListener('scroll', _repositionPopoverAnn, true);
}

// Since placement is derived entirely from getBoundingClientRect() (see overlay.js), anything
// that can move the map or the target on screen without emitting a pointer event — window
// resize, or the page (or an ancestor) scrolling — must re-run it while a popover stays open.
function _repositionPopoverAnn() {
    if (_poRepositionScheduled || !_poHost || !_poTargetEl || !_poArrowEl) return;
    _poRepositionScheduled = true;
    requestAnimationFrame(function () {
        _poRepositionScheduled = false;
        if (!_poHost || !_poTargetEl || !_poArrowEl) return;
        placeOverlayAnchored(_poHost, _poTargetEl, mapElement, _poArrowEl, _poBgColor);
    });
}

for (var _annId in _annData) {
    (function (id, ann) {
        var el = mapElement.getElementById(id);
        if (!el) return;

        // Override pointer-events:none that may be inherited from parent groups (e.g. #points-labels)
        el.style.pointerEvents = 'all';

        // Tooltip: mousemove/mouseleave
        if (ann.tooltip) {
            el.addEventListener('mousemove', function (e) {
                if (_ttCurrentId !== id) {
                    _ttHost.div.innerHTML = ann.tooltip;
                    _ttCurrentId = id;
                    _ttMeasuring = true;
                    placeOverlay(_ttHost, mapElement, e.clientX, e.clientY);
                    _ttHost.div.style.opacity = '0';
                    requestAnimationFrame(function () {
                        _ttMeasuring = false;
                        placeOverlay(_ttHost, mapElement, e.clientX, e.clientY);
                        _ttHost.div.style.opacity = '1';
                    });
                } else {
                    if (_ttMeasuring) return;
                    placeOverlay(_ttHost, mapElement, e.clientX, e.clientY);
                    _ttHost.div.style.opacity = '1';
                }
            });
            el.addEventListener('mouseleave', function () {
                _ttHost.div.style.opacity = '0';
                _ttCurrentId = '';
            });
        }

        // Popover: tap (pointer events) with click fallback for legacy browsers
        if (ann.popover) {
            el.style.cursor = 'pointer';
            // Removes the 300ms tap delay on iOS and prevents double-tap-zoom on the element
            el.style.touchAction = 'manipulation';

            var _tapStartX = 0, _tapStartY = 0, _tapTracking = false, _tapPointerId = -1;

            el.addEventListener('pointerdown', function (e) {
                _tapStartX = e.clientX;
                _tapStartY = e.clientY;
                _tapTracking = true;
                _tapPointerId = e.pointerId;
                // Capture the pointer so pointermove/pointerup always fire on this element,
                // enabling reliable swipe-vs-tap detection even if the finger moves off the element
                try { el.setPointerCapture(e.pointerId); } catch (_) {}
            });

            el.addEventListener('pointermove', function (e) {
                if (!_tapTracking || e.pointerId !== _tapPointerId) return;
                var dx = e.clientX - _tapStartX;
                var dy = e.clientY - _tapStartY;
                if (dx * dx + dy * dy > 64) { _tapTracking = false; } // >8px = swipe, not tap
            });

            el.addEventListener('pointercancel', function () { _tapTracking = false; });

            el.addEventListener('pointerup', function (e) {
                if (!_tapTracking || e.pointerId !== _tapPointerId) return;
                _tapTracking = false;
                e.stopPropagation();
                // Prevent the browser from synthesising a click after this pointerup,
                // which would bubble to the mapElement dismiss handler and close the popover instantly
                e.preventDefault();
                if (_openPopoverId === id) {
                    _hidePopoverAnn();
                    return;
                }
                // Extract bg color for arrow; strip box-shadow (handled by filter on the host).
                // getAttribute/regex, not .style — this document may be a bare XMLDocument
                // (the exported file opened standalone), where a plain (non-createElementNS)
                // element has no working CSSOM .style.
                var _tmpEl = document.createElement('div');
                _tmpEl.innerHTML = ann.popover;
                var _outerEl = _tmpEl.firstElementChild;
                var _bgColor = 'white';
                if (_outerEl) {
                    var _styleAttr = _outerEl.getAttribute('style') || '';
                    var _bgMatch = _styleAttr.match(/background-color\s*:\s*([^;]+)/i);
                    if (_bgMatch) _bgColor = _bgMatch[1].trim();
                    _outerEl.setAttribute('style', _styleAttr.replace(/box-shadow\s*:[^;]*;?\s*/gi, ''));
                }

                _hidePopoverAnn();
                var host = createOverlayHost(mapElement, { pointerEvents: true });
                // filter/drop-shadow on the same element that shrink-wraps its content (rather
                // than an extra wrapper level) — WebKitGTK (GNOME Web) has been observed to not
                // respect a descendant's max-width for shrink-to-fit sizing through an extra
                // plain wrapper level, letting text overflow.
                host.div.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,.3))';
                host.div.addEventListener('pointerup', function (e2) { e2.stopPropagation(); });
                host.div.addEventListener('click', function (e2) { e2.stopPropagation(); });
                // The popover HTML's own root div carries its width/max-width constraint
                // (e.g. max-width:210px) inline — set directly as the host's content.
                host.div.innerHTML = _tmpEl.innerHTML;
                // Namespaced explicitly (not document.createElement): in a standalone-opened
                // .svg, `document` is an XMLDocument, where a plain createElement()'d element
                // has no working .style — but placeOverlayAnchored sets arrowEl.style.cssText.
                var _poArrow = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                host.div.appendChild(_poArrow);

                _openPopoverId = id;
                _poHost = host;
                _poArrowEl = _poArrow;
                _poTargetEl = el;
                _poBgColor = _bgColor;

                // Reveal once measured: opacity:0 above (from createOverlayHost) keeps it
                // invisible but laid out, so offsetWidth/offsetHeight are real by the next frame.
                requestAnimationFrame(function () {
                    if (_openPopoverId !== id || !_poHost) return;
                    placeOverlayAnchored(_poHost, el, mapElement, _poArrow, _bgColor);
                    _poHost.div.style.opacity = '1';
                });
                window.addEventListener('resize', _repositionPopoverAnn);
                window.addEventListener('scroll', _repositionPopoverAnn, true);
            });

            // Swallow any residual synthetic click that some browsers fire after pointerup,
            // so it doesn't bubble up to the mapElement dismiss handler
            el.addEventListener('click', function (e) { e.stopPropagation(); });
        }
    })(_annId, _annData[_annId]);
}

// Dismiss open popover when tapping/clicking on empty SVG area.
// pointerup handles touch (fires when per-element handler didn't stopPropagation, i.e. empty area tap).
// click is a fallback for browsers without Pointer Events support.
mapElement.addEventListener('pointerup', function () { _hidePopoverAnn(); });
mapElement.addEventListener('click', function () { _hidePopoverAnn(); });
