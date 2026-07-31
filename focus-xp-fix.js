// Nekorin Quest V3 — safety fix for Focus Mission XP rewards.
// The original claim handler should award XP. This fallback verifies that it did;
// if not, it awards the pending focus reward once and saves it normally.
(() => {
  const claimButton = document.getElementById('continueMission');
  if (!claimButton) return;

  claimButton.addEventListener('click', () => {
    const xpBefore = Number(state?.xp || 0);
    const pendingBefore = Number(rewardPending || 0);

    if (pendingBefore <= 0) return;

    queueMicrotask(() => {
      const xpAfter = Number(state?.xp || 0);

      // Do nothing when the original V3 handler already awarded the reward.
      if (xpAfter >= xpBefore + pendingBefore) return;

      addXp(pendingBefore);
      rewardPending = 0;
      toast(`+${pendingBefore} XP · Focus mission cleared`);
    });
  }, true);
})();
