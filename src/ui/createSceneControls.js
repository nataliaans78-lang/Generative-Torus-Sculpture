import { QUALITY_LEVELS } from '../config/quality.js';

const PLAY_ICON = '\u25b6';
const PAUSE_ICON = '\u275a\u275a';
const CHEVRON_ICON = '\u25be';
const PANEL_COLLAPSE_ICON = '\u25b4';
const PANEL_EXPAND_ICON = '\u25be';

function createSlider({ label, min, max, step, value, onInput }) {
  const row = document.createElement('label');
  row.className = 'portfolio-controls__slider';
  const text = document.createElement('span');
  text.className = 'portfolio-controls__slider-label';
  text.textContent = `${label}: ${value}`;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.addEventListener('input', () => {
    const val = Number(input.value);
    text.textContent = `${label}: ${Number.isInteger(step) ? val : val.toFixed(2)}`;
    onInput(val);
  });
  row.append(text, input);
  return {
    row,
    setValue(val) {
      input.value = val;
      text.textContent = `${label}: ${Number.isInteger(step) ? val : val.toFixed(2)}`;
    },
  };
}

function createSection({ id, title }) {
  const wrapper = document.createElement('section');
  wrapper.className = 'portfolio-controls__section ui-section';
  wrapper.dataset.sectionId = id;
  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'ui-section__header';
  const titleNode = document.createElement('span');
  titleNode.className = 'ui-section__title';
  titleNode.textContent = title;
  const chevron = document.createElement('span');
  chevron.className = 'ui-section__chevron';
  chevron.textContent = CHEVRON_ICON;
  header.append(titleNode, chevron);
  const content = document.createElement('div');
  const contentId = `ui-section-content-${id}`;
  content.className = 'ui-section__content';
  content.id = contentId;
  const inner = document.createElement('div');
  inner.className = 'ui-section__content-inner';
  content.append(inner);
  header.setAttribute('aria-expanded', 'true');
  header.setAttribute('aria-controls', contentId);
  content.setAttribute('aria-hidden', 'false');
  wrapper.append(header, content);
  return { wrapper, header, content, inner, collapsed: false };
}

