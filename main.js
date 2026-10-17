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

  document.querySelectorAll('[data-split], [data-rise]').forEach(splitWords);

  // Nav turns solid once the hero scrolls away.
  const nav = document.querySelector('[data-nav]');
  const onScrollNav = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  // Reveal on view. Content is visible by default; this only adds polish.
  const reveals = document.querySelectorAll('[data-reveal], [data-rise]');
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

  // Scroll-linked motion: the hero film straightens and lifts as you leave,
  // and the video frame below grows into place as it arrives.
  const hero = document.querySelector('[data-hero]');
  const filmFrame = document.querySelector('[data-film]');
  if (!reduce) {
    let ticking = false;
    const paint = () => {
      ticking = false;
      const vh = window.innerHeight;
      if (hero) {
        const h = hero.offsetHeight;
        const hp = Math.min(1, Math.max(0, window.scrollY / h));
        hero.style.setProperty('--hp', hp.toFixed(3));
      }
      if (filmFrame) {
        const r = filmFrame.getBoundingClientRect();
        const fp = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.65)));
        filmFrame.style.setProperty('--fp', fp.toFixed(3));
      }
    };
    paint();
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    window.addEventListener('resize', paint);
  }

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
          const o = Math.min(1, Math.max(0.2, lit - i + 0.2));
          w.style.setProperty('--o', o.toFixed(3));
        });
      };
      paint();
      window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
      window.addEventListener('resize', paint);
    }
  }

  // Hero: gentle 3D tilt of the film that follows the pointer.
  const stage = document.querySelector('[data-tilt]');
  if (stage && hero && !reduce && finePointer) {
    const film = stage.querySelector('[data-depth]');
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      film.style.transform = `rotateY(${cx * 8}deg) rotateX(${-cy * 6}deg)`;
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    // Wait for the entrance animation to finish so the two never fight.
    film.addEventListener('animationend', () => {
      film.style.animation = 'none';
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    }, { once: true });
  }

  // Feature story: the phone on the right follows the step you are reading.
  // Screens you have passed glide up and away; the next one rises in.
  const story = document.querySelector('[data-story]');
  if (story) {
    const steps = [...story.querySelectorAll('.step')];
    const shots = [...story.querySelectorAll('[data-shot]')];
    const dots = [...story.querySelectorAll('.story__dots i')];
    const panel = story.querySelector('[data-panel]');
    const order = steps.map((s) => s.dataset.screen);
    let current = -1;

    steps.forEach((s) => s.style.setProperty('--tint', `var(--t-${s.dataset.tint})`));

    const activate = (i) => {
      if (i === current) return;
      current = i;
      const step = steps[i];
      steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
      shots.forEach((img) => {
        const k = order.indexOf(img.dataset.shot);
        img.classList.toggle('is-active', k === i);
        img.classList.toggle('is-past', k < i);
      });
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

  // Hero film: a silent loop. Pauses off screen, has a pause button, and never
  // starts on its own for people who prefer reduced motion. "Play with sound"
  // starts it from the beginning with music, then it returns to a silent loop.
  const heroVideo = document.querySelector('.hero__video');
  const heroToggle = document.querySelector('[data-hero-toggle]');
  const heroSound = document.querySelector('[data-hero-sound]');
  if (heroVideo && heroToggle) {
    let userPaused = reduce;
    const label = heroSound && heroSound.querySelector('[data-sound-label]');
    const syncPause = () => {
      heroToggle.classList.toggle('is-paused', heroVideo.paused);
      heroToggle.setAttribute('aria-label', heroVideo.paused ? 'Play the film' : 'Pause the film');
    };
    const syncSound = () => {
      if (!heroSound) return;
      const on = !heroVideo.muted;
      heroSound.classList.toggle('is-on', on);
      heroSound.setAttribute('aria-pressed', String(on));
      label.textContent = on ? 'Mute' : 'Play with sound';
    };
    if (reduce) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
    heroToggle.addEventListener('click', () => {
      if (heroVideo.paused) { userPaused = false; heroVideo.play().catch(() => {}); }
      else { userPaused = true; heroVideo.pause(); }
    });
    if (heroSound) {
      heroSound.addEventListener('click', () => {
        if (heroVideo.muted) {
          const other = document.querySelector('.film__video');
          if (other && !other.paused) other.pause();
          heroVideo.muted = false;
          heroVideo.loop = false;
          heroVideo.currentTime = 0;
          userPaused = false;
          heroVideo.play().catch(() => {});
        } else {
          heroVideo.muted = true;
          heroVideo.loop = true;
        }
        syncSound();
      });
    }
    heroVideo.addEventListener('ended', () => {
      // After one full play with sound, settle back into the quiet loop.
      heroVideo.muted = true;
      heroVideo.loop = true;
      syncSound();
      if (!reduce) heroVideo.play().catch(() => {});
    });
    heroVideo.addEventListener('volumechange', syncSound);
    heroVideo.addEventListener('play', syncPause);
    heroVideo.addEventListener('pause', syncPause);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) heroVideo.pause();
        else if (!userPaused) heroVideo.play().catch(() => {});
      }, { threshold: 0.2 }).observe(heroVideo);
    }
    syncPause();
    syncSound();
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
      // Only one video plays with sound at a time.
      if (heroVideo && !heroVideo.muted) { heroVideo.muted = true; heroVideo.loop = true; }
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
