import { useCallback, useEffect, useState } from 'react';

const FALLBACK_SETTINGS = {
  selectedCharacter: 'Chara1',
  showCharacter: true,
  characterScale: 100,
  bubbleScale: 100,
  clickImageDuration: 2000
};

export default function useCharacter() {
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCharacter = useCallback(async (characterName) => {
    setLoading(true);
    try {
      const data = await window.taskMate.getCharacterData(characterName);
      setCharacter(data);
    } catch (error) {
      setCharacter({
        name: characterName,
        images: {},
        dialogues: {},
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    window.taskMate.getSettings().then((loadedSettings) => {
      if (mounted) {
        setSettings(loadedSettings);
        loadCharacter(loadedSettings.selectedCharacter);
      }
    });
    const unsubscribe = window.taskMate.onSettingsUpdated((nextSettings) => {
      if (!mounted) {
        return;
      }
      setSettings(nextSettings);
      loadCharacter(nextSettings.selectedCharacter);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadCharacter]);

  return { settings, character, loading };
}
