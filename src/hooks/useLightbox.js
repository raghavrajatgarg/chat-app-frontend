import { useEffect, useState } from 'react';

export default function useLightbox() {
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActiveLightboxImage(null);
    };

    if (activeLightboxImage) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxImage]);

  const closeLightbox = () => {
    setActiveLightboxImage(null);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const nextScale = Math.min(Math.max(scale + (event.deltaY < 0 ? 0.1 : -0.1), 1), 4);
    if (nextScale === 1) setPosition({ x: 0, y: 0 });
    setScale(nextScale);
  };

  const handleMouseDown = (event) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y });
    }
  };

  const handleMouseMove = (event) => {
    if (isDragging && scale > 1) {
      setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
    }
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  return {
    activeLightboxImage,
    setActiveLightboxImage,
    scale,
    position,
    isDragging,
    closeLightbox,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp: () => setIsDragging(false),
    handleDoubleClick,
  };
}