export function createSceneControls({
  initialPreset = 'DEEP_BLUE',
  presetOptions = [],
  initialLighting = {},
  initialScene = {},
  initialQuality = QUALITY_LEVELS.HIGH,
  onPresetChange,
  onLightingChange,
  onSceneChange,
  onQualityChange,
  onPlayToggle,
  onUploadAudio,
  onResetAll,
} = {}) {
  const container = document.createElement('div');
  container.className = 'portfolio-controls';
  const panelToggle = document.createElement('button');
  panelToggle.type = 'button';
  panelToggle.className = 'portfolio-controls__panel-toggle';
  panelToggle.textContent = PANEL_COLLAPSE_ICON;
  panelToggle.setAttribute('aria-label', 'Hide controls panel');
  panelToggle.setAttribute('aria-expanded', 'true');
  const drawer = document.createElement('div');
  drawer.className = 'portfolio-controls__drawer';

  const sectionPreset = createSection({ id: 'preset', title: 'PRESET' });
  const sectionLighting = createSection({ id: 'lighting', title: 'LIGHTING' });
  const sectionAudio = createSection({ id: 'audio', title: 'AUDIO' });
  const sectionScene = createSection({ id: 'scene', title: 'SCENE' });
  const sectionQuality = createSection({ id: 'quality', title: 'QUALITY' });

  const sections = [sectionPreset, sectionLighting, sectionAudio, sectionScene, sectionQuality];
  sections.forEach((section) => drawer.appendChild(section.wrapper));

  const presetSelect = document.createElement('select');
  presetSelect.className = 'portfolio-controls__select';
  presetOptions.forEach(({ key, label }) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    if (key === initialPreset) {
      option.selected = true;
    }
    presetSelect.appendChild(option);
  });

  const resetAllButton = document.createElement('button');
  resetAllButton.type = 'button';
  resetAllButton.className = 'portfolio-controls__button portfolio-controls__button--reset';
  resetAllButton.textContent = 'Reset All';

  sectionPreset.inner.append(presetSelect);

  const playButton = document.createElement('button');
  playButton.className = 'portfolio-controls__button portfolio-controls__button--play';
  playButton.textContent = PLAY_ICON;

  const uploadButton = document.createElement('button');
  uploadButton.className = 'portfolio-controls__button portfolio-controls__button--upload';
  uploadButton.type = 'button';
  uploadButton.textContent = 'Upload Audio';

  const mediaRow = document.createElement('div');
  mediaRow.className = 'portfolio-controls__actions';
  mediaRow.append(playButton, uploadButton);
  sectionAudio.inner.append(mediaRow);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.style.display = 'none';

  const keySlider = createSlider({
    label: 'Key Intensity',
    min: 0,
    max: 8,
    step: 0.1,
    value: initialLighting.keyIntensity ?? 3.5,
    onInput: (value) => onLightingChange?.({ keyIntensity: value }),
  });
  const rimSlider = createSlider({
    label: 'Rim Intensity',
    min: 0,
    max: 6,
    step: 0.1,
    value: initialLighting.rimIntensity ?? 2.2,
    onInput: (value) => onLightingChange?.({ rimIntensity: value }),
  });
  const spotSlider = createSlider({
    label: 'Spot Intensity',
    min: 0,
    max: 8,
    step: 0.1,
    value: initialLighting.spotIntensity ?? 0,
    onInput: (value) => onLightingChange?.({ spotIntensity: value }),
  });
  const focusSlider = createSlider({
    label: 'Spot Focus',
    min: 0.75,
    max: 1.3,
    step: 0.01,
    value: initialLighting.spotFocus ?? 1.1,
    onInput: (value) => onLightingChange?.({ spotFocus: value }),
  });
  const speedSlider = createSlider({
    label: 'Light Speed',
    min: 0.3,
    max: 2.6,
    step: 0.01,
    value: initialLighting.lightMotionSpeed ?? 0.6,
    onInput: (value) => onLightingChange?.({ lightMotionSpeed: value }),
  });
  sectionLighting.inner.append(
    keySlider.row,
    rimSlider.row,
    spotSlider.row,
    focusSlider.row,
    speedSlider.row,
  );

  const spacingSlider = createSlider({
    label: 'Grid Count',
    min: 2,
    max: 5,
    step: 1,
    value: initialScene.gridCount ?? 3,
    onInput: (value) => onSceneChange?.({ gridCount: value }),
  });
  const gridSpacingSlider = createSlider({
    label: 'Grid Spacing',
    min: 1.4,
    max: 2.0,
    step: 0.01,
    value: initialScene.gridSpacing ?? 1.75,
    onInput: (value) => onSceneChange?.({ gridSpacing: value }),
  });
  const rotationSlider = createSlider({
    label: 'Grid Rotation Speed',
    min: 0.02,
    max: 0.12,
    step: 0.001,
    value: initialScene.globalRotationSpeed ?? 0.055,
    onInput: (value) => onSceneChange?.({ globalRotationSpeed: value }),
  });
  sectionScene.inner.append(spacingSlider.row, gridSpacingSlider.row, rotationSlider.row);

  const qualityOptions = [QUALITY_LEVELS.HIGH, QUALITY_LEVELS.MEDIUM, QUALITY_LEVELS.LOW];
  const qualityToggle = document.createElement('button');
  qualityToggle.type = 'button';
  qualityToggle.className = 'qualityToggle';
  qualityToggle.textContent = initialQuality;
  qualityToggle.setAttribute('aria-haspopup', 'true');
  qualityToggle.setAttribute('aria-expanded', 'false');
  qualityToggle.setAttribute('aria-label', 'Select quality');

  const qualityPicker = document.createElement('div');
  qualityPicker.className = 'qualityPicker';
  qualityPicker.appendChild(qualityToggle);

  const qualityMenu = document.createElement('div');
  qualityMenu.className = 'qualityMenu';
  qualityMenu.setAttribute('aria-hidden', 'true');
  qualityMenu.setAttribute('role', 'menu');
  qualityPicker.appendChild(qualityMenu);

  const qualityButtons = new Map();
  let qualityMenuOpen = false;
  let panelCollapsed = false;
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const detachGlobalQualityHandlers = () => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('keydown', onDocumentKeyDown, true);
  };
  const onDocumentPointerDown = (event) => {
    if (!isMobile()) return;
    const target = event.target;
    if (target instanceof Node && qualityPicker.contains(target)) return;
    setQualityMenuOpen(false);
  };
  const onDocumentKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    setQualityMenuOpen(false);
  };
  const attachGlobalQualityHandlers = () => {
    detachGlobalQualityHandlers();
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown, true);
  };
  const setQualityMenuOpen = (open) => {
    if (!isMobile()) {
      qualityMenuOpen = true;
      qualityMenu.classList.add('is-open');
      qualityMenu.setAttribute('aria-hidden', 'false');
      qualityToggle.setAttribute('aria-expanded', 'false');
      detachGlobalQualityHandlers();
      return;
    }
    qualityMenuOpen = Boolean(open);
    qualityMenu.classList.toggle('is-open', qualityMenuOpen);
    qualityMenu.setAttribute('aria-hidden', qualityMenuOpen ? 'false' : 'true');
    qualityToggle.setAttribute('aria-expanded', qualityMenuOpen ? 'true' : 'false');
    if (qualityMenuOpen) {
      attachGlobalQualityHandlers();
    } else {
      detachGlobalQualityHandlers();
    }
  };
  setQualityMenuOpen(!isMobile());

  const setPanelCollapsed = (collapsed) => {
    panelCollapsed = collapsed;
    container.classList.toggle('portfolio-controls--collapsed', collapsed);
    const iconWhenCollapsed = isMobile() ? PANEL_COLLAPSE_ICON : PANEL_EXPAND_ICON;
    const iconWhenExpanded = isMobile() ? PANEL_EXPAND_ICON : PANEL_COLLAPSE_ICON;
    panelToggle.textContent = collapsed ? iconWhenCollapsed : iconWhenExpanded;
    panelToggle.setAttribute(
      'aria-label',
      collapsed ? 'Show controls panel' : 'Hide controls panel',
    );
    panelToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (collapsed) {
      setQualityMenuOpen(false);
    }
  };

  const setSectionCollapsed = (section, collapsed) => {
    section.collapsed = collapsed;
    section.wrapper.classList.toggle('ui-section--collapsed', collapsed);
    section.content.style.maxHeight = collapsed ? '0' : `${section.inner.scrollHeight}px`;
    section.content.style.opacity = collapsed ? '0' : '1';
    section.header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    section.content.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
  };

  qualityOptions.forEach((value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qualityOption';
    btn.textContent = value;
    btn.dataset.quality = value;
    btn.setAttribute('role', 'menuitem');
    qualityMenu.appendChild(btn);
    qualityButtons.set(value, btn);
    btn.addEventListener('click', () => {
      qualityButtons.forEach((other, key) => {
        other.classList.toggle('is-active', key === value);
      });
      onQualityChange?.(value);
      qualityToggle.textContent = value;
      if (isMobile()) {
        setQualityMenuOpen(false);
      }
    });
  });
  qualityToggle.addEventListener('click', () => {
    if (!isMobile()) return;
    if (panelCollapsed) return;
    setQualityMenuOpen(!qualityMenuOpen);
  });
  panelToggle.addEventListener('click', () => {
    setPanelCollapsed(!panelCollapsed);
  });
  sectionQuality.inner.append(qualityPicker);
  qualityButtons.forEach((btn, key) => btn.classList.toggle('is-active', key === initialQuality));

  const toggleSection = (section) => {
    const nextCollapsed = !section.collapsed;
    setSectionCollapsed(section, nextCollapsed);
    if (section === sectionQuality && nextCollapsed) {
      setQualityMenuOpen(false);
    }
  };

  sections.forEach((section) => {
    section.header.addEventListener('click', () => toggleSection(section));
  });

  const setLightingVisibility = (presetKey) => {
    const isDeep = presetKey === 'DEEP_BLUE';
    sectionLighting.wrapper.style.display = isDeep ? 'none' : 'block';
    if (isDeep) {
      setSectionCollapsed(sectionLighting, true);
      return;
    }
    setSectionCollapsed(sectionLighting, false);
  };

  presetSelect.addEventListener('change', () => {
    onPresetChange?.(presetSelect.value);
    setLightingVisibility(presetSelect.value);
    drawer.scrollTop = 0;
  });

  resetAllButton.addEventListener('click', () => onResetAll?.());
  playButton.addEventListener('click', async () => {
    const nextState = await onPlayToggle?.();
    if (nextState === true) {
      playButton.textContent = PAUSE_ICON;
      return;
    }
    if (nextState === false) {
      playButton.textContent = PLAY_ICON;
    }
  });
  uploadButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      onUploadAudio?.(file);
    }
    fileInput.value = '';
  });

  const resetRow = document.createElement('div');
  resetRow.className = 'portfolio-controls__reset-row';
  resetRow.append(resetAllButton);
  drawer.append(resetRow);

  const containerFragment = document.createDocumentFragment();
  containerFragment.append(panelToggle, drawer, fileInput);
  container.append(containerFragment);
  document.body.append(container);

  setLightingVisibility(initialPreset);
  const resetPanel = (presetKey = initialPreset) => {
    setPanelCollapsed(false);
    sections.forEach((section) => setSectionCollapsed(section, false));
    setLightingVisibility(presetKey);
    drawer.scrollTop = 0;
    setQualityMenuOpen(!isMobile());
  };
  window.addEventListener('resize', () => {
    setLightingVisibility(presetSelect.value);
    if (!isMobile()) {
      setQualityMenuOpen(true);
      return;
    }
    setQualityMenuOpen(false);
  });

  return {
    setPreset(key) {
      presetSelect.value = key;
      setLightingVisibility(key);
      drawer.scrollTop = 0;
    },
    setLightingValues(values) {
      if (typeof values.keyIntensity === 'number') keySlider.setValue(values.keyIntensity);
      if (typeof values.rimIntensity === 'number') rimSlider.setValue(values.rimIntensity);
      if (typeof values.spotIntensity === 'number') spotSlider.setValue(values.spotIntensity);
      if (typeof values.spotFocus === 'number') focusSlider.setValue(values.spotFocus);
      if (typeof values.lightMotionSpeed === 'number')
        speedSlider.setValue(values.lightMotionSpeed);
    },
    setSceneValues(values) {
      if (typeof values.gridCount === 'number') spacingSlider.setValue(values.gridCount);
      if (typeof values.gridSpacing === 'number') gridSpacingSlider.setValue(values.gridSpacing);
      if (typeof values.globalRotationSpeed === 'number')
        rotationSlider.setValue(values.globalRotationSpeed);
    },
    setQuality(value) {
      qualityButtons.forEach((btn, key) => btn.classList.toggle('is-active', key === value));
      qualityToggle.textContent = value;
    },
    setPlayState(isPlaying) {
      playButton.textContent = isPlaying ? PAUSE_ICON : PLAY_ICON;
    },
    resetPanel,
  };
}
