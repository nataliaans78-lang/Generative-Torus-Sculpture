import './landing.css';

export function createLanding({
  title = 'Generative Torus Sculpture',
  cta = 'Enter Experience',
  onEnter,
} = {}) {
  document.body.classList.add('landing-active');
  const overlay = document.createElement('section');
  overlay.className = 'landing';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'landing-title');
  const card = document.createElement('div');
  card.className = 'landing__card';
  const glow = document.createElement('div');
  glow.className = 'landing__glow';
  const badge = document.createElement('p');
  badge.className = 'landing__badge';
  badge.textContent = 'Immersive Three.js Scene';
  const heading = document.createElement('h1');
  heading.className = 'landing__title';
  heading.id = 'landing-title';
  heading.textContent = title;
  const list = document.createElement('ul');
  list.className = 'landing__features';
  [
    'Flow lighting with gobo dots',
    'Audio-reactive pulse engine',
    'Preset-based scene control',
  ].forEach((label) => {
    const item = document.createElement('li');
    item.className = 'landing__feature';
    item.textContent = label;
    list.appendChild(item);
  });
  const footer = document.createElement('p');
  footer.className = 'landing__hint';
  footer.textContent = 'Tip: Press Enter to start';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'landing__cta';
  button.textContent = cta;
  card.append(glow, badge, heading, list, button, footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  let entered = false;

  const handleKeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      enter();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      enter();
    }
  };

  const enter = () => {
    if (entered) return;
    entered = true;
    window.removeEventListener('keydown', handleKeydown);
    button.disabled = true;
    document.body.classList.remove('landing-active');
    overlay.classList.add('landing--leaving');
    setTimeout(() => {
      overlay.remove();
      onEnter?.();
    }, 360);
  };
  button.addEventListener('click', enter);
  window.addEventListener('keydown', handleKeydown);
  button.focus();
  return {
    enter,
    dispose() {
      window.removeEventListener('keydown', handleKeydown);
      overlay.remove();
      document.body.classList.remove('landing-active');
    },
  };
}
