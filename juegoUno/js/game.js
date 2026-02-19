/**
 * Puzzle 2x4 - Drag & drop. Basic JS only.
 * Images from folder images/ (same aspect ratio recommended: 4:2 = 2:1).
 */

(function () {
  'use strict';

  const ROWS = 2;
  const COLS = 4;
  const TOTAL = ROWS * COLS;
  const IMAGE_NAME_PATTERN = 'img'; // img1.png, img2.png, ...
  const IMAGE_MAX_PROBE = 100;      // deja de probar tras N intentos

  let imageList = []; // lista descubierta dinámicamente

  const board = document.getElementById('board');
  const piecesWrap = document.getElementById('piecesWrap');
  const piecesTop = document.getElementById('piecesTop');
  const piecesLeft = document.getElementById('piecesLeft');
  const piecesRight = document.getElementById('piecesRight');
  const piecesBottom = document.getElementById('piecesBottom');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalText = document.getElementById('modalText');
  const modalBtn = document.getElementById('modalBtn');
  const boardBg = document.getElementById('boardBg');
  const changeImageBtn = document.getElementById('changeImageBtn');

  let currentImageUrl = '';
  let currentImagePath = '';
  let correctCount = 0;
  let slotPieces = []; // slot index -> piece index (0..7) or null

  function pickRandomImage() {
    if (imageList.length === 0) return null;
    return imageList[Math.floor(Math.random() * imageList.length)];
  }

  /** Descubre imágenes: primero intenta manifest.json; si no existe, prueba img1.png, img2.png, ... */
  function discoverImages(done) {
    var manifestUrl = 'images/manifest.json';
    fetch(manifestUrl)
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
      var name = IMAGE_NAME_PATTERN + n + '.png';
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

  function showModal(title, text, onClose) {
    modalTitle.textContent = title;
    modalText.textContent = text;
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

  function setPieceBackground(el, pieceIndex) {
    const col = pieceIndex % COLS;
    const row = Math.floor(pieceIndex / COLS);
    el.style.backgroundImage = 'url(' + currentImageUrl + ')';
    el.style.backgroundSize = (COLS * 100) + '% ' + (ROWS * 100) + '%';
    // Con percentage, position = (area - image) * p; para mostrar tile (col,row) usamos p = col/(COLS-1) y row/(ROWS-1)
    var xPct = COLS > 1 ? (col * 100 / (COLS - 1)) : 0;
    var yPct = ROWS > 1 ? (row * 100 / (ROWS - 1)) : 0;
    el.style.backgroundPosition = xPct + '% ' + yPct + '%';
  }

  function createSlots() {
    board.innerHTML = '';
    if (boardBg) board.appendChild(boardBg);
    slotPieces = new Array(TOTAL).fill(null);
    correctCount = 0;
    for (let i = 0; i < TOTAL; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.index = String(i);
      slot.setAttribute('aria-label', 'Posición ' + (i + 1));
      board.appendChild(slot);
    }
  }

  function createPieces(order) {
    var zones = [piecesTop, piecesLeft, piecesRight, piecesBottom];
    zones.forEach(function (z) { z.innerHTML = ''; });
    order.forEach(function (pieceIndex, i) {
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.pieceIndex = String(pieceIndex);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Pieza ' + (pieceIndex + 1));
      setPieceBackground(el, pieceIndex);
      if (i < 2) piecesTop.appendChild(el);
      else if (i < 4) piecesLeft.appendChild(el);
      else if (i < 6) piecesRight.appendChild(el);
      else piecesBottom.appendChild(el);
    });
  }

  function shuffleOrder() {
    const order = [];
    for (let i = 0; i < TOTAL; i++) order.push(i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function initBoardAndPieces() {
    createSlots();
    createPieces(shuffleOrder());
    attachDragListeners();
  }

  function attachDragListeners() {
    piecesWrap.querySelectorAll('.piece').forEach(function (pieceEl) {
      pieceEl.addEventListener('mousedown', onPieceMouseDown);
    });
  }

  var draggedEl = null;
  var draggedPieceIndex = null;
  var ghost = null;
  var dragOffsetX = 0;
  var dragOffsetY = 0;

  function onPieceMouseDown(e) {
    if (e.button !== 0) return;
    var piece = e.target.closest('.piece');
    if (!piece || !piecesWrap.contains(piece) || piece.closest('.slot')) return;
    e.preventDefault();

    draggedEl = piece;
    draggedPieceIndex = parseInt(piece.dataset.pieceIndex, 10);
    var rect = piece.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    ghost = document.createElement('div');
    ghost.className = 'piece-ghost';
    setPieceBackground(ghost, draggedPieceIndex);
    document.body.appendChild(ghost);
    ghost.style.left = (e.clientX - dragOffsetX) + 'px';
    ghost.style.top = (e.clientY - dragOffsetY) + 'px';

    piece.classList.add('dragging');

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!ghost) return;
    ghost.style.left = (e.clientX - dragOffsetX) + 'px';
    ghost.style.top = (e.clientY - dragOffsetY) + 'px';
    var slot = getSlotFromPoint(e.clientX, e.clientY);
    board.querySelectorAll('.slot').forEach(function (s) {
      if (s === slot && slot && !slot.classList.contains('filled')) s.classList.add('drag-over');
      else s.classList.remove('drag-over');
    });
  }

  function onDragEnd(e) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    board.querySelectorAll('.slot').forEach(function (s) { s.classList.remove('drag-over'); });

    if (ghost) {
      ghost.remove();
      ghost = null;
    }

    if (!draggedEl || draggedPieceIndex == null) {
      draggedEl = null;
      draggedPieceIndex = null;
      return;
    }

    var slot = getSlotFromPoint(e.clientX, e.clientY);
    if (slot && !slot.classList.contains('filled')) {
      var slotIndex = parseInt(slot.dataset.index, 10);
      var isCorrect = draggedPieceIndex === slotIndex;
      if (isCorrect) {
        var inner = document.createElement('div');
        inner.className = 'piece';
        setPieceBackground(inner, draggedPieceIndex);
        slot.appendChild(inner);
        slot.classList.add('filled');
        slotPieces[slotIndex] = draggedPieceIndex;
        correctCount++;
        if (draggedEl.parentNode) draggedEl.remove();
        if (correctCount === TOTAL) {
          var gameBox = piecesWrap.closest('.game-box');
          if (gameBox) gameBox.classList.add('victory');
        }
      } else {
        // showModal('Otra posición', 'Esta pieza no corresponde a esta casilla. Prueba en otra.', function () {});
      }
    }

    if (draggedEl) draggedEl.classList.remove('dragging');
    draggedEl = null;
    draggedPieceIndex = null;
  }

  function getSlotFromPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    return el ? el.closest('.slot') : null;
  }

  function startNewGame() {
    var gameBox = piecesWrap.closest('.game-box');
    if (gameBox) gameBox.classList.remove('victory');
    var filename = pickRandomImage();
    if (!filename) {
      showModal('Sin imágenes', 'Añade fotos en la carpeta images/ con nombres img1.png, img2.png, img3.png, etc.', function () {});
      return;
    }
    currentImagePath = 'images/' + filename;
    var img = new Image();
    img.onload = function () {
      currentImageUrl = img.src;
      if (boardBg) {
        boardBg.style.backgroundImage = 'url(' + currentImageUrl + ')';
      }
      initBoardAndPieces();
    };
    img.onerror = function () {
      showModal('Error', 'No se pudo cargar la imagen. Comprueba que existe en la carpeta images/.', function () {});
    };
    img.src = currentImagePath;
  }

  function onReady() {
    discoverImages(function () {
      startNewGame();
    });
    if (changeImageBtn) {
      changeImageBtn.addEventListener('click', startNewGame);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
