import { useEffect, useRef } from 'react';

const INTERACTIVE_CLICK_GRACE_MS = 420;

export default function useClickThrough(enabled) {
  const lastIgnored = useRef(null);
  const pointerDown = useRef(false);
  const releaseTimer = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function clearReleaseTimer() {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }

    function setIgnored(shouldIgnore) {
      if (lastIgnored.current !== shouldIgnore) {
        lastIgnored.current = shouldIgnore;
        window.taskMate.setClickThrough(shouldIgnore);
      }
    }

    function isInteractiveEvent(event) {
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
        return false;
      }
      const element = document.elementFromPoint(event.clientX, event.clientY);
      return Boolean(element?.closest('[data-interactive="true"]'));
    }

    function updateClickThrough(event) {
      if (event.type === 'pointermove' || event.type === 'mousemove') {
        clearReleaseTimer();
      }
      if (pointerDown.current || event.buttons !== 0) {
        setIgnored(false);
        return true;
      }
      const interactive = isInteractiveEvent(event);
      setIgnored(!interactive);
      return interactive;
    }

    function handlePointerDown(event) {
      clearReleaseTimer();
      const interactive = isInteractiveEvent(event);
      pointerDown.current = interactive;
      if (interactive) {
        setIgnored(false);
      }
    }

    function handlePointerEnd(event) {
      const wasInteractive = pointerDown.current || isInteractiveEvent(event);
      pointerDown.current = false;
      if (!wasInteractive) {
        requestAnimationFrame(() => updateClickThrough(event));
        return;
      }

      // クリック直後に透過へ戻すと、Windows/Electronのダブルクリック判定中に
      // 2回目のクリックだけ背面へ抜けることがあります。少しだけ非透過を保ち、
      // 連続クリックがキャラクターへ届く状態を優先します。
      const nextEvent = {
        clientX: event.clientX,
        clientY: event.clientY,
        buttons: 0
      };
      setIgnored(false);
      clearReleaseTimer();
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = null;
        if (!pointerDown.current) {
          updateClickThrough(nextEvent);
        }
      }, INTERACTIVE_CLICK_GRACE_MS);
    }

    function ignoreOutside() {
      clearReleaseTimer();
      if (pointerDown.current) {
        setIgnored(false);
        return;
      }
      setIgnored(true);
    }

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointerup', handlePointerEnd, true);
    window.addEventListener('pointercancel', handlePointerEnd, true);
    window.addEventListener('pointermove', updateClickThrough);
    window.addEventListener('mousemove', updateClickThrough);
    window.addEventListener('mouseleave', ignoreOutside);
    window.addEventListener('blur', ignoreOutside);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', handlePointerEnd, true);
      window.removeEventListener('pointercancel', handlePointerEnd, true);
      window.removeEventListener('pointermove', updateClickThrough);
      window.removeEventListener('mousemove', updateClickThrough);
      window.removeEventListener('mouseleave', ignoreOutside);
      window.removeEventListener('blur', ignoreOutside);
      clearReleaseTimer();
      window.taskMate.setClickThrough(false);
    };
  }, [enabled]);
}
