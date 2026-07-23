// Element annotation interactions for exported SVGs
var _annData = __ELEMENT_ANNOTATIONS__;
var _openPopoverId = '';

var _svgSize = _getSvgSize();
var _ttFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
_ttFO.setAttribute('x', '0');
_ttFO.setAttribute('y', '0');
_ttFO.setAttribute('width', _svgSize.w.toString());
_ttFO.setAttribute('height', _svgSize.h.toString());
_ttFO.style.cssText = 'overflow:visible;pointer-events:none';
mapElement.append(_ttFO);
var _ttCurrentId = '';
var _ttMeasuring = false;
var _ttDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
_ttDiv.style.cssText = 'position:absolute;left:0;top:0;width:max-content;opacity:0;pointer-events:none;transform-origin:0 0;will-change:transform,opacity;overflow-wrap:break-word';
_ttFO.appendChild(_ttDiv);

var _poFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
_poFO.setAttribute('width', '1');
_poFO.setAttribute('height', '1');
_poFO.style.cssText = 'overflow:visible;display:none';
mapElement.append(_poFO);

function _getSvgSize() {
    var vb = (mapElement.getAttribute('viewBox') || '').split(/[\s,]+/);
    if (vb.length >= 4) return { minX: parseFloat(vb[0]) || 0, minY: parseFloat(vb[1]) || 0, w: parseFloat(vb[2]), h: parseFloat(vb[3]) };
    return { minX: 0, minY: 0, w: parseFloat(mapElement.getAttribute('width')) || mapElement.clientWidth, h: parseFloat(mapElement.getAttribute('height')) || mapElement.clientHeight };
}

function _positionTooltipAnn(e) {
    // Scale and screen-origin are derived entirely from getBoundingClientRect() + the
    // viewBox — not from mapElement.getScreenCTM(). WebKit has been observed to report a
    // getScreenCTM() that doesn't match the SVG's actual render size/position (both the
    // e/f translation and the a/d scale), which pushed tooltips off from the cursor and,
    // when the SVG was CSS-stretched to a much larger size (only a viewBox, no width/height
    // attributes), shrank the tooltip and dampened how far it tracked the cursor.
    // getBoundingClientRect() is immune to this: the root <svg> is only ever scaled (never
    // rotated/skewed), so renderedSize/viewBoxSize is exactly the scale getScreenCTM() would
    // give in a bug-free browser.
    var rect = mapElement.getBoundingClientRect();
    var svgSize = _getSvgSize();
    var sx = svgSize.w > 0 ? rect.width / svgSize.w : 1;
    var sy = svgSize.h > 0 ? rect.height / svgSize.h : 1;
    var invSx = 1 / sx;
    var invSy = 1 / sy;
    var svgLeft = rect.left - sx * svgSize.minX;
    var svgTop = rect.top - sy * svgSize.minY;
    var offset = 12;
    var posX = e.clientX - svgLeft + offset;
    var posY = e.clientY - svgTop + offset;
    if (_ttDiv.offsetWidth > 0) {
        if (posX + _ttDiv.offsetWidth > rect.width) posX = e.clientX - svgLeft - _ttDiv.offsetWidth - offset;
        if (posY + _ttDiv.offsetHeight > rect.height) posY = e.clientY - svgTop - _ttDiv.offsetHeight - offset;
    }
    _ttDiv.style.transform = 'matrix(' + invSx + ',0,0,' + invSy + ',' + (posX * invSx) + ',' + (posY * invSy) + ')';
}

