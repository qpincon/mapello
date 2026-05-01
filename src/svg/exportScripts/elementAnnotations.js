// Element annotation interactions for exported SVGs
var _annData = __ELEMENT_ANNOTATIONS__;
var _openPopoverId = '';

var _ttFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
_ttFO.setAttribute('width', '1');
_ttFO.setAttribute('height', '1');
_ttFO.style.cssText = 'overflow:visible;display:none;pointer-events:none';
mapElement.append(_ttFO);
var _ttCurrentId = '';
var _ttMeasuring = false;

var _poFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
_poFO.setAttribute('width', '1');
_poFO.setAttribute('height', '1');
_poFO.style.cssText = 'overflow:visible;display:none';
mapElement.append(_poFO);

function _getSvgSize() {
    var vb = (mapElement.getAttribute('viewBox') || '').split(/[\s,]+/);
    if (vb.length >= 4) return { w: parseFloat(vb[2]), h: parseFloat(vb[3]) };
    return { w: parseFloat(mapElement.getAttribute('width')) || mapElement.clientWidth, h: parseFloat(mapElement.getAttribute('height')) || mapElement.clientHeight };
}

function _positionTooltipAnn(e) {
    var ctm = mapElement.getScreenCTM();
    var invSx = ctm ? 1 / ctm.a : 1;
    var invSy = ctm ? 1 / ctm.d : 1;
    var svgLeft = ctm ? ctm.e : 0;
    var svgTop = ctm ? ctm.f : 0;
    var svgSize = _getSvgSize();
    var svgW = svgSize.w * (ctm ? ctm.a : 1);
    var svgH = svgSize.h * (ctm ? ctm.d : 1);
    var offset = 12;
    var posX = e.clientX - svgLeft + offset;
    var posY = e.clientY - svgTop + offset;
    var ttContent = _ttFO.firstChild;
    if (ttContent && ttContent.offsetWidth > 0) {
        if (posX + ttContent.offsetWidth > svgW) posX = e.clientX - svgLeft - ttContent.offsetWidth - offset;
        if (posY + ttContent.offsetHeight > svgH) posY = e.clientY - svgTop - ttContent.offsetHeight - offset;
    }
    _ttFO.setAttribute('x', posX.toString());
    _ttFO.setAttribute('y', posY.toString());
    _ttFO.setAttribute('transform', 'scale(' + invSx + ',' + invSy + ')');
}

function _positionPopoverAnn(el, arrowEl, bgColor) {
    var ctm = mapElement.getScreenCTM();
    var invSx = ctm ? 1 / ctm.a : 1;
    var invSy = ctm ? 1 / ctm.d : 1;
    var svgLeft = ctm ? ctm.e : 0;
    var svgTop = ctm ? ctm.f : 0;
    var eb = el.getBoundingClientRect();
    var centerX = eb.left + eb.width / 2 - svgLeft;
    var centerY = eb.top + eb.height / 2 - svgTop;
    var svgW = _getSvgSize().w * (ctm ? ctm.a : 1);
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
                    _ttFO.innerHTML = '';
                    var _ttDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                    _ttDiv.style.cssText = 'display:inline-block;width:max-content;';
                    _ttDiv.innerHTML = ann.tooltip;
                    _ttFO.appendChild(_ttDiv);
                    _ttCurrentId = id;
                    _ttMeasuring = true;
                    _positionTooltipAnn(e);
                    _ttFO.style.display = 'block';
                    _ttFO.style.opacity = '0';
                    requestAnimationFrame(function () {
                        _ttMeasuring = false;
                        _positionTooltipAnn(e);
                        _ttFO.style.opacity = '1';
                    });
                } else {
                    if (_ttMeasuring) return;
                    _positionTooltipAnn(e);
                    _ttFO.style.display = 'block';
                    _ttFO.style.opacity = '1';
                }
            });
            el.addEventListener('mouseleave', function () {
                _ttFO.style.display = 'none';
                _ttFO.style.opacity = '';
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
                _poWrapper.style.cssText = 'display:inline-block;width:max-content;position:relative;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));';
                _poWrapper.addEventListener('pointerup', function (e) { e.stopPropagation(); });
                _poWrapper.addEventListener('click', function (e) { e.stopPropagation(); });
                var _poContent = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _poContent.innerHTML = _tmpEl.innerHTML;
                var _poArrow = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _poWrapper.appendChild(_poContent);
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
