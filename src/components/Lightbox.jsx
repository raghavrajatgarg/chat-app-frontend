export default function Lightbox({ image, styles, lightbox, onEdit }) {
  if (!image) return null;
  return (
    <div className={styles.lightboxOverlay} onClick={lightbox.closeLightbox} onWheel={lightbox.handleWheel}>
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 15, zIndex: 1e9 }} onClick={(event) => event.stopPropagation()}>
        <a href={image} download="chat-shared-image.jpg" target="_blank" rel="noopener noreferrer">Download</a>
        <button type="button" onClick={() => onEdit(image)}>Edit Image</button>
      </div>
      <button className={styles.lightboxCloseBtn} onClick={lightbox.closeLightbox} aria-label="Close lightbox">×</button>
      <div className={styles.lightboxContentWrapper} onClick={(event) => event.stopPropagation()} onMouseDown={lightbox.handleMouseDown}
        onMouseMove={lightbox.handleMouseMove} onMouseUp={lightbox.handleMouseUp} onMouseLeave={lightbox.handleMouseUp}
        onDoubleClick={lightbox.handleDoubleClick}>
        <img src={image} alt="Enlarged view" className={styles.lightboxImage}
          style={{ transform: `translate(${lightbox.position.x}px, ${lightbox.position.y}px) scale(${lightbox.scale})`, cursor: lightbox.scale > 1 ? (lightbox.isDragging ? 'grabbing' : 'grab') : 'zoom-in' }} draggable={false} />
      </div>
    </div>
  );
}