import { useState, useCallback } from 'react';

const STORAGE_KEY = 'trendstudio_free_used_v1';

export const useFreeRunGate = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  const hasUsedFree = useCallback(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }, []);

  const markFreeUsed = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  return {
    hasUsedFree,
    markFreeUsed,
    showLoginModal,
    openLoginModal,
    closeLoginModal
  };
};
