(() => {
  'use strict';
  document.documentElement.classList.add('has-js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const states = new Map();
  function show(button, playing) {
    const state = states.get(button), image = button.closest('.gif-card').querySelector('img');
    if (state.playing !== playing) image.src = playing ? button.dataset.gif : image.dataset.poster;
    state.playing = playing;
    button.setAttribute('aria-pressed', String(playing));
    button.textContent = playing ? 'Stop GIF □' : 'Play GIF ▷';
    const title = button.closest('.gif-card').querySelector('h3')?.textContent || image.alt;
    button.setAttribute('aria-label', (playing ? 'Stop GIF: ' : 'Play GIF: ') + title);
  }
  function sync(button) {
    const state = states.get(button);
    show(button, state.visible && !state.pausedByUser && !reduced.matches && !document.hidden);
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const button = entry.target.querySelector('.gif-toggle'), state = states.get(button);
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .2;
      if (!state.visible) state.pausedByUser = false;
      sync(button);
    }
  }, { threshold: [0, .2], rootMargin: '-78px 0px -20px 0px' }) : null;
  document.querySelectorAll('.gif-toggle').forEach(button => {
    states.set(button, { visible: false, pausedByUser: false, playing: false });
    button.addEventListener('click', () => {
      const state = states.get(button);
      state.pausedByUser = state.playing;
      show(button, !state.playing);
    });
    observer?.observe(button.closest('.gif-card'));
  });
  reduced.addEventListener('change', () => states.forEach((_, button) => sync(button)));
  document.addEventListener('visibilitychange', () => states.forEach((_, button) => sync(button)));
})();
