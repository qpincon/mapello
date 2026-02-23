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
    _ttFO.setAttribute('x', (e.clientX - b.left + 12).toString());
    _ttFO.setAttribute('y', (e.clientY - b.top + 12).toString());
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
        if (ann.type === 'tooltip') {
            el.addEventListener('mousemove', function (e) {
                _ttFO.innerHTML = '';
                var _ttDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _ttDiv.style.cssText = 'display:inline-block;width:max-content;';
                _ttDiv.innerHTML = ann.html;
                _ttFO.appendChild(_ttDiv);
                _positionTooltipAnn(e);
                _ttFO.style.display = 'block';
            });
            el.addEventListener('mouseleave', function () {
                _ttFO.style.display = 'none';
            });
        } else {
            el.style.cursor = 'pointer';
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                if (_openPopoverId === id) {
                    _poFO.style.display = 'none';
                    _openPopoverId = '';
                    return;
                }
                // Extract bg color for arrow
                var _tmpDiv = document.createElement('div');
                console.log(ann.html, _tmpDiv);
                _tmpDiv.innerHTML = ann.html;
                console.log(_tmpDiv);
                var _bgColor = (_tmpDiv.firstElementChild && _tmpDiv.firstElementChild.style.backgroundColor) || 'white';

                _poFO.innerHTML = '';
                var _poWrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                _poWrapper.style.cssText = 'display:inline-block;width:max-content;position:relative;';
                var _poContent = document.createElement('div');
                _poContent.innerHTML = ann.html;
                var _poArrow = document.createElement('div');
                _poWrapper.appendChild(_poContent);
                _poWrapper.appendChild(_poArrow);
                _poFO.appendChild(_poWrapper);
                _poFO.style.display = 'block';
                _openPopoverId = id;
                setTimeout(function () { _positionPopoverAnn(el, _poArrow, _bgColor); }, 0);
            });
        }
    })(_annId, _annData[_annId]);
}

mapElement.addEventListener('click', function () {
    _poFO.style.display = 'none';
    _openPopoverId = '';
});
