(() => {
  const boot = document.getElementById('bootOverlay');
  const flash = document.getElementById('levelFlash');
  const levelEl = document.getElementById('levelNumber');
  let previousLevel = Number(levelEl?.textContent || 1);

  window.addEventListener('load', () => {
    window.setTimeout(() => boot?.classList.add('hide'), 1050);
  });

  if (levelEl && flash) {
    const observer = new MutationObserver(() => {
      const nextLevel = Number(levelEl.textContent || previousLevel);
      if (nextLevel > previousLevel) {
        flash.querySelector('strong').textContent = `LEVEL ${nextLevel}`;
        flash.classList.remove('show');
        void flash.offsetWidth;
        flash.classList.add('show');
        if (navigator.vibrate) navigator.vibrate([80,50,80,50,180]);
      }
      previousLevel = nextLevel;
    });
    observer.observe(levelEl, { childList: true, characterData: true, subtree: true });
  }

  // V3 focus reward safety fix: verify that CLAIM REWARD actually adds
  // the completed timer minutes as XP, without double-awarding when the
  // original app.js handler already worked.
  const claimButton = document.getElementById('continueMission');
  if (claimButton) {
    claimButton.addEventListener('click', () => {
      const xpBefore = Number(state?.xp || 0);
      const pendingBefore = Number(rewardPending || 0);

      if (pendingBefore <= 0) return;

      queueMicrotask(() => {
        const xpAfter = Number(state?.xp || 0);
        if (xpAfter >= xpBefore + pendingBefore) return;

        addXp(pendingBefore);
        rewardPending = 0;
        toast(`+${pendingBefore} XP · Focus mission cleared`);
      });
    }, true);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sessionStorage.getItem('nekorin-reloaded')) {
        sessionStorage.setItem('nekorin-reloaded', '1');
        location.reload();
      }
    });
  }
})();
