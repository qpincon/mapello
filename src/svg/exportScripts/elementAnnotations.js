// Element annotation interactions for exported SVGs
var _annData = __ELEMENT_ANNOTATIONS__;
var _openPopoverId = '';

var _ttFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
_ttFO.setAttribute('width', '1');
_ttFO.setAttribute('height', '1');
_ttFO.style.cssText = 'overflow:visible;display:none;pointer-events:none';
mapElement.append(_ttFO);

var _poFO = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
_poFO.setAttribute('width', '1');
_poFO.setAttribute('height', '1');
_poFO.style.cssText = 'overflow:visible;display:none';
mapElement.append(_poFO);

function _positionTooltipAnn(e) {
    var b = mapElement.getBoundingClientRect();
    var posX = e.clientX - b.left + 12;
    var posY = e.clientY - b.top + 12;
    var ttContent = _ttFO.firstChild;
    if (ttContent && ttContent.offsetWidth > 0) {
        if (b.right - ttContent.offsetWidth < e.clientX + 12) {
            posX -= ttContent.offsetWidth + 24;
        }
        if (b.bottom - ttContent.offsetHeight < e.clientY + 12) {
            posY -= ttContent.offsetHeight + 24;
        }
    }
    _ttFO.setAttribute('x', posX.toString());
    _ttFO.setAttribute('y', posY.toString());
}

function _positionPopoverAnn(el, arrowEl, bgColor) {
    var sb = mapElement.getBoundingClientRect();
    var eb = el.getBoundingClientRect();
    var centerX = eb.left + eb.width / 2 - sb.left;
    var centerY = eb.top + eb.height / 2 - sb.top;
    var svgW = parseFloat(mapElement.getAttribute('width') || mapElement.clientWidth);
    var contentEl = _poFO.firstChild;
    var annWidth = (contentEl && contentEl.offsetWidth) ? contentEl.offsetWidth : 280;
    var annH = (contentEl && contentEl.offsetHeight) ? contentEl.offsetHeight : 120;
    var x = centerX - annWidth / 2;
    x = Math.max(8, Math.min(x, svgW - annWidth - 8));
    var yAbove = centerY - annH - 8;
    var isAbove = yAbove >= 0;
    var y = isAbove ? yAbove : centerY + 8;
    _poFO.setAttribute('x', x.toString());
    _poFO.setAttribute('y', y.toString());
    var arrowLeft = Math.max(8, Math.min(Math.round(centerX - x - 8), annWidth - 24));
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
                _ttFO.innerHTML = '';
                var _ttDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _ttDiv.style.cssText = 'display:inline-block;width:max-content;';
                _ttDiv.innerHTML = ann.tooltip;
                _ttFO.appendChild(_ttDiv);
                _positionTooltipAnn(e);
                _ttFO.style.display = 'block';
            });
            el.addEventListener('mouseleave', function () {
                _ttFO.style.display = 'none';
            });
        }

        // Popover: click
        if (ann.popover) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                if (_openPopoverId === id) {
                    _poFO.style.display = 'none';
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
                _poWrapper.addEventListener('click', function (e) { e.stopPropagation(); });
                var _poContent = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _poContent.innerHTML = _tmpEl.innerHTML;
                var _poArrow = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _poWrapper.appendChild(_poContent);
                _poWrapper.appendChild(_poArrow);
                _poFO.appendChild(_poWrapper);
                _openPopoverId = id;
                setTimeout(function () {
                    _positionPopoverAnn(el, _poArrow, _bgColor);
                    _poFO.style.display = 'block';
                }, 0);
            });
        }
    })(_annId, _annData[_annId]);
}

mapElement.addEventListener('click', function () {
    _poFO.style.display = 'none';
    _openPopoverId = '';
});
