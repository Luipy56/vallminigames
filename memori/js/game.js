/**
 * Memori: modal para dibujar una tarjeta, luego juego de pares (1 par = dibujo usuario, resto = fotos en images/).
 */

(function () {
  'use strict';

  const TOTAL_PAIRS = 6;
  const FLIP_BACK_DELAY_MS = 1500;
  const IMAGE_NAME_PATTERN = 'img';
  const IMAGE_MAX_PROBE = 100;

  const drawModalOverlay = document.getElementById('drawModalOverlay');
  const drawCanvas = document.getElementById('drawCanvas');
  const drawClearBtn = document.getElementById('drawClearBtn');
  const drawDoneBtn = document.getElementById('drawDoneBtn');
  const memoriBoardWrap = document.getElementById('memoriBoardWrap');
  const memoriGrid = document.getElementById('memoriGrid');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalText = document.getElementById('modalText');
  const modalBtn = document.getElementById('modalBtn');
  const backBtn = document.getElementById('backBtn');

  let imageList = [];
  let userCardDataUrl = '';
  let hasDrawn = false;
  let cards = [];
  let flippedIndices = [];
  let matchedPairs = 0;
  let blockClicks = false;

  function getCanvasCoords(e) {
    var rect = drawCanvas.getBoundingClientRect();
    var scaleX = drawCanvas.width / rect.width;
    var scaleY = drawCanvas.height / rect.height;
    var clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    var clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function initDrawing() {
    var ctx = drawCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    hasDrawn = false;

    var isDrawing = false;
    var last = null;

    function draw(x, y) {
      if (!isDrawing) return;
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      last = { x: x, y: y };
      hasDrawn = true;
    }

    function onPointerDown(e) {
      e.preventDefault();
      isDrawing = true;
      last = getCanvasCoords(e);
    }
    function onPointerMove(e) {
      e.preventDefault();
      var co = getCanvasCoords(e);
      draw(co.x, co.y);
    }
    function onPointerUp(e) {
      e.preventDefault();
      isDrawing = false;
      last = null;
    }

    drawCanvas.addEventListener('mousedown', onPointerDown);
    drawCanvas.addEventListener('mousemove', onPointerMove);
    drawCanvas.addEventListener('mouseup', onPointerUp);
    drawCanvas.addEventListener('mouseleave', onPointerUp);
    drawCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
    drawCanvas.addEventListener('touchmove', onPointerMove, { passive: false });
    drawCanvas.addEventListener('touchend', onPointerUp, { passive: false });
  }

  function clearCanvas() {
    var ctx = drawCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    hasDrawn = false;
  }

  function discoverImages(done) {
    fetch('images/manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (arr) {
        if (Array.isArray(arr) && arr.length > 0) {
          imageList = arr.filter(function (x) { return typeof x === 'string' && x.length > 0; });
          done();
          return;
        }
        probeImageSequence(done);
      })
      .catch(function () { probeImageSequence(done); });
  }

  function probeImageSequence(done) {
    var list = [];
    var n = 1;
    function tryNext() {
      if (n > IMAGE_MAX_PROBE) {
        imageList = list;
        done();
        return;
      }
      var name = IMAGE_NAME_PATTERN + n + '.jpg';
      var img = new Image();
      img.onload = function () {
        list.push(name);
        n++;
        tryNext();
      };
      img.onerror = function () {
        imageList = list;
        done();
      };
      img.src = 'images/' + name;
    }
    tryNext();
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function buildDeck() {
    var needPhotoPairs = TOTAL_PAIRS - 1;
    if (imageList.length < needPhotoPairs) {
      return null;
    }
    var deck = [];
    deck.push({ pairId: 'user', imageUrl: userCardDataUrl });
    deck.push({ pairId: 'user', imageUrl: userCardDataUrl });
    var picked = [];
    var indices = [];
    for (var i = 0; i < imageList.length; i++) indices.push(i);
    for (var p = 0; p < needPhotoPairs; p++) {
      var idx = Math.floor(Math.random() * indices.length);
      var pos = indices[idx];
      indices.splice(idx, 1);
      var name = imageList[pos];
      var url = 'images/' + name;
      deck.push({ pairId: name, imageUrl: url });
      deck.push({ pairId: name, imageUrl: url });
    }
    return shuffleArray(deck);
  }

  function showModal(title, text, btnLabel, onClose) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalBtn.textContent = btnLabel || 'Aceptar';
    modalOverlay.hidden = false;
    modalOverlay.removeAttribute('hidden');
    function close() {
      modalOverlay.hidden = true;
      modalOverlay.setAttribute('hidden', '');
      modalBtn.removeEventListener('click', close);
      if (typeof onClose === 'function') onClose();
    }
    modalBtn.onclick = close;
  }

  function createCardElement(card, index) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'memori-card';
    el.dataset.index = String(index);
    el.setAttribute('aria-label', 'Carta ' + (index + 1));
    var back = document.createElement('div');
    back.className = 'card-back';
    el.appendChild(back);
    el.addEventListener('click', function () { onCardClick(index); });
    return el;
  }

  function setCardFace(el, imageUrl, show) {
    if (show) {
      el.style.backgroundImage = 'url(' + imageUrl + ')';
      el.classList.add('flipped');
      el.innerHTML = '';
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('flipped');
      var back = document.createElement('div');
      back.className = 'card-back';
      el.appendChild(back);
    }
  }

  function onCardClick(index) {
    if (blockClicks) return;
    var card = cards[index];
    if (!card || card.matched || card.element.classList.contains('flipped')) return;
    if (flippedIndices.length >= 2) return;

    setCardFace(card.element, card.imageUrl, true);
    flippedIndices.push(index);

    if (flippedIndices.length === 2) {
      var a = cards[flippedIndices[0]];
      var b = cards[flippedIndices[1]];
      if (a.pairId === b.pairId) {
        a.matched = true;
        b.matched = true;
        a.element.classList.add('matched');
        b.element.classList.add('matched');
        matchedPairs++;
        flippedIndices = [];
        if (matchedPairs === TOTAL_PAIRS) {
          setTimeout(function () {
            showModal('Has completado el memori', '¡Enhorabuena! Has encontrado todas las parejas.', 'Jugar de nuevo', startOver);
          }, 400);
        }
      } else {
        blockClicks = true;
        setTimeout(function () {
          setCardFace(a.element, a.imageUrl, false);
          setCardFace(b.element, b.imageUrl, false);
          flippedIndices = [];
          blockClicks = false;
        }, FLIP_BACK_DELAY_MS);
      }
    }
  }

  function startGame() {
    memoriGrid.innerHTML = '';
    cards = [];
    flippedIndices = [];
    matchedPairs = 0;
    blockClicks = false;

    var deck = buildDeck();
    if (!deck) {
      showModal('Faltan imágenes', 'Añade al menos ' + (TOTAL_PAIRS - 1) + ' fotos en la carpeta images/ (img1.png, img2.png, …).', 'Aceptar', function () { showDrawModal(); });
      return;
    }

    deck.forEach(function (c, i) {
      var el = createCardElement(c, i);
      memoriGrid.appendChild(el);
      cards.push({ pairId: c.pairId, imageUrl: c.imageUrl, element: el, matched: false });
    });
    memoriBoardWrap.hidden = false;
  }

  function showDrawModal() {
    memoriBoardWrap.hidden = true;
    clearCanvas();
    drawModalOverlay.hidden = false;
    drawModalOverlay.removeAttribute('hidden');
  }

  function startOver() {
    showDrawModal();
  }

  function onDrawDone() {
    if (!hasDrawn) {
      showModal('Dibuja algo', 'Dibuja tu tarjeta en el recuadro antes de continuar.', 'Aceptar', function () {});
      return;
    }
    userCardDataUrl = drawCanvas.toDataURL('image/png');
    drawModalOverlay.hidden = true;
    drawModalOverlay.setAttribute('hidden', '');

    discoverImages(function () {
      startGame();
    });
  }

  function onBack() {
    if (window.location.pathname.replace(/\/$/, '').split('/').pop() === 'memori') {
      window.location.href = '../';
    } else {
      window.location.href = 'index.html';
    }
  }

  function onReady() {
    initDrawing();
    drawClearBtn.addEventListener('click', clearCanvas);
    drawDoneBtn.addEventListener('click', onDrawDone);
    if (backBtn) backBtn.addEventListener('click', onBack);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
