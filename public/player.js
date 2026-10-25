// Thin player: no animation rules here. Fetches the Worker's plan and plays its keyframes.
(function () {
  var q = new URLSearchParams(location.search);
  var status = document.getElementById("status"), labels = document.getElementById("labels");
  var controls = document.getElementById("controls"), dir = document.getElementById("dir");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function fail() { status.textContent = "Location unavailable"; status.className = "error"; }
  fetch("/api/plan?" + q.toString()).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(start).catch(fail);

  function start(plan) {
    var kf = plan.keyframes, last = kf[kf.length - 1];
    var map = new maplibregl.Map({ container: "map", style: "/style.json", center: kf[0].center, zoom: kf[0].zoom,
      cooperativeGestures: true, attributionControl: { compact: false } });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    var marker = new maplibregl.Marker().setLngLat(plan.target);
    if (plan.name) marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
      "<strong></strong><br><a target=_blank rel=noopener>Get directions</a>"));
    dir.href = plan.directionsUrl;
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
    function label(text, id) {
      Array.prototype.forEach.call(labels.children, function (c) { c.classList.add("crumb"); });
      if (!text) return;
      var d = document.createElement("div"); d.className = "lbl"; d.textContent = text; labels.appendChild(d);
      requestAnimationFrame(function () { d.classList.add("on"); });
    }
    function finalView() {
      run++; clearTimeout(timer); labels.innerHTML = ""; showLandmarks(false);
      map.jumpTo({ center: last.center, zoom: last.zoom }); marker.addTo(map);
      kf.filter(function (k) { return k.step === "location" || k.step === "street"; }).forEach(function (k) { label(k.label); });
      controls.hidden = false;
    }
    async function play() {
      var my = ++run; clearTimeout(timer); labels.innerHTML = ""; marker.remove(); controls.hidden = true; showLandmarks(false);
      map.jumpTo({ center: kf[0].center, zoom: kf[0].zoom });
      for (var i = 0; i < kf.length; i++) {
        var k = kf[i];
        if (k.flyMs > 0) { map.flyTo({ center: k.center, zoom: k.zoom, duration: k.flyMs, essential: false }); await wait(k.flyMs); }
        if (my !== run) return;
        if (k.step === "location") marker.addTo(map);
        label(k.label);
        await wait(k.holdMs); if (my !== run) return;
      }
      controls.hidden = false;
    }
    document.getElementById("replay").onclick = function () { reduce ? finalView() : play(); };
    document.getElementById("play").onclick = function () { play(); };
    map.on("load", function () {
      status.hidden = true;
      var autoplay = q.get("autoplay") === null || !/^(false|0|no)$/i.test(q.get("autoplay"));
      if (reduce || !autoplay) { finalView(); return; }
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
