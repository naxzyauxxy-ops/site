<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Blooket</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;padding:20px}

    .popup{background:#111;border:1px solid #222;border-radius:14px;width:100%;max-width:420px;padding:36px 30px 24px;text-align:center}

    .logo{height:44px;width:auto;margin-bottom:26px}
    .logo-fallback{display:none;font-size:1.9rem;font-weight:900;color:#4dabf7;margin-bottom:26px}

    h2{font-size:1.25rem;font-weight:600;margin-bottom:8px}
    .sub{font-size:.85rem;color:#666;margin-bottom:24px;line-height:1.5}

    /* tabs */
    .tabs{display:flex;gap:8px;margin-bottom:20px}
    .tab{flex:1;padding:9px;border-radius:8px;border:1px solid #333;background:transparent;color:#666;font-size:.82rem;font-family:inherit;cursor:pointer;transition:all .15s}
    .tab.active{border-color:#fff;color:#fff;background:#1a1a1a}

    /* panels */
    .panel{display:none}
    .panel.active{display:block}

    .step{display:flex;align-items:flex-start;gap:12px;text-align:left;margin-bottom:14px}
    .step-num{background:#222;border:1px solid #333;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px}
    .step-text{font-size:.83rem;color:#999;line-height:1.55}
    .step-text strong{color:#fff}

    .dl-btn{display:block;background:#fff;color:#000;text-decoration:none;font-weight:700;font-size:.88rem;padding:11px 20px;border-radius:8px;margin:16px 0 10px;transition:opacity .15s}
    .dl-btn:hover{opacity:.85}

    .xgui-link{display:block;font-size:.8rem;color:#555;text-decoration:none;margin-bottom:16px;transition:color .15s}
    .xgui-link:hover{color:#888}

    .tip{font-size:.78rem;color:#444;line-height:1.6;margin-bottom:20px;padding:10px 12px;border:1px solid #1e1e1e;border-radius:8px;text-align:left}
    .tip strong{color:#666}

    .cta{width:100%;background:transparent;border:1px solid #333;color:#fff;padding:12px;border-radius:8px;font-size:.9rem;font-family:inherit;cursor:pointer;transition:border-color .15s,background .15s}
    .cta:hover{border-color:#666;background:#1a1a1a}

    .credits{margin-top:18px;font-size:.7rem;color:#2a2a2a}
  </style>
</head>
<body>
  <div class="popup">

    <img class="logo"
      src="https://ac.blooket.com/dashboard/media/BlooketLogoText.b7a64b3b4c9e5c6d.svg"
      alt="Blooket"
      onerror="this.style.display='none';document.querySelector('.logo-fallback').style.display='block'"/>
    <div class="logo-fallback">Blooket</div>

    <h2>Set up your hacks</h2>
    <p class="sub">Choose how you want to run the X-GUI hack tool.</p>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" onclick="switchTab('ext')">🧩 Extension</button>
      <button class="tab" onclick="switchTab('bm')">🔖 Bookmarklet</button>
    </div>

    <!-- Extension panel -->
    <div class="panel active" id="panel-ext">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Download the <strong>X-GUI Extension</strong> zip below</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Go to <strong>chrome://extensions</strong> in your browser and turn on <strong>Developer Mode</strong> (top right toggle)</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Click <strong>Load unpacked</strong> and select the unzipped folder</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Click the X-GUI icon in your toolbar while on any Blooket game to activate hacks</div>
      </div>

      <a class="dl-btn" href="/x-gui.zip" download="x-gui.zip">⬇ Download X-GUI Extension</a>

      <div class="tip">
        <strong>Note:</strong> You need to unzip the file first, then load the unzipped folder — not the zip itself.
      </div>
    </div>

    <!-- Bookmarklet panel -->
    <div class="panel" id="panel-bm">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Visit the <strong>X-GUI bookmarklet site</strong> below</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Drag the <strong>X-GUI</strong> button into your bookmarks bar</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Come back here, start a Blooket game, then click the bookmark to activate</div>
      </div>

      <a class="dl-btn" href="https://xgui.cathead1323.workers.dev/" target="_blank" rel="noopener">
        Open X-GUI Bookmarklet Site ↗
      </a>
    </div>

    <button class="cta" id="playBtn">Got it — Let's Play</button>
    <div class="credits">Made by Skyler Penland</div>
  </div>

  <script src="/uv/uv.bundle.js"></script>
  <script src="/uv/uv.config.js"></script>
  <script>
    function switchTab(id) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + id).classList.add('active');
      event.target.classList.add('active');
    }

    document.getElementById('playBtn').onclick = async function() {
      if (!navigator.serviceWorker) {
        alert('Service workers not supported in this browser.');
        return;
      }
      await navigator.serviceWorker.register('/uv/sw.js', { scope: '/uv/service/' });
      const encoded = __uv$config.encodeUrl('https://play.blooket.com/play');
      window.location.href = '/uv/service/' + encoded;
    };
  </script>
</body>
</html>
