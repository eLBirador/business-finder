// Thin player: no animation rules here. Fetches the Worker's plan and plays its keyframes.
(function () {
  var q = new URLSearchParams(location.search);
  var idm = /^\/e\/(bf_[A-Za-z0-9]{8,10})\/?$/.exec(location.pathname);
  if (idm) q = new URLSearchParams({ id: idm[1], theme: q.get("theme") || "" });
  var status = document.getElementById("status"), labels = document.getElementById("labels");
  var controls = document.getElementById("controls"), dir = document.getElementById("dir");
  var skipBtn = document.getElementById("skip"), replayBtn = document.getElementById("replay");
  if (/^dark$/i.test(q.get("theme") || "")) document.body.classList.add("bf-dark");
  var IC = { replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>', pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>' };
  var TIP = { replay: ["Replay tour", "Replay"], play: ["Play tour", "Play"], pause: ["Pause tour", "Pause"] };
  function setMode(m) { replayBtn.dataset.mode = m; replayBtn.querySelector("svg").innerHTML = IC[m]; replayBtn.setAttribute("aria-label", TIP[m][0]); replayBtn.dataset.tip = TIP[m][1]; }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fail() { status.textContent = "Location unavailable"; status.className = "error"; }
  fetch("/api/plan?" + q.toString()).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(start).catch(fail);

  function start(plan) {
    var kf = plan.keyframes, last = kf[kf.length - 1];
    var map = new maplibregl.Map({ container: "map", style: "/style.json", center: kf[0].center, zoom: kf[0].zoom,
      cooperativeGestures: true, maxPitch: 70, attributionControl: { compact: innerWidth < 420, customAttribution: ["<a class=\"bf-by\" href=\"https://www.yahaay.com/business-finder/\" target=\"_blank\" rel=\"noopener\" aria-label=\"Business Finder by Yahaay (opens in new tab)\"><i aria-hidden=\"true\">Y</i>by Yahaay</a>", "MapLibre"] } });
    function attribH() { var c = document.querySelector(".maplibregl-compact-show"); if (c && innerWidth < 420 && !attribH.done) { c.classList.remove("maplibregl-compact-show"); attribH.done = 1; } var a = document.querySelector(".maplibregl-ctrl-bottom-right"); if (a) document.documentElement.style.setProperty("--attrib-h", (innerWidth < 420 ? 32 : a.offsetHeight) + "px"); }
    addEventListener("resize", attribH);
    var skipT;
    function showControls() {
      if (!controls.hidden && controls.classList.contains("is-in")) return;
      controls.hidden = false; skipBtn.hidden = true; clearTimeout(skipT);
      if (reduce) controls.classList.add("is-in"); else requestAnimationFrame(function () { requestAnimationFrame(function () { controls.classList.add("is-in"); }); });
    }
    function hideControls() { controls.classList.remove("is-in"); controls.hidden = true; }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    var marker = new maplibregl.Marker({ className: "bf-pin", color: "#4f46e5" }).setLngLat(plan.target);
    // Pin drop (CSS on the inner SVG). animate=false places it already landed (Skip, finalView, reduced motion).
    function placePin(animate) {
      var el = marker.getElement(); el.classList.remove("bf-drop");
      marker.addTo(map);
      if (animate && !reduce) { void el.offsetWidth; el.classList.add("bf-drop"); }
    }
    if (plan.name) marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
      "<strong></strong><br><a target=_blank rel=noopener>Get directions</a>"));
    dir.href = plan.directionsUrl; if (plan.name) dir.setAttribute("aria-label", "Get directions to " + plan.name + " (opens in new tab)");
    var run = 0, timer, lmMarkers = [], lmOn = false;
    var ICON = { station: "🚉", shopping: "🛍️", park: "🌳", school: "🏫", hospital: "🏥" };
    var nearby = document.getElementById("nearby");
    function showLandmarks(on) {
      lmOn = on; nearby.setAttribute("aria-pressed", String(on));
      lmMarkers.forEach(function (m) { m.remove(); }); lmMarkers = [];
      if (!on) return;
      (plan.landmarks || []).forEach(function (l) {
        var el = document.createElement("div"); el.className = "lm"; el.textContent = (ICON[l.type] || "📍") + " " + l.name;
        var pop = new maplibregl.Popup({ offset: 12 }); var c = document.createElement("div");
        var b = document.createElement("strong"); b.textContent = l.name; c.appendChild(b);
        c.appendChild(document.createElement("br"));
        c.appendChild(document.createTextNode(l.type + " · " + (l.distanceM >= 1000 ? (l.distanceM / 1000).toFixed(1) + " km" : l.distanceM + " m") + " " + l.direction + " of the business"));
        pop.setDOMContent(c);
        lmMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([l.lng, l.lat]).setPopup(pop).addTo(map));
      });
    }
    nearby.hidden = !(plan.landmarks && plan.landmarks.length);
    nearby.onclick = function () { showLandmarks(!lmOn); };
    function wait(ms) { return new Promise(function (r) { timer = setTimeout(r, ms); }); }
    // Earlier state/LGU labels shrink to a breadcrumb; business name and street both stay full size (PRD 6).
    // One label card: state and LGU collapse into a breadcrumb; business name with the street as a subline (UI review P0.2).
    var card = labels.querySelector(".card"), crumbs = card.querySelector(".crumbs"), nm = card.querySelector(".nm"), st = card.querySelector(".st");
    function clearLabels() { crumbs.textContent = ""; nm.textContent = ""; st.textContent = ""; card.hidden = true; card.classList.remove("on", "orbit"); }
    function label(text, step) {
      if (!text) return;
      if (step === "location") nm.textContent = text;
      else if (step === "street") st.textContent = text;
      else crumbs.textContent = crumbs.textContent ? crumbs.textContent + " \u203a " + text : text;
      card.hidden = false; requestAnimationFrame(function () { card.classList.add("on"); });
    }
    function crumbAll() { crumbs.textContent = kf.filter(function (k) { return (k.step === "state" || k.step === "lgu") && k.label; }).map(function (k) { return k.label; }).join(" \u203a "); }
    function finalView() {
      playing = false; run++; clearTimeout(timer); cancelAnimationFrame(raf); clearLabels(); showLandmarks(false); skipBtn.hidden = true; clearTimeout(skipT); setMode("replay");
      map.jumpTo({ center: last.center, zoom: last.zoom, pitch: 0, bearing: 0 }); placePin(false);
      crumbAll(); kf.filter(function (k) { return k.step === "location" || k.step === "street"; }).forEach(function (k) { label(k.label, k.step); });
      if (plan.landmarks && plan.landmarks.length) showLandmarks(true);
      showControls();
    }
    var playing = false;
    function showStep(step) {
      clearLabels(); crumbAll();
      // The suburb pull-back keeps the business and street labels (it is a local view of the same place).
      var local = step === "location" || step === "suburb";
      kf.filter(function (k) { return local ? (k.step === "location" || k.step === "street") : k.step === step; })
        .forEach(function (k) { label(k.label, k.step); });
    }
    async function play() {
      var my = ++run; playing = true; clearTimeout(timer); cancelAnimationFrame(raf); clearLabels(); marker.remove(); hideControls(); showLandmarks(false); setMode("pause");
      clearTimeout(skipT); skipT = setTimeout(function () { if (my === run) skipBtn.hidden = false; }, 1500);
      map.jumpTo({ center: kf[0].center, zoom: kf[0].zoom, pitch: 0, bearing: 0 });
      for (var i = 0; i < kf.length; i++) {
        var k = kf[i];
        if (k.flyMs > 0) { map.flyTo({ center: k.center, zoom: k.zoom, duration: k.flyMs, curve: 1.2, easing: sine, essential: false }); await wait(k.flyMs); }
        if (my !== run) return;
        if (k.step === "location") placePin(true);
        label(k.label, k.step);
        await wait(k.holdMs); if (my !== run) return;
      }
      skipBtn.hidden = true; clearTimeout(skipT); card.classList.add("orbit");
      await orbit(my, o, showControls); if (my !== run) return;
      card.classList.remove("orbit"); showControls();
      // Loop (PRD 6.1): local suburb pull-back <-> location pulse, never the state or LGU view. Parameters come from plan.loop.
      var lp = plan.loop;
      while (lp && lp.enabled && my === run) {
        for (var j = 0; j < lp.steps.length; j++) {
          var s = lp.steps[j];
          map.flyTo({ center: s.center, zoom: s.zoom, pitch: s.pitch, bearing: s.bearing, duration: s.flyMs, curve: 1.2, easing: sine, essential: false });
          await wait(s.flyMs); if (my !== run) return;
          showStep(s.step);
          if (s.orbit) { card.classList.add("orbit"); await orbit(my, s.orbit); card.classList.remove("orbit"); if (my !== run) return; }
          await wait(s.holdMs); if (my !== run) return;
        }
      }
      playing = false; setMode("replay");
    }
    // Any user interaction stops the sequence and the loop; controls stay available.
    function interrupt() {
      if (!playing) return;
      playing = false; run++; clearTimeout(timer); cancelAnimationFrame(raf); map.stop(); skipBtn.hidden = true; clearTimeout(skipT); setMode("replay"); showControls();
    }
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach(function (n) {
      document.getElementById("map").addEventListener(n, interrupt, { capture: true, passive: true });
    });
    // Step 5 drone orbit: parameters come from the Worker plan; center is locked on the pin every frame.
    var o = plan.orbit, pin = o ? o.center : plan.target, drift = { max: 0, samples: 0 }, raf;
    window.__bf = { map: map, drift: drift, plan: plan };
    function sine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
    function checkCenter() {
      var c = map.getCenter(), d = Math.max(Math.abs(c.lng - pin[0]), Math.abs(c.lat - pin[1]));
      drift.samples++; if (d > drift.max) drift.max = d;
      console.assert(d < 1e-9, "orbit drift", d);
    }
    function orbit(my, oo, onSettle) {
      if (!oo) return Promise.resolve();
      var ease = oo.easing === "linear" ? function (t) { return t; } : sine;
      return new Promise(function (resolve) {
        var z0 = map.getZoom(), p0 = map.getPitch();
        map.jumpTo({ center: pin, bearing: oo.bearingStart });
        if (oo.landmarksOn && plan.landmarks && plan.landmarks.length) showLandmarks(true);
        var t0 = performance.now();
        (function frame(now) {
          if (my !== run) return resolve();
          var t = now - t0, p = Math.min(1, t / oo.durationMs), pi = sine(Math.min(1, t / oo.pitchInMs));
          map.jumpTo({ center: pin, bearing: oo.bearingStart + oo.bearingSweep * ease(p),
            pitch: p0 + (oo.pitch - p0) * pi, zoom: z0 + (oo.zoom - z0) * pi });
          checkCenter();
          if (p < 1) { raf = requestAnimationFrame(frame); return; }
          if (onSettle) onSettle();
          map.easeTo({ center: pin, pitch: oo.settlePitch, duration: oo.settleMs, easing: sine });
          timer = setTimeout(function () { checkCenter(); resolve(); }, oo.settleMs);
        })(t0);
      });
    }
    replayBtn.onclick = function () { if (replayBtn.dataset.mode === "pause") { interrupt(); return; } reduce ? finalView() : play(); };
    skipBtn.onclick = function () { finalView(); };
    map.on("load", function () {
      status.hidden = true; attribH();
      var autoplay = q.get("autoplay") === null || !/^(false|0|no)$/i.test(q.get("autoplay"));
      if (reduce || !autoplay) { finalView(); if (!autoplay && !reduce) setMode("play"); return; }
      if (!("IntersectionObserver" in window)) return play();
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.4 });
      io.observe(document.getElementById("map"));
    });
    if (plan.name) marker.getPopup().on("open", function () {
      var el = marker.getPopup().getElement(); el.querySelector("strong").textContent = plan.name;
      el.querySelector("a").href = plan.directionsUrl;
    });
  }
})();
