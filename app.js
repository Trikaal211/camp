document.addEventListener('DOMContentLoaded', () => {
    const gsap = window.gsap || {
        to: (_target, vars = {}) => {
            if (typeof vars.onComplete === 'function') {
                setTimeout(vars.onComplete, Math.max(0, (vars.duration || 0) * 1000));
            }
            return { kill() {} };
        },
        from: () => ({ kill() {} }),
        fromTo: () => ({ kill() {} }),
        registerPlugin: () => {},
        ticker: {
            add: () => {},
            lagSmoothing: () => {}
        }
    };

    const ScrollTrigger = window.ScrollTrigger || {
        update: () => {},
        create: (opts = {}) => {
            if (typeof opts.onEnter === 'function') {
                requestAnimationFrame(opts.onEnter);
            }
            return { kill() {} };
        }
    };

    // ----------------------------------------------------
    // 1. PROCEDURAL & ATMOSPHERIC SOUNDSCAPE SYNTHESIZER
    // ----------------------------------------------------
    let audioCtx = null;
    let masterGain = null;
    let isMuted = true;
    let audioInitialized = false;
    
    let synthGains = {
        sunbeam: null,
        rain: null,
        snow: null,
        silence: null
    };

    const fallbacks = {
        sunbeam: document.getElementById('ambient-birds'),
        rain: document.getElementById('ambient-rain'),
        snow: document.getElementById('ambient-snow'),
        silence: document.getElementById('ambient-silence')
    };

    let currentMood = 'sunbeam';

    // Weather label name map
    const weatherLabels = {
        sunbeam: 'DHOOP',
        rain: 'VARISH',
        snow: 'BARF',
        silence: 'SANATAA'
    };

    function initSensorySynth() {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
            masterGain.connect(audioCtx.destination);

            const bufferSize = 4 * audioCtx.sampleRate;
            
            const whiteBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const whiteData = whiteBuffer.getChannelData(0);
            
            const brownBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const brownData = brownBuffer.getChannelData(0);
            
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                whiteData[i] = white;
                brownData[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = brownData[i];
                brownData[i] *= 3.5;
            }

            Object.keys(synthGains).forEach(mood => {
                synthGains[mood] = audioCtx.createGain();
                synthGains[mood].gain.setValueAtTime(0, audioCtx.currentTime);
                synthGains[mood].connect(masterGain);
            });

            // 1. DHOOP (SUNBEAM) route
            const sunbeamWind = audioCtx.createBufferSource();
            sunbeamWind.buffer = brownBuffer;
            sunbeamWind.loop = true;
            
            const sunbeamFilter = audioCtx.createBiquadFilter();
            sunbeamFilter.type = 'lowpass';
            sunbeamFilter.frequency.setValueAtTime(400, audioCtx.currentTime);
            
            sunbeamWind.connect(sunbeamFilter);
            sunbeamFilter.connect(synthGains.sunbeam);
            sunbeamWind.start();

            // 2. VARISH (RAIN) route
            const rainSrc = audioCtx.createBufferSource();
            rainSrc.buffer = whiteBuffer;
            rainSrc.loop = true;

            const rainFilter = audioCtx.createBiquadFilter();
            rainFilter.type = 'bandpass';
            rainFilter.frequency.setValueAtTime(500, audioCtx.currentTime);
            rainFilter.Q.setValueAtTime(0.8, audioCtx.currentTime);

            const thunderSrc = audioCtx.createBufferSource();
            thunderSrc.buffer = brownBuffer;
            thunderSrc.loop = true;
            
            const thunderFilter = audioCtx.createBiquadFilter();
            thunderFilter.type = 'lowpass';
            thunderFilter.frequency.setValueAtTime(60, audioCtx.currentTime);

            const thunderGain = audioCtx.createGain();
            thunderGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

            const thunderLfo = audioCtx.createOscillator();
            thunderLfo.frequency.setValueAtTime(0.03, audioCtx.currentTime);
            const thunderLfoGain = audioCtx.createGain();
            thunderLfoGain.gain.setValueAtTime(30, audioCtx.currentTime);

            thunderLfo.connect(thunderLfoGain);
            thunderLfoGain.connect(thunderFilter.frequency);

            rainSrc.connect(rainFilter);
            rainFilter.connect(synthGains.rain);
            
            thunderSrc.connect(thunderFilter);
            thunderFilter.connect(thunderGain);
            thunderGain.connect(synthGains.rain);

            thunderLfo.start();
            rainSrc.start();
            thunderSrc.start();

            // 3. BARF (SNOW) route
            const snowWind = audioCtx.createBufferSource();
            snowWind.buffer = brownBuffer;
            snowWind.loop = true;

            const snowFilter = audioCtx.createBiquadFilter();
            snowFilter.type = 'lowpass';
            snowFilter.frequency.setValueAtTime(250, audioCtx.currentTime);

            const snowLfo = audioCtx.createOscillator();
            snowLfo.frequency.setValueAtTime(0.05, audioCtx.currentTime);
            const snowLfoGain = audioCtx.createGain();
            snowLfoGain.gain.setValueAtTime(150, audioCtx.currentTime);

            snowLfo.connect(snowLfoGain);
            snowLfoGain.connect(snowFilter.frequency);

            snowWind.connect(snowFilter);
            snowFilter.connect(synthGains.snow);
            
            snowLfo.start();
            snowWind.start();

            // 4. SANATAA (SILENCE) route
            const silenceRiver = audioCtx.createBufferSource();
            silenceRiver.buffer = brownBuffer;
            silenceRiver.loop = true;

            const silenceFilter = audioCtx.createBiquadFilter();
            silenceFilter.type = 'bandpass';
            silenceFilter.frequency.setValueAtTime(280, audioCtx.currentTime);
            silenceFilter.Q.setValueAtTime(0.4, audioCtx.currentTime);

            silenceRiver.connect(silenceFilter);
            silenceFilter.connect(synthGains.silence);
            silenceRiver.start();

            audioInitialized = true;
        } catch (e) {
            console.warn("Sensory weather sound synthesis not fully supported. Using HTML5 fallbacks.", e);
            audioInitialized = false;
        }
    }

    function crossfadeAtmosphere(targetMood) {
        if (!audioInitialized) {
            initSensorySynth();
        }

        const duration = 1.8;

        if (audioInitialized && audioCtx) {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            Object.keys(synthGains).forEach(mood => {
                const targetVolume = (mood === targetMood && !isMuted) ? 0.35 : 0.0;
                synthGains[mood].gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + duration);
            });
        }

        Object.keys(fallbacks).forEach(mood => {
            const track = fallbacks[mood];
            if (!track) return;
            
            if (mood === targetMood && !isMuted) {
                track.volume = 0;
                track.play().then(() => {
                    gsap.to(track, { volume: 0.25, duration: duration });
                }).catch(e => console.log("Audio block:", e));
            } else {
                gsap.to(track, {
                    volume: 0,
                    duration: duration,
                    onComplete: () => {
                        track.pause();
                    }
                });
            }
        });
    }

    const audioBtn = document.getElementById('audio-control');

    function playGlobalAtmosphere() {
        isMuted = false;
        audioBtn.classList.add('audio-playing');
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        crossfadeAtmosphere(currentMood);
    }

    function stopGlobalAtmosphere() {
        isMuted = true;
        audioBtn.classList.remove('audio-playing');

        if (audioInitialized && audioCtx) {
            Object.keys(synthGains).forEach(mood => {
                synthGains[mood].gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.0);
            });
        }

        Object.keys(fallbacks).forEach(mood => {
            const track = fallbacks[mood];
            if (track) {
                gsap.to(track, { volume: 0, duration: 1.0, onComplete: () => track.pause() });
            }
        });
    }

    audioBtn.addEventListener('click', () => {
        if (isMuted) {
            playGlobalAtmosphere();
        } else {
            stopGlobalAtmosphere();
        }
    });

    // ----------------------------------------------------
    // 2. SANCTUARY ENTRANCE GATE
    // ----------------------------------------------------
    const enterBtn = document.getElementById('btn-enter');
    const sanctuaryGate = document.getElementById('sanctuary-gate');

    enterBtn.addEventListener('click', () => {
        playGlobalAtmosphere();

        gsap.to(sanctuaryGate, {
            opacity: 0,
            duration: 1.8,
            ease: "power2.inOut",
            onComplete: () => {
                sanctuaryGate.style.display = 'none';
                
                gsap.from('.hud-logo, .hud-controls', {
                    y: -20,
                    opacity: 0,
                    stagger: 0.1,
                    duration: 1.2,
                    ease: "power3.out"
                });

                document.querySelectorAll('.main-hero-title').forEach(title => {
                    title.classList.add('char-reveal');
                    setTimeout(() => title.classList.add('reveal-active'), 100);
                });

                gsap.from('.hero-footer-details', {
                    opacity: 0,
                    duration: 1.5,
                    delay: 0.5,
                    ease: "power2.out"
                });
            }
        });
    });

    // ----------------------------------------------------
    // 3. WEATHER MODE HUD HANDLER + IMAGE SWAPPER
    // ----------------------------------------------------
    const moodBtns = document.querySelectorAll('.mood-btn');
    const rootBody = document.body;
    const weatherStateClasses = ['sunbeam-active', 'rain-active', 'snow-active', 'silence-active'];

    function swapWeatherImages(mood) {
        document.querySelectorAll('.card-img-weather').forEach(img => {
            const newSrc = img.dataset[mood];
            if (newSrc && img.src !== newSrc) {
                // Crossfade effect: fade out → swap → fade in
                img.style.opacity = '0';
                setTimeout(() => {
                    img.src = newSrc;
                    img.onload = () => {
                        img.style.opacity = '1';
                    };
                    // Fallback in case onload doesn't fire (cached)
                    setTimeout(() => { img.style.opacity = '1'; }, 300);
                }, 400);
            }
        });

        // Update weather label badges on cards
        const labelText = weatherLabels[mood] || 'DHOOP';
        document.querySelectorAll('.cwl-text').forEach(el => {
            el.textContent = labelText;
        });
    }

    moodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mood = btn.dataset.mood;
            if (mood === currentMood) return;

            moodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            rootBody.classList.remove(...weatherStateClasses);
            if (mood === 'sunbeam') rootBody.classList.add('sunbeam-active');
            if (mood === 'rain') rootBody.classList.add('rain-active');
            if (mood === 'snow') rootBody.classList.add('snow-active');
            if (mood === 'silence') rootBody.classList.add('silence-active');

            currentMood = mood;

            // Swap dwelling images to weather variants
            swapWeatherImages(mood);

            if (!isMuted) {
                crossfadeAtmosphere(mood);
            }
        });
    });

    rootBody.classList.add('sunbeam-active');

    // ----------------------------------------------------
    // 4. LENIS SMOOTH SCROLLING ENGINE
    // ----------------------------------------------------
    const lenis = window.Lenis ? new Lenis({
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        infinite: false,
        smoothWheel: true
    }) : {
        on: () => {},
        raf: () => {},
        stop: () => {},
        start: () => {},
        scrollTo: (targetId) => {
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // ----------------------------------------------------
    // 5. GSAP SCROLLTRIGGER REVEALS & PARALLAX
    // ----------------------------------------------------
    gsap.registerPlugin(ScrollTrigger);

    gsap.to('.hero-bg', {
        scale: 1.0,
        scrollTrigger: {
            trigger: '#canopy-hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        }
    });

    document.querySelectorAll('.parallax-element').forEach((el) => {
        const speed = el.dataset.speed ? parseFloat(el.dataset.speed) : 0.05;
        gsap.to(el, {
            yPercent: speed * 100,
            ease: "none",
            scrollTrigger: {
                trigger: el,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
            }
        });
    });

    const textRevealBlocks = document.querySelectorAll('.section-title, .body-text, .exp-text-block, .char-reveal');
    textRevealBlocks.forEach(block => {
        if (!block.classList.contains('char-reveal')) {
            block.classList.add('char-reveal');
        }
        
        ScrollTrigger.create({
            trigger: block,
            start: 'top 85%',
            onEnter: () => block.classList.add('reveal-active'),
            once: true
        });
    });

    // ----------------------------------------------------
    // 6. CURSOR PARALLAX SENSORY TRANSLATION
    // ----------------------------------------------------
    let lastMouseX = 0;
    let lastMouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    window.addEventListener('mousemove', (e) => {
        // Normalize screen coordinates (-1 to 1)
        targetMouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        targetMouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    });

    const parallaxBgEls = Array.from(document.querySelectorAll('.parallax-bg')).map(bg => ({
        el: bg,
        depth: parseFloat(bg.dataset.depth || 0.1)
    }));

    function updateParallax() {
        if (!document.hidden) {
            lastMouseX += (targetMouseX - lastMouseX) * 0.08;
            lastMouseY += (targetMouseY - lastMouseY) * 0.08;

            parallaxBgEls.forEach(({ el, depth }) => {
                const xVal = -lastMouseX * depth * 55;
                const yVal = -lastMouseY * depth * 55;
                el.style.transform = `translate3d(${xVal}px, ${yVal}px, 0)`;
            });
        }

        requestAnimationFrame(updateParallax);
    }
    updateParallax();

    // ----------------------------------------------------
    // 7. CANVAS WEATHER ENGINE (DHOOP, VARISH, BARF, SANATAA)
    // ----------------------------------------------------
    const canvas = document.getElementById('weather-canvas');
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
        width = (canvas.width = window.innerWidth);
        height = (canvas.height = window.innerHeight);
    });

    class SunDust {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2.0 + 0.5;
            this.speedX = Math.random() * 0.2 - 0.1;
            this.speedY = Math.random() * 0.15 + 0.05;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.waveSpeed = Math.random() * 0.01 + 0.002;
            this.angle = Math.random() * Math.PI * 2;
        }
        update() {
            this.y += this.speedY;
            this.x += (this.speedX + Math.sin(this.angle) * 0.15);
            this.angle += this.waveSpeed;
            if (this.y > height) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(226, 154, 43, ${this.opacity})`;
            ctx.fill();
        }
    }

    class RainStreak {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * -100;
            this.length = Math.random() * 25 + 10;
            this.speedY = Math.random() * 12 + 10;
            this.speedX = -2;
            this.opacity = Math.random() * 0.18 + 0.08;
        }
        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            if (this.y > height) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(241, 235, 225, ${this.opacity})`;
            ctx.lineWidth = 1.0;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.speedX, this.y + this.length);
            ctx.stroke();
        }
    }

    class SnowFlake {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * -50;
            this.size = Math.random() * 3.5 + 0.8;
            this.speedY = Math.random() * 0.8 + 0.4;
            this.speedX = Math.random() * 0.5 - 0.2;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.wobble = Math.random() * 0.02 + 0.005;
            this.angle = Math.random() * Math.PI * 2;
        }
        update() {
            this.y += this.speedY;
            this.x += (this.speedX + Math.sin(this.angle) * 0.25);
            this.angle += this.wobble;
            if (this.y > height) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(251, 248, 244, ${this.opacity})`;
            ctx.fill();
        }
    }

    class Firefly {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height + height * 0.1;
            this.size = Math.random() * 2.2 + 0.8;
            this.speedX = Math.random() * 0.3 - 0.15;
            this.speedY = -(Math.random() * 0.5 + 0.2);
            this.opacity = Math.random() * 0.6 + 0.1;
            this.flickerSpeed = Math.random() * 0.015 + 0.005;
            this.angle = Math.random() * Math.PI * 2;
            this.wobble = Math.random() * 0.01 + 0.005;
        }
        update() {
            this.y += this.speedY;
            this.x += (this.speedX + Math.sin(this.angle) * 0.15);
            this.angle += this.wobble;
            this.opacity += this.flickerSpeed;
            if (this.opacity > 0.85 || this.opacity < 0.1) {
                this.flickerSpeed = -this.flickerSpeed;
            }
            if (this.y < -10) {
                this.reset();
                this.y = height + 10;
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(226, 154, 43, ${Math.max(0, this.opacity)})`;
            ctx.fill();
        }
    }

    const particles = {
        sunbeam: Array.from({ length: 40 }, () => new SunDust()),
        rain: Array.from({ length: 120 }, () => new RainStreak()),
        snow: Array.from({ length: 80 }, () => new SnowFlake()),
        silence: Array.from({ length: 45 }, () => new Firefly())
    };

    function renderWeatherLoop() {
        if (!document.hidden) {
            ctx.clearRect(0, 0, width, height);

            let activeArray = [];
            if (currentMood === 'sunbeam') activeArray = particles.sunbeam;
            if (currentMood === 'rain') activeArray = particles.rain;
            if (currentMood === 'snow') activeArray = particles.snow;
            if (currentMood === 'silence') activeArray = particles.silence;

            activeArray.forEach(p => {
                p.update();
                p.draw();
            });
        }
        requestAnimationFrame(renderWeatherLoop);
    }
    renderWeatherLoop();

    // ----------------------------------------------------
    // 8. FULLSCREEN NAVIGATION MENU LOGIC
    // ----------------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const immersiveNav = document.getElementById('immersive-nav');
    const navItems = document.querySelectorAll('.nav-item');

    function toggleMenu() {
        const isActive = immersiveNav.classList.contains('active');
        
        if (!isActive) {
            immersiveNav.classList.add('active');
            menuToggle.classList.add('menu-active');
            lenis.stop();
            
            gsap.fromTo(navItems, 
                { y: 40, opacity: 0 }, 
                { y: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: "power3.out", delay: 0.2 }
            );
            
            gsap.fromTo('.nav-left',
                { opacity: 0, x: -30 },
                { opacity: 1, x: 0, duration: 0.8, ease: "power2.out", delay: 0.1 }
            );
        } else {
            immersiveNav.classList.remove('active');
            menuToggle.classList.remove('menu-active');
            lenis.start();
        }
    }

    menuToggle.addEventListener('click', toggleMenu);

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href');
            
            immersiveNav.classList.remove('active');
            menuToggle.classList.remove('menu-active');
            lenis.start();

            lenis.scrollTo(targetId, {
                offset: 0,
                duration: 1.5
            });
        });
    });

    // ----------------------------------------------------
    // 9. DWELLINGS SLIDER (SEAMLESS INFINITE LOOP ENGINE)
    // ----------------------------------------------------
    const track = document.querySelector('.dwellings-track');
    const dwellingsViewport = document.querySelector('.dwellings-slider-container');
    const dots = document.querySelectorAll('.slider-dots .slider-dot');
    const btnPrev = document.querySelector('.slider-arrow.prev');
    const btnNext = document.querySelector('.slider-arrow.next');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sourceCards = track ? Array.from(track.querySelectorAll('.dwelling-card:not(.card-clone)')) : [];
    const sourceMarkup = sourceCards.map((card) => {
        const cleanCard = card.cloneNode(true);
        cleanCard.classList.remove('active', 'card-clone');
        return cleanCard.outerHTML;
    }).join('');
    const cardsPerSet = sourceCards.length;

    let loopCards = [];
    let loopOffset = 0;
    let loopSetWidth = 0;
    let loopSpeed = 0.045;
    let loopDirection = -1;
    let loopPaused = false;
    let loopAnimating = false;
    let lastLoopFrame = performance.now();
    let lastFocusSync = 0;

    function getTrackGap() {
        if (!track) return 0;
        const styles = window.getComputedStyle(track);
        return parseFloat(styles.columnGap || styles.gap) || 0;
    }

    function collectLoopCards() {
        loopCards = track ? Array.from(track.querySelectorAll('.dwelling-card')) : [];
    }

    function measureLoopSet() {
        if (!loopCards.length || !cardsPerSet) return;
        const gap = getTrackGap();
        const firstSet = loopCards.slice(0, cardsPerSet);
        loopSetWidth = firstSet.reduce((total, card) => total + card.getBoundingClientRect().width, 0) + (gap * cardsPerSet);
    }

    function normalizeLoopOffset() {
        if (!loopSetWidth) return;
        while (loopOffset <= -loopSetWidth) loopOffset += loopSetWidth;
        while (loopOffset > 0) loopOffset -= loopSetWidth;
    }

    function applyLoopTransform() {
        if (!track) return;
        track.style.transition = 'none';
        track.style.transform = `translate3d(${loopOffset}px, 0, 0)`;
    }

    function syncDwellingsFocus() {
        if (!dwellingsViewport || !loopCards.length) return;
        const viewportRect = dwellingsViewport.getBoundingClientRect();
        const viewportCenter = viewportRect.left + (viewportRect.width / 2);
        let closestCard = null;
        let closestDistance = Infinity;

        loopCards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const cardCenter = rect.left + (rect.width / 2);
            const distance = Math.abs(cardCenter - viewportCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestCard = card;
            }
        });

        loopCards.forEach((card) => {
            card.classList.toggle('active', card === closestCard);
        });

        const activeIndex = closestCard ? parseInt(closestCard.dataset.index, 10) : 0;
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === activeIndex);
        });
    }

    function buildDwellingsLoop() {
        if (!track || !sourceMarkup || !cardsPerSet) return;

        track.innerHTML = sourceMarkup.repeat(2);
        collectLoopCards();
        measureLoopSet();

        const safeSetWidth = Math.max(loopSetWidth, 1);
        const copiesNeeded = Math.max(4, Math.ceil((window.innerWidth + safeSetWidth) / safeSetWidth) + 3);
        track.innerHTML = sourceMarkup.repeat(copiesNeeded);
        collectLoopCards();

        loopCards.forEach((card, idx) => {
            card.dataset.loopOrdinal = String(idx);
            card.setAttribute('aria-roledescription', 'slide');
        });

        measureLoopSet();
        normalizeLoopOffset();
        applyLoopTransform();
        swapWeatherImages(currentMood);
        requestAnimationFrame(syncDwellingsFocus);
    }

    function getActiveDwellingIndex() {
        const activeCard = track ? track.querySelector('.dwelling-card.active') : null;
        return activeCard ? parseInt(activeCard.dataset.index, 10) : 0;
    }

    function centerDwelling(targetIndex) {
        if (!dwellingsViewport || !loopCards.length || loopAnimating) return;
        const viewportRect = dwellingsViewport.getBoundingClientRect();
        const viewportCenter = viewportRect.left + (viewportRect.width / 2);
        const candidates = loopCards.filter((card) => parseInt(card.dataset.index, 10) === targetIndex);

        let bestCard = null;
        let bestDelta = 0;
        let bestDistance = Infinity;

        candidates.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const cardCenter = rect.left + (rect.width / 2);
            const delta = cardCenter - viewportCenter;
            const distance = Math.abs(delta);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestDelta = delta;
                bestCard = card;
            }
        });

        if (!bestCard) return;

        const fromOffset = loopOffset;
        const toOffset = loopOffset - bestDelta;
        const startedAt = performance.now();
        const duration = 650;
        loopAnimating = true;
        loopPaused = true;

        function step(now) {
            const progress = Math.min(1, (now - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            loopOffset = fromOffset + ((toOffset - fromOffset) * eased);
            applyLoopTransform();

            if (progress < 1) {
                requestAnimationFrame(step);
                return;
            }

            normalizeLoopOffset();
            applyLoopTransform();
            loopAnimating = false;
            loopPaused = false;
            syncDwellingsFocus();
        }

        requestAnimationFrame(step);
    }

    let dwellingsInView = true;

    function renderDwellingsLoop(now) {
        const delta = Math.min(48, now - lastLoopFrame);
        lastLoopFrame = now;

        if (!document.hidden && dwellingsInView) {
            if (!reducedMotion && !loopPaused && !loopAnimating && loopSetWidth) {
                loopOffset += loopDirection * loopSpeed * delta;
                normalizeLoopOffset();
                applyLoopTransform();
            }

            if (now - lastFocusSync > 160) {
                syncDwellingsFocus();
                lastFocusSync = now;
            }
        }

        requestAnimationFrame(renderDwellingsLoop);
    }

    if (track && dwellingsViewport && sourceMarkup) {
        buildDwellingsLoop();
        requestAnimationFrame(renderDwellingsLoop);

        if ('IntersectionObserver' in window) {
            const dwellingsObserver = new IntersectionObserver((entries) => {
                dwellingsInView = entries[0].isIntersecting;
            }, { rootMargin: '200px 0px' });
            dwellingsObserver.observe(dwellingsViewport);
        }

        dwellingsViewport.addEventListener('pointerenter', () => { loopPaused = true; });
        dwellingsViewport.addEventListener('pointerleave', () => { loopPaused = false; });
        dwellingsViewport.addEventListener('focusin', () => { loopPaused = true; });
        dwellingsViewport.addEventListener('focusout', () => { loopPaused = false; });

        if (btnNext) {
            btnNext.addEventListener('click', () => {
                loopDirection = -1;
                centerDwelling((getActiveDwellingIndex() + 1) % cardsPerSet);
            });
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                loopDirection = 1;
                centerDwelling((getActiveDwellingIndex() + cardsPerSet - 1) % cardsPerSet);
            });
        }

        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                centerDwelling(parseInt(dot.dataset.index, 10));
            });
        });

        let rebuildTimer = null;
        window.addEventListener('resize', () => {
            window.clearTimeout(rebuildTimer);
            rebuildTimer = window.setTimeout(buildDwellingsLoop, 160);
        });
    }

    // ----------------------------------------------------
    // 10. ANIMATED STAT COUNTERS (THE LIVING FOREST)
    // ----------------------------------------------------
    const statNumbers = document.querySelectorAll('.stat-number');
    let statsAnimated = false;

    function animateCounters() {
        if (statsAnimated) return;
        statsAnimated = true;

        statNumbers.forEach(el => {
            const target = parseInt(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            const actual = el.dataset.actual; // For display override (e.g. "12 dB")
            const duration = 2000;
            const startTime = performance.now();

            function updateCount(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing: ease-out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const currentVal = Math.round(eased * target);
                
                if (actual && progress >= 1) {
                    el.textContent = actual + suffix;
                } else {
                    el.textContent = currentVal.toLocaleString() + suffix;
                }

                if (progress < 1) {
                    requestAnimationFrame(updateCount);
                }
            }

            requestAnimationFrame(updateCount);
        });
    }

    // Trigger counter animation when Living Forest section scrolls into view
    const livingForestSection = document.getElementById('living-forest');
    if (livingForestSection) {
        ScrollTrigger.create({
            trigger: livingForestSection,
            start: 'top 70%',
            onEnter: animateCounters,
            once: true
        });
    }

    // ----------------------------------------------------
    // 11. BOOKING FORM SUBMISSION
    // ----------------------------------------------------
    const form = document.getElementById('inquiry-form');
    const formSuccess = document.getElementById('form-success');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        gsap.to(form, {
            opacity: 0,
            duration: 0.6,
            onComplete: () => {
                form.style.display = 'none';
                formSuccess.style.display = 'flex';
                setTimeout(() => {
                    formSuccess.classList.add('active');
                    
                    gsap.from('.success-icon-wrap', {
                        scale: 0.5,
                        opacity: 0,
                        duration: 0.8,
                        ease: "back.out(1.7)"
                    });
                    
                    gsap.from('.success-heading, .success-desc', {
                        y: 20,
                        opacity: 0,
                        stagger: 0.1,
                        duration: 0.8,
                        ease: "power2.out"
                    });
                }, 50);
            }
        });
    });

    // ----------------------------------------------------
    // 12. METEOROLOGY SIMULATOR (KASOL WEATHER & TELEMETRY)
    // ----------------------------------------------------
    function simulateKasolWeather() {
        const tempDisplay = document.getElementById('temp-display');
        const hour = new Date().getHours();
        
        let baseTemp = 16;
        let weatherText = "Mist and Pines";

        if (hour >= 20 || hour < 5) {
            baseTemp = 11;
            weatherText = "Clear Starry Sky";
        } else if (hour >= 5 && hour < 9) {
            baseTemp = 13;
            weatherText = "Rising Forest Fog";
        } else if (hour >= 9 && hour < 16) {
            baseTemp = 20;
            weatherText = "Sunbeams Piercing Forest";
        } else if (hour >= 16 && hour < 20) {
            baseTemp = 15;
            weatherText = "Twilight River Breeze";
        }

        if (tempDisplay) {
            tempDisplay.innerHTML = `${baseTemp}°C <span class="temp-sub">${weatherText}</span>`;
        }

        const silenceDisplay = document.getElementById('ind-silence');
        const moistureDisplay = document.getElementById('ind-moisture');
        const windDisplay = document.getElementById('ind-wind');

        if (silenceDisplay) {
            const silenceOsc = (97.8 + Math.random() * 0.6).toFixed(1);
            silenceDisplay.innerText = `${silenceOsc}% (Absolute)`;
        }

        if (moistureDisplay) {
            const moistureOsc = Math.round(71 + Math.random() * 4);
            moistureDisplay.innerText = `${moistureOsc}% (Cedar Sap)`;
        }

        if (windDisplay) {
            const windOsc = Math.round(2 + Math.random() * 3);
            windDisplay.innerText = `${windOsc} km/h (West)`;
        }
    }

    simulateKasolWeather();
    setInterval(simulateKasolWeather, 5000);

    // ----------------------------------------------------
    // 13. QUOTE RIBBON PARALLAX
    // ----------------------------------------------------
    document.querySelectorAll('.quote-ribbon').forEach(ribbon => {
        gsap.to(ribbon.querySelector('.quote-content'), {
            yPercent: -15,
            ease: 'none',
            scrollTrigger: {
                trigger: ribbon,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
            }
        });
    });
});
