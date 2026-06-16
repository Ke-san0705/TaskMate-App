import { useEffect, useRef } from 'react';

export default function useClickThrough(enabled) {
  const lastIgnored = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function updateClickThrough(event) {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const interactive = Boolean(element?.closest('[data-interactive="true"]'));
      const shouldIgnore = !interactive;
      if (lastIgnored.current !== shouldIgnore) {
        lastIgnored.current = shouldIgnore;
        window.taskMate.setClickThrough(shouldIgnore);
      }
    }

    function ignoreOutside() {
      if (lastIgnored.current !== true) {
        lastIgnored.current = true;
        window.taskMate.setClickThrough(true);
      }
    }

    window.addEventListener('pointermove', updateClickThrough);
    window.addEventListener('blur', ignoreOutside);
    return () => {
      window.removeEventListener('pointermove', updateClickThrough);
      window.removeEventListener('blur', ignoreOutside);
      window.taskMate.setClickThrough(false);
    };
  }, [enabled]);
}
