/**
 * Unframed · Studio (Frontend Application)
 * Local 4K Art Mode Studio & TV Sync for Samsung The Frame
 */

(function () {
  'use strict';

  // ---- Samsung Frame Matte Definitions -----------------------------------
  const MATTE_COLORS = [
    { id: 'polar', name: 'Polar', hex: '#f4f5f0' },
    { id: 'warm', name: 'Warm', hex: '#ebe6dc' },
    { id: 'antique', name: 'Antique', hex: '#dfd7c8' },
    { id: 'neutral', name: 'Neutral', hex: '#c8c4bc' },
    { id: 'black', name: 'Black', hex: '#1c1c1c' },
    { id: 'sand', name: 'Sand', hex: '#d6c6b2' },
    { id: 'seafoam', name: 'Seafoam', hex: '#c2d1cc' },
    { id: 'sage', name: 'Sage', hex: '#aebfae' },
    { id: 'burgandy', name: 'Burgundy', hex: '#5c282b' },
    { id: 'navy', name: 'Navy', hex: '#233247' },
    { id: 'apricot', name: 'Apricot', hex: '#e8b89a' },
    { id: 'byzantine', name: 'Byzantine', hex: '#7a3b69' },
    { id: 'lavender', name: 'Lavender', hex: '#c7bed6' },
    { id: 'redorange', name: 'Red Orange', hex: '#c94a38' },
    { id: 'skyblue', name: 'Sky Blue', hex: '#a5c4d4' },
    { id: 'turquoise', name: 'Turquoise', hex: '#4c9a9c' }
  ];

  const MATTE_TYPES = [
    { id: 'none', label: 'None (0%)', class: 'matte-none' },
    { id: 'modernthin', label: 'Modern Thin (3%)', class: 'matte-modernthin' },
    { id: 'modern', label: 'Modern (6%)', class: 'matte-modern' },
    { id: 'modernwide', label: 'Modern Wide (10%)', class: 'matte-modernwide' },
    { id: 'flexible', label: 'Flexible (7% Bevel)', class: 'matte-flexible' },
    { id: 'shadowbox', label: 'Shadow Box (6% Inset)', class: 'matte-shadowbox' },
    { id: 'panoramic', label: 'Panoramic (10%/4%)', class: 'matte-panoramic' }
  ];

  // ---- Application State -------------------------------------------------
  const state = {
    // Matte & Filter State
    matteType: 'flexible',
    matteColor: 'polar',
    photoFilter: 'None',

    // Active Artwork & Cropper State
    image: null,
    fileName: 'artwork.jpg',
    panX: 0,
    panY: 0,
    zoom: 1.0,
    rotation: 0, // 0, 90, 180, 270 degrees
    fitMode: 'fill', // 'fill' or 'fit'
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    showGrid: false,

    // Touch pinch state
    touchDistance: null,

    // TV & Gallery State
    tvConnected: false,
    tvStatus: null,
    currentArtId: null,
    myPhotos: [],
    deletingContentId: null,
    modalReturnFocus: null,

    // Polling timer
    pollTimer: null
  };

  // ---- DOM Elements ------------------------------------------------------
  const dom = {
    // Masthead & TV Status
    tvStatusBadge: document.getElementById('tvStatusBadge'),
    tvStatusIndicator: document.getElementById('tvStatusIndicator'),
    tvStatusText: document.getElementById('tvStatusText'),
    tvPickerSelect: document.getElementById('tvPickerSelect'),
    discoverTvBtn: document.getElementById('discoverTvBtn'),
    artModeBtn: document.getElementById('artModeBtn'),
    artModeText: document.getElementById('artModeText'),
    slideshowSelect: document.getElementById('slideshowSelect'),
    slideshowShuffleBtn: document.getElementById('slideshowShuffleBtn'),
    slideshowShuffleText: document.getElementById('slideshowShuffleText'),
    refreshStatusBtn: document.getElementById('refreshStatusBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIcon: document.getElementById('themeIcon'),
    themeLabel: document.getElementById('themeLabel'),

    // Studio & File Input
    fileInput: document.getElementById('fileInput'),
    chooseFileBtn: document.getElementById('chooseFileBtn'),
    imageMetaBar: document.getElementById('imageMetaBar'),
    imageFileName: document.getElementById('imageFileName'),
    imageNaturalDims: document.getElementById('imageNaturalDims'),
    clearImageBtn: document.getElementById('clearImageBtn'),

    // Frame Simulator & Viewport
    frameBezel: document.getElementById('frameBezel'),
    frameMatte: document.getElementById('frameMatte'),
    artViewport: document.getElementById('artViewport'),
    viewportCanvas: document.getElementById('viewportCanvas'),
    gridOverlay: document.getElementById('gridOverlay'),
    viewportDropzone: document.getElementById('viewportDropzone'),
    dropzoneBrowseBtn: document.getElementById('dropzoneBrowseBtn'),

    // Controls
    zoomRange: document.getElementById('zoomRange'),
    zoomValue: document.getElementById('zoomValue'),
    rotateBtn: document.getElementById('rotateBtn'),
    centerBtn: document.getElementById('centerBtn'),
    fitBtn: document.getElementById('fitBtn'),
    fillBtn: document.getElementById('fillBtn'),
    gridToggleBtn: document.getElementById('gridToggleBtn'),
    resetCropBtn: document.getElementById('resetCropBtn'),

    // Crop Metadata
    sourceCropText: document.getElementById('sourceCropText'),
    effectiveScaleText: document.getElementById('effectiveScaleText'),

    // Matte & Color Picker
    currentMatteTypeLabel: document.getElementById('currentMatteTypeLabel'),
    matteTypePills: document.getElementById('matteTypePills'),
    matteColorSection: document.getElementById('matteColorSection'),
    currentMatteColorLabel: document.getElementById('currentMatteColorLabel'),
    colorSwatchGrid: document.getElementById('colorSwatchGrid'),
    currentFilterLabel: document.getElementById('currentFilterLabel'),
    filterPills: document.getElementById('filterPills'),
    targetMatteIdText: document.getElementById('targetMatteIdText'),

    // Upload & Push
    showNowCheckbox: document.getElementById('showNowCheckbox'),
    pushToTvBtn: document.getElementById('pushToTvBtn'),
    uploadProgressWrap: document.getElementById('uploadProgressWrap'),
    uploadProgressBar: document.getElementById('uploadProgressBar'),
    uploadProgressTrack: document.getElementById('uploadProgressTrack'),
    uploadProgressText: document.getElementById('uploadProgressText'),

    // Gallery
    galleryCountText: document.getElementById('galleryCountText'),
    refreshGalleryBtn: document.getElementById('refreshGalleryBtn'),
    galleryGrid: document.getElementById('galleryGrid'),
    galleryEmptyState: document.getElementById('galleryEmptyState'),

    // Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteContentIdText: document.getElementById('deleteContentIdText'),
    closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  const canvasCtx = dom.viewportCanvas.getContext('2d');
  // Canvas coordinate system: 1920x1080 buffer for crispness (ratio 2:1 vs 3840x2160)
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  dom.viewportCanvas.width = CANVAS_WIDTH;
  dom.viewportCanvas.height = CANVAS_HEIGHT;

  // ---- Notifications / Toast ---------------------------------------------
  function showToast(message, type = 'info', duration) {
    // Errors stay up longer and interrupt screen readers; everything else is polite.
    const ms = duration || (type === 'error' ? 8000 : 3500);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (type === 'error') toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button type="button" class="btn-link" style="color: inherit;" aria-label="Dismiss notification"><span aria-hidden="true">✕</span></button>
    `;
    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => toast.remove());

    // Pause auto-dismiss while the pointer or keyboard focus is on the toast (WCAG 2.2.1)
    let timer = null;
    const dismiss = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => toast.remove(), 200);
    };
    const arm = () => { clearTimeout(timer); timer = setTimeout(dismiss, ms); };
    const pause = () => clearTimeout(timer);
    toast.addEventListener('mouseenter', pause);
    toast.addEventListener('mouseleave', arm);
    toast.addEventListener('focusin', pause);
    toast.addEventListener('focusout', arm);

    dom.toastContainer.appendChild(toast);
    arm();
  }

  function setPressed(el, pressed) {
    el.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  function setProgress(pct) {
    dom.uploadProgressBar.style.width = `${pct}%`;
    dom.uploadProgressTrack.setAttribute('aria-valuenow', String(pct));
  }

  function setShuffleUI(shuffle) {
    dom.slideshowShuffleBtn.dataset.shuffle = shuffle ? 'true' : 'false';
    setPressed(dom.slideshowShuffleBtn, shuffle);
    dom.slideshowShuffleText.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
  }

  function setArtModeUI(stateName) {
    dom.artModeBtn.dataset.state = stateName;
    dom.artModeText.textContent = stateName === 'unknown' ? '--' : stateName.toUpperCase();
    if (stateName === 'unknown') dom.artModeBtn.removeAttribute('aria-pressed');
    else setPressed(dom.artModeBtn, stateName === 'on');
  }

  function setFitModeUI(mode) {
    dom.fitBtn.classList.toggle('active', mode === 'fit');
    dom.fillBtn.classList.toggle('active', mode === 'fill');
    setPressed(dom.fitBtn, mode === 'fit');
    setPressed(dom.fillBtn, mode === 'fill');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Theme Handling ----------------------------------------------------
  function initTheme() {
    const isNight = document.documentElement.classList.contains('vd-night');
    updateThemeButton(isNight);

    dom.themeToggleBtn.addEventListener('click', () => {
      const night = document.documentElement.classList.toggle('vd-night');
      try { localStorage.setItem('vd-theme', night ? 'night' : 'day'); } catch (e) { /* storage blocked */ }
      updateThemeButton(night);
    });
  }

  function updateThemeButton(isNight) {
    dom.themeIcon.textContent = isNight ? '☾' : '☀';
    dom.themeLabel.textContent = isNight ? 'Moon' : 'Dawn';
    setPressed(dom.themeToggleBtn, isNight);
  }

  // ---- Swatches & Matte Controls Setup ------------------------------------
  function initMatteControls() {
    // Populate 16 Samsung Matte Color Swatches
    dom.colorSwatchGrid.innerHTML = '';
    MATTE_COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-swatch-btn ${color.id === state.matteColor ? 'active' : ''}`;
      btn.dataset.colorId = color.id;
      btn.style.backgroundColor = color.hex;
      btn.title = `${color.name} (${color.hex})`;
      btn.setAttribute('aria-pressed', color.id === state.matteColor ? 'true' : 'false');
      btn.innerHTML = `<span class="swatch-label">${escapeHtml(color.name)}</span>`;

      btn.addEventListener('click', () => {
        selectMatteColor(color.id);
      });
      dom.colorSwatchGrid.appendChild(btn);
    });

    // Matte Type Pills
    dom.matteTypePills.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-pill');
      if (!btn) return;
      const type = btn.dataset.type;
      selectMatteType(type);
    });

    // Filter Pills
    dom.filterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-pill');
      if (!btn) return;
      const filter = btn.dataset.filter;
      selectFilter(filter);
    });

    updateMatteSimulatorUI();
  }

  function selectMatteType(type) {
    state.matteType = type;
    dom.matteTypePills.querySelectorAll('.btn-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.type === type);
      setPressed(btn, btn.dataset.type === type);
    });
    const item = MATTE_TYPES.find((m) => m.id === type) || { label: type };
    dom.currentMatteTypeLabel.textContent = item.label;
    updateMatteSimulatorUI();
  }

  function selectMatteColor(colorId) {
    state.matteColor = colorId;
    dom.colorSwatchGrid.querySelectorAll('.color-swatch-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.colorId === colorId);
      setPressed(btn, btn.dataset.colorId === colorId);
    });
    const item = MATTE_COLORS.find((c) => c.id === colorId) || { name: colorId, hex: '' };
    dom.currentMatteColorLabel.textContent = `${item.name} · ${item.hex}`;
    updateMatteSimulatorUI();
  }

  function selectFilter(filter) {
    state.photoFilter = filter;
    dom.filterPills.querySelectorAll('.btn-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
      setPressed(btn, btn.dataset.filter === filter);
    });
    dom.currentFilterLabel.textContent = filter.charAt(0).toUpperCase() + filter.slice(1);
  }

  function getComputedMatteId() {
    return state.matteType === 'none' ? 'none' : `${state.matteType}_${state.matteColor}`;
  }

  function updateMatteSimulatorUI() {
    // Update frame matte CSS class
    dom.frameMatte.className = `frame-matte matte-${state.matteType}`;

    const colorItem = MATTE_COLORS.find((c) => c.id === state.matteColor) || MATTE_COLORS[0];
    const noMatte = state.matteType === 'none';
    dom.frameMatte.style.backgroundColor = noMatte ? 'transparent' : colorItem.hex;
    dom.matteColorSection.setAttribute('aria-disabled', noMatte ? 'true' : 'false');
    dom.colorSwatchGrid.querySelectorAll('.color-swatch-btn').forEach((btn) => {
      btn.disabled = noMatte;
    });

    dom.targetMatteIdText.textContent = getComputedMatteId();
  }

  // ---- Image Loading & Cropper Engine ------------------------------------
  function initCropper() {
    // File inputs & triggers
    dom.chooseFileBtn.addEventListener('click', () => dom.fileInput.click());
    dom.dropzoneBrowseBtn.addEventListener('click', () => dom.fileInput.click());
    dom.viewportDropzone.addEventListener('click', (e) => {
      if (e.target === dom.dropzoneBrowseBtn) return;
      dom.fileInput.click();
    });

    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleSelectedFile(file);
    });

    dom.clearImageBtn.addEventListener('click', () => {
      dom.fileInput.value = '';
      dom.fileInput.click();
    });

    // Drag & Drop on Viewport
    const dropzone = dom.viewportDropzone;
    ['dragenter', 'dragover'].forEach((eventName) => {
      dom.artViewport.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dom.artViewport.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
      });
    });

    dom.artViewport.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files && dt.files[0];
      if (file) handleSelectedFile(file);
    });

    // Controls: Zoom Slider
    dom.zoomRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setZoom(val);
    });

    // Controls: Rotate 90° Clockwise
    dom.rotateBtn.addEventListener('click', () => {
      state.rotation = (state.rotation + 90) % 360;
      renderCanvas();
    });

    // Controls: Center
    dom.centerBtn.addEventListener('click', () => {
      state.panX = 0;
      state.panY = 0;
      renderCanvas();
    });

    // Controls: Fit / Fill
    dom.fitBtn.addEventListener('click', () => {
      state.fitMode = 'fit';
      state.zoom = 1.0;
      state.panX = 0;
      state.panY = 0;
      dom.zoomRange.value = 1.0;
      setFitModeUI('fit');
      renderCanvas();
    });

    dom.fillBtn.addEventListener('click', () => {
      state.fitMode = 'fill';
      state.zoom = 1.0;
      state.panX = 0;
      state.panY = 0;
      dom.zoomRange.value = 1.0;
      setFitModeUI('fill');
      renderCanvas();
    });

    // Controls: Grid Toggle
    dom.gridToggleBtn.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      dom.gridOverlay.style.display = state.showGrid ? 'block' : 'none';
      dom.gridToggleBtn.classList.toggle('active', state.showGrid);
      setPressed(dom.gridToggleBtn, state.showGrid);
    });

    // Controls: Reset Crop
    dom.resetCropBtn.addEventListener('click', () => {
      state.panX = 0;
      state.panY = 0;
      state.zoom = 1.0;
      state.rotation = 0;
      state.fitMode = 'fill';
      dom.zoomRange.value = 1.0;
      dom.zoomValue.textContent = '1.00×';
      setFitModeUI('fill');
      renderCanvas();
    });

    // Viewport Pan (Mouse)
    dom.artViewport.addEventListener('mousedown', (e) => {
      if (!state.image) return;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      dom.artViewport.classList.add('is-panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.isDragging || !state.image) return;
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;

      // Scale screen drag delta to canvas resolution
      const rect = dom.artViewport.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / (rect.width || 1);
      const scaleY = CANVAS_HEIGHT / (rect.height || 1);

      state.panX += dx * scaleX;
      state.panY += dy * scaleY;
      renderCanvas();
    });

    window.addEventListener('mouseup', () => {
      if (state.isDragging) {
        state.isDragging = false;
        dom.artViewport.classList.remove('is-panning');
      }
    });

    // Keyboard Pan & Zoom
    dom.artViewport.addEventListener('keydown', (e) => {
      if (!state.image) return;
      const step = e.shiftKey ? 120 : 24; // canvas px (1920×1080 space)
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        state.panX += moves[e.key][0];
        state.panY += moves[e.key][1];
        renderCanvas();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(state.zoom + 0.1);
      } else if (e.key === '-' || e.key === '_') {
        setZoom(state.zoom - 0.1);
      } else if (e.key === '0') {
        dom.resetCropBtn.click();
      } else {
        return;
      }
      e.preventDefault();
    });

    // Mouse Wheel Zoom
    dom.artViewport.addEventListener('wheel', (e) => {
      if (!state.image) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom(state.zoom + delta);
    }, { passive: false });

    // Touch Support (Pan + Pinch Zoom)
    dom.artViewport.addEventListener('touchstart', (e) => {
      if (!state.image) return;
      if (e.touches.length === 1) {
        state.isDragging = true;
        state.dragStartX = e.touches[0].clientX;
        state.dragStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        state.isDragging = false;
        state.touchDistance = getTouchDistance(e.touches);
      }
    }, { passive: true });

    dom.artViewport.addEventListener('touchmove', (e) => {
      if (!state.image) return;
      if (e.touches.length === 1 && state.isDragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - state.dragStartX;
        const dy = e.touches[0].clientY - state.dragStartY;
        state.dragStartX = e.touches[0].clientX;
        state.dragStartY = e.touches[0].clientY;

        const rect = dom.artViewport.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / (rect.width || 1);
        const scaleY = CANVAS_HEIGHT / (rect.height || 1);

        state.panX += dx * scaleX;
        state.panY += dy * scaleY;
        renderCanvas();
      } else if (e.touches.length === 2 && state.touchDistance) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches);
        const factor = currentDist / state.touchDistance;
        state.touchDistance = currentDist;
        setZoom(state.zoom * factor);
      }
    }, { passive: false });

    dom.artViewport.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) state.touchDistance = null;
      if (e.touches.length === 0) state.isDragging = false;
    });

    // Upload / Push to The Frame Trigger
    dom.pushToTvBtn.addEventListener('click', handleUploadToTv);
  }

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function setZoom(val) {
    const clamped = Math.min(4.0, Math.max(1.0, val));
    state.zoom = clamped;
    dom.zoomRange.value = clamped;
    dom.zoomValue.textContent = `${clamped.toFixed(2)}×`;
    renderCanvas();
  }

  function handleSelectedFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp)/)) {
      showToast('Please select a valid image file (JPEG, PNG, or WebP).', 'error');
      return;
    }

    state.fileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.image = img;
        state.panX = 0;
        state.panY = 0;
        state.zoom = 1.0;
        state.rotation = 0;
        state.fitMode = 'fill';

        // Update UI
        dom.viewportDropzone.style.display = 'none';
        dom.artViewport.classList.add('has-image');
        dom.imageMetaBar.style.display = 'flex';
        dom.imageFileName.textContent = file.name;
        dom.imageNaturalDims.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;

        // Enable tool buttons
        dom.zoomRange.disabled = false;
        dom.zoomRange.value = 1.0;
        dom.zoomValue.textContent = '1.00×';
        dom.rotateBtn.disabled = false;
        dom.centerBtn.disabled = false;
        dom.fitBtn.disabled = false;
        dom.fillBtn.disabled = false;
        dom.resetCropBtn.disabled = false;
        dom.pushToTvBtn.disabled = false;
        setFitModeUI('fill');
        dom.artViewport.tabIndex = 0;

        renderCanvas();
        showToast(`Loaded ${file.name} (${img.naturalWidth}×${img.naturalHeight})`, 'success');
      };
      img.onerror = () => {
        showToast('Failed to decode image data.', 'error');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function computeTransforms() {
    const img = state.image;
    if (!img) return null;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const isSideways = state.rotation === 90 || state.rotation === 270;
    const effW = isSideways ? naturalH : naturalW;
    const effH = isSideways ? naturalW : naturalH;

    // Fill vs Fit scale relative to 1920x1080 canvas
    const scaleFill = Math.max(CANVAS_WIDTH / effW, CANVAS_HEIGHT / effH);
    const scaleFit = Math.min(CANVAS_WIDTH / effW, CANVAS_HEIGHT / effH);
    const baseScale = state.fitMode === 'fill' ? scaleFill : scaleFit;
    const totalScale = baseScale * state.zoom;

    return {
      naturalW,
      naturalH,
      effW,
      effH,
      totalScale
    };
  }

  function renderCanvas() {
    canvasCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Deep black base for the 16:9 art screen
    canvasCtx.fillStyle = '#0a0a0a';
    canvasCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (!state.image) {
      dom.sourceCropText.textContent = '-- × -- px';
      dom.effectiveScaleText.textContent = '1.00×';
      return;
    }

    const t = computeTransforms();
    if (!t) return;

    canvasCtx.save();
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.imageSmoothingQuality = 'high';

    // Move to center of 16:9 viewport + applied pan
    canvasCtx.translate(CANVAS_WIDTH / 2 + state.panX, CANVAS_HEIGHT / 2 + state.panY);
    // Rotate
    canvasCtx.rotate((state.rotation * Math.PI) / 180);

    // Draw scaled image centered at origin
    const drawW = t.naturalW * t.totalScale;
    const drawH = t.naturalH * t.totalScale;
    canvasCtx.drawImage(state.image, -drawW / 2, -drawH / 2, drawW, drawH);
    canvasCtx.restore();

    // Calculate source crop metrics visible in 16:9 viewport
    const visibleSourceW = Math.round(CANVAS_WIDTH / t.totalScale);
    const visibleSourceH = Math.round(CANVAS_HEIGHT / t.totalScale);
    dom.sourceCropText.textContent = `${visibleSourceW} × ${visibleSourceH} px`;
    dom.effectiveScaleText.textContent = `${(t.totalScale * 2).toFixed(2)}×`; // Scale factor at 3840x2160 UHD
  }

  // ---- 3840×2160 UHD Offscreen Render & Push to TV -------------------------
  async function handleUploadToTv() {
    if (!state.image) {
      showToast('Please load an artwork image first.', 'error');
      return;
    }

    const t = computeTransforms();
    if (!t) return;

    dom.pushToTvBtn.disabled = true;
    dom.uploadProgressWrap.style.display = 'flex';
    setProgress(20);
    dom.uploadProgressText.textContent = 'Rendering 3840×2160 UHD canvas...';

    try {
      // 1. Create high-resolution 3840×2160 offscreen canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = 3840;
      offscreen.height = 2160;
      const octx = offscreen.getContext('2d');
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';

      // Deep black background
      octx.fillStyle = '#000000';
      octx.fillRect(0, 0, 3840, 2160);

      // Multiplier from 1920x1080 preview to 3840x2160 UHD target is exactly 2.0
      const MULTIPLIER = 3840 / CANVAS_WIDTH;
      const totalScaleUHD = t.totalScale * MULTIPLIER;
      const panXUHD = state.panX * MULTIPLIER;
      const panYUHD = state.panY * MULTIPLIER;

      octx.save();
      octx.translate(3840 / 2 + panXUHD, 2160 / 2 + panYUHD);
      octx.rotate((state.rotation * Math.PI) / 180);

      const drawWUHD = t.naturalW * totalScaleUHD;
      const drawHUHD = t.naturalH * totalScaleUHD;
      octx.drawImage(state.image, -drawWUHD / 2, -drawHUHD / 2, drawWUHD, drawHUHD);
      octx.restore();

      setProgress(45);
      dom.uploadProgressText.textContent = 'Encoding 4K JPEG (0.95 quality)...';

      // 2. Export as high-quality JPEG Blob
      const blob = await new Promise((resolve, reject) => {
        offscreen.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas export failed'));
        }, 'image/jpeg', 0.95);
      });

      setProgress(65);
      dom.uploadProgressText.textContent = 'Transmitting to Samsung The Frame...';

      // 3. Build multipart FormData
      const formData = new FormData();
      const sanitizedName = (state.fileName || 'artwork')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      formData.append('file', blob, `${sanitizedName}_3840x2160.jpg`);

      const matteId = getComputedMatteId();
      formData.append('matte_id', matteId);
      formData.append('portrait_matte_id', matteId);
      formData.append('photo_filter', state.photoFilter);
      formData.append('show_now', dom.showNowCheckbox.checked ? 'true' : 'false');

      // 4. Send POST /api/upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      setProgress(90);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json().catch(() => ({}));
      setProgress(100);
      dom.uploadProgressText.textContent = 'Upload complete! Artwork installed.';

      showToast(`Artwork pushed to The Frame (${result.content_id || 'OK'})!`, 'success');

      // Refresh gallery immediately to show new item
      setTimeout(async () => {
        await fetchTvStatus();
        dom.uploadProgressWrap.style.display = 'none';
        dom.pushToTvBtn.disabled = false;
      }, 1000);

    } catch (err) {
      console.error('Upload failed:', err);
      dom.uploadProgressWrap.style.display = 'none';
      dom.pushToTvBtn.disabled = false;
      showToast(`Upload failed: ${err.message}`, 'error', 5000);
    }
  }

  // ---- TV Status & Art Mode Controls -------------------------------------
  async function fetchTvStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.tvStatus = data;
      if (data.online === false) {
        throw new Error(data.error || 'TV unreachable');
      }
      state.tvConnected = true;

      // TV Badge update
      dom.tvStatusIndicator.className = 'status-indicator online';
      const ip = data.tv_ip || data.ip || 'LAN';
      const model = data.model || 'The Frame';
      const version = data.api_version || data.art_api_version || '5.0.1.0';
      dom.tvStatusText.textContent = `${ip} · ${model} · Art API ${version}`;

      // Art Mode status (handle both "artmode" and "art_mode")
      const artMode = (data.artmode || data.art_mode || data.mode || '').toLowerCase();
      const isArtModeOn = artMode === 'on';
      setArtModeUI(isArtModeOn ? 'on' : 'off');

      // Slideshow status
      if (data.slideshow && typeof data.slideshow === 'object') {
        const rawDur = data.slideshow.value ?? data.slideshow.duration ?? data.slideshow.interval;
        let selectVal = 'off';
        if (rawDur === 0 || rawDur === '0' || rawDur === 'off' || rawDur === '') selectVal = 'off';
        else if (rawDur === 5 || rawDur === '5' || rawDur === '5m') selectVal = '5m';
        else if (rawDur === 15 || rawDur === '15' || rawDur === '15m') selectVal = '15m';
        else if (rawDur === 30 || rawDur === '30' || rawDur === '30m') selectVal = '30m';
        else if (rawDur === 60 || rawDur === '60' || rawDur === '1h') selectVal = '1h';
        else if (rawDur === 1440 || rawDur === '1440' || rawDur === '1d') selectVal = '1d';

        if (dom.slideshowSelect.querySelector(`option[value="${selectVal}"]`)) {
          dom.slideshowSelect.value = selectVal;
        }

        const rawShuffle = data.slideshow.shuffle ?? data.slideshow.type;
        const shuffle = rawShuffle === true || rawShuffle === 'on' || rawShuffle === 'true' || rawShuffle === 'shuffleslideshow';
        setShuffleUI(shuffle);
      }

      // Current Artwork content_id
      const currentArt = data.current_artwork;
      state.currentArtId = (currentArt && (currentArt.content_id || currentArt.id)) ||
        (typeof currentArt === 'string' ? currentArt : null) ||
        data.current_art_id || null;

      // Gallery Photos
      state.myPhotos = data.my_photos || data.photos || data.items || [];
      renderTvPicker(data.discovered_tvs || [], ip);
      renderGallery();

    } catch (err) {
      console.warn('TV status fetch failed:', err);
      dom.tvStatusIndicator.className = 'status-indicator offline';
      const ip = (state.tvStatus && state.tvStatus.tv_ip) || 'The Frame';
      dom.tvStatusText.textContent = `${ip} · Offline / Unreachable`;
      setArtModeUI('unknown');
      dom.galleryGrid.setAttribute('aria-busy', 'false');
    }
  }

  function renderTvPicker(tvs, selectedIp) {
    if (!dom.tvPickerSelect) return;
    if (!Array.isArray(tvs) || tvs.length <= 1) {
      dom.tvPickerSelect.style.display = 'none';
      return;
    }
    dom.tvPickerSelect.innerHTML = '';
    tvs.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.ip;
      opt.textContent = `${item.ip} (${item.model || item.name || 'The Frame'})`;
      if (item.ip === selectedIp) opt.selected = true;
      dom.tvPickerSelect.appendChild(opt);
    });
    dom.tvPickerSelect.style.display = 'inline-block';
  }

  async function handleDiscoverTvs() {
    if (dom.discoverTvBtn) dom.discoverTvBtn.disabled = true;
    dom.tvStatusText.textContent = 'Scanning LAN for Frame TVs…';
    showToast('Scanning local network for Samsung The Frame TVs…', 'info', 2500);
    try {
      const res = await fetch('/api/discover', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const found = data.tvs || [];
      renderTvPicker(found, data.selected_ip);
      if (found.length > 0) {
        showToast(
          `Found ${found.length} Frame TV${found.length === 1 ? '' : 's'} on LAN (${found.map((t) => t.ip).join(', ')})`,
          'success'
        );
        await fetchTvStatus();
      } else {
        showToast('No powered-on Samsung The Frame TVs responded on LAN.', 'error', 4000);
        await fetchTvStatus();
      }
    } catch (err) {
      showToast(`LAN scan failed: ${err.message}`, 'error');
    } finally {
      if (dom.discoverTvBtn) dom.discoverTvBtn.disabled = false;
    }
  }

  async function handleSelectTv(ip) {
    if (!ip) return;
    showToast(`Switching to Frame TV at ${ip}…`, 'info', 2000);
    try {
      const res = await fetch('/api/tv/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTvStatus();
      showToast(`Connected to ${ip}`, 'success');
    } catch (err) {
      showToast(`Failed to switch TV: ${err.message}`, 'error');
    }
  }

  async function toggleArtMode() {
    const currentState = dom.artModeBtn.dataset.state;
    const targetState = currentState === 'on' ? 'off' : 'on';

    dom.artModeBtn.disabled = true;
    try {
      const res = await fetch('/api/artmode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetState, art_mode: targetState, mode: targetState })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setArtModeUI(targetState);
      showToast(`Art Mode set to ${targetState.toUpperCase()}`, 'success');
    } catch (err) {
      showToast(`Failed to toggle Art Mode: ${err.message}`, 'error');
    } finally {
      dom.artModeBtn.disabled = false;
    }
  }

  async function updateSlideshow() {
    const durationKey = dom.slideshowSelect.value;
    const durationMap = {
      'off': 0,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '1d': 1440
    };
    const durationMinutes = durationMap[durationKey] !== undefined ? durationMap[durationKey] : 15;
    const shuffle = dom.slideshowShuffleBtn.dataset.shuffle === 'true';

    try {
      const res = await fetch('/api/slideshow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: durationMinutes,
          shuffle: shuffle,
          category_id: 'MY-C0002'
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Slideshow updated (${durationKey}, Shuffle: ${shuffle ? 'ON' : 'Off'})`, 'success');
    } catch (err) {
      showToast(`Failed to update slideshow: ${err.message}`, 'error');
    }
  }

  // ---- Gallery ("My Collection" MY-C0002) ----------------------------------
  function renderGallery() {
    const photos = state.myPhotos;
    dom.galleryCountText.textContent = `${photos.length} item${photos.length === 1 ? '' : 's'}`;
    dom.galleryGrid.setAttribute('aria-busy', 'false');

    if (!photos || photos.length === 0) {
      dom.galleryGrid.innerHTML = `
        <div class="gallery-empty-state">
          <div class="empty-icon" aria-hidden="true">🖼</div>
          <div class="empty-title">No Personal Artwork Found</div>
          <div class="empty-desc">Your TV's "My Collection" (MY-C0002) is currently empty. Use the Studio on the left to push your first artwork!</div>
        </div>
      `;
      return;
    }

    dom.galleryGrid.innerHTML = '';
    photos.forEach((photo) => {
      const id = photo.content_id || photo.id || 'UNKNOWN';
      const matteId = photo.matte_id || 'none';
      const contentType = photo.content_type || 'mobile';
      const isActive = state.currentArtId && state.currentArtId === id;

      const card = document.createElement('div');
      card.className = `art-card ${isActive ? 'is-active' : ''}`;
      card.dataset.contentId = id;

      card.innerHTML = `
        <div class="art-card-thumb-wrap">
          <img class="art-card-thumb" src="/api/thumbnail/${encodeURIComponent(id)}" alt="Artwork ${escapeHtml(id)}${isActive ? ' (showing on TV)' : ''}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'320\\' height=\\'180\\' fill=\\'%23222\\'><rect width=\\'100%\\' height=\\'100%\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%23666\\' font-family=\\'monospace\\' font-size=\\'14\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'>Thumbnail</text></svg>'">
          ${isActive ? '<span class="badge-active">ACTIVE ON TV</span>' : ''}
          <span class="badge-type">${escapeHtml(contentType)}</span>
        </div>
        <div class="art-card-body">
          <div class="art-card-meta">
            <div class="meta-row">
              <span class="label">ID:</span>
              <span class="val mono">${escapeHtml(id)}</span>
            </div>
            <div class="meta-row">
              <span class="label">Matte:</span>
              <span class="val mono">${escapeHtml(matteId)}</span>
            </div>
          </div>
          <div class="art-card-actions">
            <button type="button" class="btn btn-card-action btn-select" data-id="${escapeHtml(id)}" title="Display on The Frame immediately" aria-label="Display ${escapeHtml(id)} now">
              Display Now
            </button>
            <button type="button" class="btn btn-card-action btn-apply-matte" data-id="${escapeHtml(id)}" title="Apply matte selected in Studio above" aria-label="Apply selected matte to ${escapeHtml(id)}">
              Apply Matte
            </button>
            <button type="button" class="btn btn-card-action btn-del" data-id="${escapeHtml(id)}" title="Delete artwork from TV" aria-label="Delete ${escapeHtml(id)} from TV">
              Delete
            </button>
          </div>
        </div>
      `;

      dom.galleryGrid.appendChild(card);
    });

    // Attach card event listeners
    dom.galleryGrid.querySelectorAll('.btn-select').forEach((btn) => {
      btn.addEventListener('click', () => handleSelectArtwork(btn.dataset.id));
    });

    dom.galleryGrid.querySelectorAll('.btn-apply-matte').forEach((btn) => {
      btn.addEventListener('click', () => handleApplyMatte(btn.dataset.id));
    });

    dom.galleryGrid.querySelectorAll('.btn-del').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });
  }

  async function handleSelectArtwork(contentId) {
    try {
      showToast(`Selecting ${contentId} on TV...`, 'info', 2000);
      const res = await fetch('/api/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: contentId, show: true })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.currentArtId = contentId;
      renderGallery();
      showToast(`Now displaying ${contentId} on The Frame!`, 'success');
    } catch (err) {
      showToast(`Failed to display artwork: ${err.message}`, 'error');
    }
  }

  async function handleApplyMatte(contentId) {
    const matteId = getComputedMatteId();
    try {
      showToast(`Applying matte "${matteId}" to ${contentId}...`, 'info', 2500);
      const res = await fetch('/api/matte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: contentId,
          matte_id: matteId,
          photo_filter: state.photoFilter
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Updated matte on ${contentId} to "${matteId}"!`, 'success');
      await fetchTvStatus();
    } catch (err) {
      showToast(`Failed to update matte: ${err.message}`, 'error');
    }
  }

  function openDeleteModal(contentId) {
    state.deletingContentId = contentId;
    state.modalReturnFocus = document.activeElement;
    dom.deleteContentIdText.textContent = contentId;
    dom.deleteModal.style.display = 'flex';
    // Start on the safe choice
    dom.cancelDeleteBtn.focus();
  }

  function closeDeleteModal() {
    state.deletingContentId = null;
    dom.deleteModal.style.display = 'none';
    // Return focus to the card's Delete button, or the gallery if that card is gone
    const back = state.modalReturnFocus;
    state.modalReturnFocus = null;
    if (back && document.contains(back)) back.focus();
    else dom.refreshGalleryBtn.focus();
  }

  function handleModalKeydown(e) {
    if (dom.deleteModal.style.display === 'none') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDeleteModal();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the dialog
    const focusables = [...dom.deleteModal.querySelectorAll('button:not(:disabled)')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function handleConfirmDelete() {
    const id = state.deletingContentId;
    if (!id) return;

    dom.confirmDeleteBtn.disabled = true;
    try {
      const res = await fetch(`/api/art/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Deleted ${id} from TV storage`, 'success');
      // The card (and its Delete button) is about to be re-rendered away
      state.modalReturnFocus = dom.refreshGalleryBtn;
      closeDeleteModal();
      await fetchTvStatus();
    } catch (err) {
      showToast(`Failed to delete artwork: ${err.message}`, 'error');
    } finally {
      dom.confirmDeleteBtn.disabled = false;
    }
  }

  // ---- Init & Event Binding ----------------------------------------------
  function init() {
    initTheme();
    initMatteControls();
    initCropper();

    // Masthead control listeners
    dom.artModeBtn.addEventListener('click', toggleArtMode);
    dom.slideshowSelect.addEventListener('change', updateSlideshow);
    dom.slideshowShuffleBtn.addEventListener('click', () => {
      const current = dom.slideshowShuffleBtn.dataset.shuffle === 'true';
      setShuffleUI(!current);
      updateSlideshow();
    });

    if (dom.discoverTvBtn) {
      dom.discoverTvBtn.addEventListener('click', handleDiscoverTvs);
    }
    if (dom.tvPickerSelect) {
      dom.tvPickerSelect.addEventListener('change', (e) => handleSelectTv(e.target.value));
    }

    dom.refreshStatusBtn.addEventListener('click', async () => {
      showToast('Syncing with The Frame...', 'info', 1500);
      await fetchTvStatus();
    });

    dom.refreshGalleryBtn.addEventListener('click', async () => {
      showToast('Refreshing gallery...', 'info', 1500);
      await fetchTvStatus();
    });

    // Delete modal listeners
    dom.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    dom.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    dom.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    dom.deleteModal.addEventListener('click', (e) => {
      if (e.target === dom.deleteModal) closeDeleteModal();
    });
    document.addEventListener('keydown', handleModalKeydown);

    // Initial TV status fetch (no aggressive background polling so TV WebSocket isn't churned)
    fetchTvStatus();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
