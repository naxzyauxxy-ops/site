<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Blooket</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
    .popup{background:#111;border:1px solid #222;border-radius:14px;width:90%;max-width:400px;padding:40px 32px 28px;text-align:center}
    .logo{height:48px;width:auto;margin-bottom:28px}
    h2{font-size:1.35rem;font-weight:600;margin-bottom:10px}
    p{font-size:.9rem;color:#888;line-height:1.6;margin-bottom:24px}
    .link-btn{display:block;background:#fff;color:#000;text-decoration:none;font-weight:600;font-size:.9rem;padding:12px 20px;border-radius:8px;margin-bottom:12px;transition:opacity .15s}
    .link-btn:hover{opacity:.85}
    .tip{font-size:.8rem;color:#555;line-height:1.6;margin-bottom:24px}
    .cta{width:100%;background:transparent;border:1px solid #333;color:#fff;padding:12px;border-radius:8px;font-size:.9rem;font-family:inherit;cursor:pointer;transition:border-color .15s,background .15s}
    .cta:hover{border-color:#666;background:#1a1a1a}
    .credits{margin-top:20px;font-size:.72rem;color:#333}
  </style>
</head>
<body>
  <div class="popup">
    <img class="logo" src="https://ac.blooket.com/dashboard/media/BlooketLogoText.b7a64b3b4c9e5c6d.svg" alt="Blooket"
      onerror="this.style.display='none';document.getElementById('lt').style.display='block'"/>
    <div id="lt" style="display:none;font-size:2rem;font-weight:900;color:#4dabf7;margin-bottom:28px">Blooket</div>
    <h2>Get the Hacks</h2>
    <p>Visit the link below to grab the X-GUI hack tool, add it to your bookmarks, and you're good to go!</p>
    <a class="link-btn" href="https://xgui.cathead1323.workers.dev/" target="_blank" rel="noopener">xgui.cathead1323.workers.dev ↗</a>
    <div class="tip">Open the link → drag the X-GUI button to your bookmarks bar → come back, start a game, and click it to activate.</div>
    <button class="cta" id="playBtn">Got it — Let's Play</button>
    <div class="credits">Made by Skyler Penland</div>
  </div>

  <script src="/uv/uv.bundle.js"></script>
  <script src="/uv/uv.config.js"></script>
  <script>
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
