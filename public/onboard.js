/* TEMPORARY onboarding preview (PRD section 7). Nothing is saved. */
(function () {
  fetch("/api/config").then(function (r) { return r.json(); }).then(function (c) { window.__bfHost = c.embedHost; }).catch(function () {});
  var $ = function (id) { return document.getElementById(id); };
  var map, marker, picked, items = [], sel = -1, B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  var CK = '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>Copy';
  var DONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Copied';
  function readout() { var p = marker.getLngLat(); $("ob-ll").value = p.lat.toFixed(6) + ", " + p.lng.toFixed(6); }
  function select(i) {
    sel = i; var m = items[i]; picked = m;
    Array.prototype.forEach.call($("ob-results").children, function (li, k) { li.setAttribute("aria-selected", String(k === i)); });
    $("ob-addr").setAttribute("aria-activedescendant", "ob-r" + i);
    $("ob-step2").hidden = false; $("ob-confirm").disabled = false; $("ob-out").hidden = true; $("ob-summary").hidden = true; $("ob-reset").hidden = true;
    if (!map) {
      map = new maplibregl.Map({ container: "ob-map", style: "/style.json", center: [m.lng, m.lat], zoom: 16 });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      marker = new maplibregl.Marker({ draggable: true, className: "bf-pin", color: "#4f46e5" }).setLngLat([m.lng, m.lat]).addTo(map);
      marker.on("drag", readout);
      marker.on("dragstart", function () { marker.getElement().classList.add("ob-lift"); $("ob-chip").hidden = true; });
      marker.on("dragend", function () { marker.getElement().classList.remove("ob-lift"); readout(); $("ob-reset").hidden = false; });
      $("ob-map").addEventListener("keydown", function (e) {
        var d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (!d) return;
        e.preventDefault(); e.stopPropagation(); var p = marker.getLngLat(), m = e.shiftKey ? 10 : 1;
        marker.setLngLat([p.lng + d[0] * m / (111320 * Math.cos(p.lat * Math.PI / 180)), p.lat + d[1] * m / 110540]); readout(); $("ob-reset").hidden = false; $("ob-chip").hidden = true;
      }, true);
    } else { marker.setLngLat([m.lng, m.lat]); map.jumpTo({ center: [m.lng, m.lat], zoom: 16 }); }
    readout(); var pe = marker.getElement(); pe.classList.remove("bf-drop"); void pe.offsetWidth; pe.classList.add("bf-drop");
  }
  $("ob-reset").onclick = function () { marker.setLngLat([picked.lng, picked.lat]); map.jumpTo({ center: [picked.lng, picked.lat] }); readout(); $("ob-reset").hidden = true; };
  $("ob-addr").addEventListener("keydown", function (e) {
    if (!items.length || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault(); select(Math.max(0, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))));
  });
  $("ob-form").onsubmit = function (e) {
    e.preventDefault();
    var st = $("ob-status"), list = $("ob-results"); list.innerHTML = ""; items = []; sel = -1; st.textContent = "Searching…";
    $("ob-step2").hidden = true; $("ob-out").hidden = true; $("ob-summary").hidden = true;
    fetch("/api/geocode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: $("ob-addr").value }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) { st.textContent = j.error; return; }
        if (!j.matches.length) { st.textContent = "No matches. Try adding the suburb and state."; return; }
        items = j.matches.slice(0, 5);
        st.textContent = items.length === 1 ? "1 match. Check the pin below." : items.length + " matches. The first is selected; pick another if it's not right.";
        items.forEach(function (m, i) {
          var parts = m.display_name.split(", "), li = document.createElement("li");
          li.id = "ob-r" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", "false");
          li.innerHTML = CK + "<div><div class=ob-p></div><div class=ob-s></div></div>";
          li.querySelector(".ob-p").textContent = parts[0]; li.querySelector(".ob-s").textContent = parts.slice(1).join(", ");
          li.onclick = function () { select(i); };
          list.appendChild(li);
        });
        select(0); // visibly marked selected, and the map is scrolled into view
        $("ob-step2").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }).catch(function () { st.textContent = "Lookup failed."; });
  };
  function tab(n) {
    [1, 2].forEach(function (k) { $("ob-t" + k).setAttribute("aria-selected", String(k === n)); $("ob-p" + k).hidden = k !== n; });
  }
  $("ob-t1").onclick = function () { tab(1); }; $("ob-t2").onclick = function () { tab(2); };
  Array.prototype.forEach.call(document.querySelectorAll(".ob-copy"), function (b) {
    b.innerHTML = COPY;
    b.onclick = function () {
      var pre = $(b.dataset.for);
      (navigator.clipboard ? navigator.clipboard.writeText(pre.textContent) : Promise.reject()).then(function () {
        b.innerHTML = DONE; b.classList.add("ok"); $("ob-live").textContent = "Embed code copied";
        setTimeout(function () { b.innerHTML = COPY; b.classList.remove("ok"); }, 2000);
      }, function () {
        var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
        $("ob-live").textContent = "Press Ctrl+C to copy";
      });
    };
  });
  // Spam protection (same as yahaay.com): Turnstile + honeypot + time since the form was shown.
  var tsTok = "", tsId, shown = Date.now(), tsKey = "";
  fetch("/api/business/config").then(function (r) { return r.json(); }).then(function (c) {
    tsKey = c.siteKey || ""; if (!tsKey) return;
    window.bfTs = function () { tsId = turnstile.render("#ob-ts", { sitekey: tsKey, action: "bf_create", callback: function (t) { tsTok = t; }, "expired-callback": function () { tsTok = ""; } }); };
    var sc = document.createElement("script"); sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=bfTs"; sc.async = true; document.head.appendChild(sc);
  }).catch(function () {});
  $("ob-confirm").onclick = function () {
    var p = marker.getLngLat(), err = $("ob-err"), btn = $("ob-confirm");
    err.textContent = "";
    var name = $("ob-name").value.trim() || (picked ? picked.display_name.split(", ")[0] : "");
    var body = { name: name, address: picked ? picked.display_name.slice(0, 200) : $("ob-addr").value.trim(), osmRef: picked && picked.osm_ref || undefined,
      lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), email: $("ob-email").value.trim(), options: { landmarks: true, autoplay: true },
      company_site: $("ob-hp").value, elapsedMs: Date.now() - shown, turnstileToken: tsTok };
    if (tsKey && !tsTok) { err.textContent = "Please complete the check above."; return; }
    btn.disabled = true;
    fetch("/api/business", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Save failed"); return j; }); })
      .then(function (j) {
        window.__bfId = j.id;
        $("ob-iframe").textContent = j.embed.iframe; $("ob-script").textContent = j.embed.script;
        $("ob-token").textContent = j.editToken;
        $("ob-id").textContent = j.id; $("ob-out").hidden = false; $("ob-player").hidden = true; tab(1);
        $("ob-step2").hidden = true; $("ob-summary").hidden = false;
        $("ob-sum").textContent = "Saved " + j.id + " · pin " + $("ob-ll").value + (picked ? " · " + picked.display_name.split(", ")[0] : "");
      })
      .catch(function (e) { err.textContent = e.message; tsTok = ""; if (window.turnstile && tsId !== undefined) turnstile.reset(tsId); })
      .finally(function () { btn.disabled = false; });
  };
  // Live preview: debounced (~600 ms) refresh of the raw-params preview while the name changes.
  var pvT; $("ob-name").addEventListener("input", function () { clearTimeout(pvT); pvT = setTimeout(function () { if (!$("ob-player").hidden && !window.__bfId) $("ob-play").onclick(); }, 600); });
  $("ob-edit").onclick = function () { $("ob-step2").hidden = false; $("ob-summary").hidden = true; $("ob-out").hidden = true; map.resize(); };
  $("ob-play").onclick = function () {
    var p = marker.getLngLat(), q = new URLSearchParams({ lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) });
    var n = $("ob-name").value.trim(); if (n) q.set("name", n);
    $("ob-player").src = window.__bfId ? "/e/" + window.__bfId : "/embed?" + q.toString(); $("ob-player").hidden = false;
  };
})();
