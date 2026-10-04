// Budget landing page. Plain JavaScript, no libraries, no network requests.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // Split a heading into word spans so each word can animate on its own.
  function splitWords(el) {
    const walk = (node, out) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { out.appendChild(document.createTextNode(part)); return; }
            const span = document.createElement('span');
            span.className = 'w';
            span.textContent = part;
            out.appendChild(span);
          });
        } else {
          const clone = child.cloneNode(false);
          walk(child, clone);
          // A wrapped element (like <em>) moves as one word.
          if (clone.querySelectorAll('.w').length && !clone.classList.contains('w')) {
            const wrap = document.createElement('span');
            wrap.className = 'w';
            wrap.appendChild(clone);
            clone.querySelectorAll('.w').forEach((w) => w.replaceWith(...w.childNodes));
            out.appendChild(wrap);
          } else {
            out.appendChild(clone);
          }
        }
      });
      return out;
    };
    const frag = walk(el, document.createDocumentFragment());
    el.textContent = '';
    el.appendChild(frag);
    el.querySelectorAll('.w').forEach((w, i) => w.style.setProperty('--i', i));
    return el.querySelectorAll('.w');
  }

  document.querySelectorAll('[data-split]').forEach(splitWords);

  // Nav turns solid once the hero scrolls away.
  const nav = document.querySelector('[data-nav]');
  const onScrollNav = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  // Reveal on view. Content is visible by default; this only adds polish.
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }
  // Safety net: if anything is still waiting after a while (hidden tab, odd browser), show it.
  window.addEventListener('load', () => setTimeout(() => {
    reveals.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add('is-in');
    });
  }, 1800));

  // Privacy statement: words brighten as the sentence scrolls through view.
  const statement = document.querySelector('[data-words]');
  if (statement) {
    const words = splitWords(statement);
    if (!reduce) {
      let ticking = false;
      const paint = () => {
        ticking = false;
        const r = statement.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 when the top enters at 85% of the screen, 1 when the bottom reaches 45%.
        const start = vh * 0.85, end = vh * 0.45;
        const p = Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height)));
        const lit = p * words.length;
        words.forEach((w, i) => {
          const o = Math.min(1, Math.max(0.16, lit - i + 0.16));
          w.style.setProperty('--o', o.toFixed(3));
        });
      };
      paint();
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
      window.addEventListener('resize', paint);
    }
  }

  // Hero: gentle 3D tilt that follows the pointer, with floating chips at different depths.
  const stage = document.querySelector('[data-tilt]');
  if (stage && !reduce && finePointer) {
    const layers = [...stage.querySelectorAll('[data-depth]')];
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const hero = stage.closest('.hero');
    const loop = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      layers.forEach((el) => {
        const d = parseFloat(el.dataset.depth);
        if (el.classList.contains('hero__phone')) {
          el.style.transform = `rotateY(${cx * 7}deg) rotateX(${-cy * 5}deg)`;
        } else {
          el.style.translate = `${cx * d * 10}px ${cy * d * 8}px`;
        }
      });
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
  }

  // Feature story: the phone on the right follows the step you are reading.
  const story = document.querySelector('[data-story]');
  if (story) {
    const steps = [...story.querySelectorAll('.step')];
    const shots = [...story.querySelectorAll('[data-shot]')];
    const dots = [...story.querySelectorAll('.story__dots i')];
    const panel = story.querySelector('[data-panel]');
    let current = -1;

    steps.forEach((s) => s.style.setProperty('--tint', `var(--t-${s.dataset.tint})`));

    const activate = (i) => {
      if (i === current) return;
      current = i;
      const step = steps[i];
      steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
      shots.forEach((img) => img.classList.toggle('is-active', img.dataset.shot === step.dataset.screen));
      dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
      panel.style.setProperty('--panel', `var(--t-${step.dataset.tint})`);
    };
    activate(0);

    if ('IntersectionObserver' in window) {
      const so = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activate(steps.indexOf(e.target)); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach((s) => so.observe(s));
    }
  }

  // Ring percentage counts up with the ring.
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = +el.dataset.count;
    const tile = el.closest('[data-reveal]');
    const run = () => {
      if (reduce) { el.textContent = `${target}%`; return; }
      const t0 = performance.now(), dur = 2000;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 4);
        el.textContent = `${Math.round(target * eased)}%`;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (tile && 'MutationObserver' in window) {
      if (tile.classList.contains('is-in')) run();
      else new MutationObserver((_, mo) => { if (tile.classList.contains('is-in')) { mo.disconnect(); run(); } }).observe(tile, { attributes: true, attributeFilter: ['class'] });
    } else run();
  });

  // Light and dark demo card flips every few seconds.
  const themeDemo = document.querySelector('.theme-demo');
  if (themeDemo && !reduce) setInterval(() => themeDemo.classList.toggle('is-dark'), 2600);

  // Currency symbol gently cycles.
  const cycle = document.querySelector('[data-cycle]');
  if (cycle && !reduce) {
    const symbols = cycle.dataset.cycle.split(' ');
    let i = 0;
    setInterval(() => {
      cycle.classList.add('is-out');
      setTimeout(() => {
        i = (i + 1) % symbols.length;
        cycle.textContent = symbols[i];
        cycle.classList.remove('is-out');
      }, 350);
    }, 1800);
  }

  // Hero phone video: silent loop. Pauses off screen, has a pause button,
  // and never starts on its own for people who prefer reduced motion.
  const heroVideo = document.querySelector('.hero__video');
  const heroToggle = document.querySelector('[data-hero-toggle]');
  if (heroVideo && heroToggle) {
    let userPaused = reduce;
    const sync = () => {
      heroToggle.classList.toggle('is-paused', heroVideo.paused);
      heroToggle.setAttribute('aria-label', heroVideo.paused ? 'Play the video' : 'Pause the video');
    };
    if (reduce) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
    heroToggle.addEventListener('click', () => {
      if (heroVideo.paused) { userPaused = false; heroVideo.play().catch(() => {}); }
      else { userPaused = true; heroVideo.pause(); }
    });
    heroVideo.addEventListener('play', sync);
    heroVideo.addEventListener('pause', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) heroVideo.pause();
        else if (!userPaused) heroVideo.play().catch(() => {});
      }, { threshold: 0.2 }).observe(heroVideo);
    }
    sync();
  }

  // Video: a calm play button over the poster. Nothing downloads until it is pressed.
  // Without JavaScript the browser's own controls still work.
  const film = document.querySelector('[data-film]');
  if (film) {
    const video = film.querySelector('video');
    const play = film.querySelector('.film__play');
    video.controls = false;
    play.hidden = false;
    play.addEventListener('click', () => {
      play.hidden = true;
      video.controls = true;
      video.play().catch(() => { play.hidden = false; video.controls = false; });
    });
    video.addEventListener('ended', () => {
      video.controls = false;
      video.load(); // back to the poster
      play.hidden = false;
    });
  }

  // Marquee: duplicate the row so the loop is seamless.
  document.querySelectorAll('[data-marquee]').forEach((m) => {
    const row = m.querySelector('.marquee__row');
    const copy = row.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    m.appendChild(copy);
  });
})();