function _positionPopoverAnn(el, arrowEl, bgColor) {
    var mapRect = mapElement.getBoundingClientRect();
    var svgSize = _getSvgSize();
    var sx = svgSize.w > 0 ? mapRect.width / svgSize.w : 1;
    var sy = svgSize.h > 0 ? mapRect.height / svgSize.h : 1;
    var invSx = 1 / sx;
    var invSy = 1 / sy;
    var svgLeft = mapRect.left - sx * svgSize.minX;
    var svgTop = mapRect.top - sy * svgSize.minY;
    var eb = el.getBoundingClientRect();
    var centerX = eb.left + eb.width / 2 - svgLeft;
    var centerY = eb.top + eb.height / 2 - svgTop;
    var svgW = mapRect.width;
    var contentEl = _poFO.firstChild;
    var rawW = (contentEl && contentEl.offsetWidth) ? contentEl.offsetWidth : 280;
    var rawH = (contentEl && contentEl.offsetHeight) ? contentEl.offsetHeight : 120;
    var x = centerX - rawW / 2;
    x = Math.max(8, Math.min(x, svgW - rawW - 8));
    var yAbove = centerY - rawH - 8;
    var isAbove = yAbove >= 0;
    var y = isAbove ? yAbove : centerY + 8;
    _poFO.setAttribute('x', x.toString());
    _poFO.setAttribute('y', y.toString());
    _poFO.setAttribute('transform', 'scale(' + invSx + ',' + invSy + ')');
    // Arrow offset within the HTML content (in CSS pixels)
    var arrowLeft = Math.max(8, Math.min(Math.round(centerX - x - 8), rawW - 24));
    if (isAbove) {
        arrowEl.style.cssText = 'position:absolute;bottom:-8px;left:' + arrowLeft + 'px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ' + bgColor + ';border-bottom:none;';
    } else {
        arrowEl.style.cssText = 'position:absolute;top:-8px;left:' + arrowLeft + 'px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:8px solid ' + bgColor + ';border-top:none;';
    }
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
                    _ttDiv.innerHTML = ann.tooltip;
                    _ttCurrentId = id;
                    _ttMeasuring = true;
                    _positionTooltipAnn(e);
                    _ttDiv.style.opacity = '0';
                    requestAnimationFrame(function () {
                        _ttMeasuring = false;
                        _positionTooltipAnn(e);
                        _ttDiv.style.opacity = '1';
                    });
                } else {
                    if (_ttMeasuring) return;
                    _positionTooltipAnn(e);
                    _ttDiv.style.opacity = '1';
                }
            });
            el.addEventListener('mouseleave', function () {
                _ttDiv.style.opacity = '0';
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
                    _poFO.style.display = 'none';
                    _poFO.style.opacity = '';
                    _openPopoverId = '';
                    return;
                }
                // Extract bg color for arrow; strip box-shadow (handled by filter on wrapper)
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

                _poFO.style.display = 'none';
                _poFO.innerHTML = '';
                var _poWrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                // overflow-wrap/word-wrap so long unbreakable strings wrap within max-width
                // instead of overflowing it — the tooltip's host div already sets this;
                // the popover's didn't.
                _poWrapper.style.cssText = 'display:inline-block;width:max-content;position:relative;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));overflow-wrap:break-word;word-wrap:break-word;';
                _poWrapper.addEventListener('pointerup', function (e) { e.stopPropagation(); });
                _poWrapper.addEventListener('click', function (e) { e.stopPropagation(); });
                // The popover HTML's own root div carries its width/max-width constraint
                // (e.g. max-width:15rem) inline. Setting it directly as _poWrapper's content
                // (rather than through an extra unstyled wrapper div) matches the tooltip's
                // structure.
                _poWrapper.innerHTML = _tmpEl.innerHTML;
                var _poArrow = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _poWrapper.appendChild(_poArrow);
                _poFO.appendChild(_poWrapper);
                _openPopoverId = id;
                // Use opacity:0 (not display:none) so the content is laid out and
                // offsetWidth/offsetHeight return real values for positioning
                _poFO.style.display = 'block';
                _poFO.style.opacity = '0';
                requestAnimationFrame(function () {
                    _positionPopoverAnn(el, _poArrow, _bgColor);
                    _poFO.style.opacity = '1';
                });
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
mapElement.addEventListener('pointerup', function () {
    _poFO.style.display = 'none';
    _poFO.style.opacity = '';
    _openPopoverId = '';
});
mapElement.addEventListener('click', function () {
    _poFO.style.display = 'none';
    _poFO.style.opacity = '';
    _openPopoverId = '';
});
