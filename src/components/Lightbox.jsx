export default function Lightbox({ image, styles, lightbox, onEdit }) {
  if (!image) return null;
  return (
    <div className={styles.lightboxOverlay} onClick={lightbox.closeLightbox} onWheel={lightbox.handleWheel}>
      <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 15, zIndex: 1e9 }} onClick={(event) => event.stopPropagation()}>
        <a href={image} download="chat-shared-image.jpg" target="_blank" rel="noopener noreferrer" className={styles.downloadBtn} style={{textDecoration:'none'}}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
</svg> Download</a>
        <button type="button" onClick={() => onEdit(image)} className={styles.editImgBtn}>
          <span className={styles.editImgBtnFlex}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
              <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
            </svg> Edit</span><span className={styles.editBtnText}>Image</span>

        </button>
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