import { useEffect, useState } from 'react'
import { artUrl, LOADING_ART, readArtIndex, saveArtIndex } from './loadingArt'
import './arenaSlideshow.css'

export function ArenaSlideshow({ paused, reduced, visible }: { paused: boolean; reduced: boolean; visible: boolean }) {
  const [index, setIndex] = useState(readArtIndex)
  const [failedId, setFailedId] = useState('')
  const [loadedId, setLoadedId] = useState('')
  const moving = !paused && !reduced && visible
  const art = LOADING_ART[index]
  const ready = loadedId === art.id, failed = failedId === art.id

  useEffect(() => {
    saveArtIndex(index + 1)
    // Only warm the next image; never download the entire 4K collection on entry.
    const next = new Image()
    next.src = artUrl((index + 1) % LOADING_ART.length, window.innerWidth <= 640 ? '960' : '1920')
  }, [index])
  useEffect(() => {
    if (!moving || (!ready && !failed)) return
    const timer = window.setTimeout(() => setIndex(i => (i + 1) % LOADING_ART.length), 5000)
    return () => clearTimeout(timer)
  }, [index, moving, ready, failed])

  function step(direction: number) {
    setIndex(i => (i + direction + LOADING_ART.length) % LOADING_ART.length)
  }
  return <section className={`arena-slideshow ${moving ? 'is-playing' : 'is-paused'} ${reduced ? 'is-reduced' : ''}`} aria-label="Amphitheatres of the ancient world" aria-roledescription="carousel">
    <div className="arena-slideshow__scene">
      {!failed && <img key={art.id} className={`arena-slideshow__image ${ready ? 'is-ready' : ''}`} src={artUrl(index)} srcSet={`${artUrl(index, '960')} 960w, ${artUrl(index)} 1920w, ${artUrl(index, '4k')} 3840w`} sizes="(max-width: 640px) 100vw, 1050px" alt={`Cinematic artist’s impression of ${art.name}, ${art.place}`} onLoad={() => setLoadedId(art.id)} onError={() => setFailedId(art.id)} decoding="async" />}
      <div className="arena-slideshow__shade" />
      <div className="arena-slideshow__top"><span>THE ETERNAL ARENAS</span><span>{String(index + 1).padStart(2, '0')} / 10</span></div>
      <div className="arena-slideshow__title"><span>{art.place}</span><h4>{art.name}</h4><small>{failed ? 'Artwork unavailable · Your report is still loading' : 'Artist’s impression'}</small></div>
    </div>
    <div className="arena-slideshow__fact" aria-live={moving ? 'off' : 'polite'}>
      <span className="premium-eyebrow">DID YOU KNOW?</span><p>{art.fact}</p>
      <div className="arena-slideshow__footer"><a href={art.source} target="_blank" rel="noreferrer">{art.sourceName} ↗</a><div className="arena-slideshow__controls"><button type="button" aria-label="Previous arena" onClick={() => step(-1)}>←</button><button type="button" aria-label="Next arena" onClick={() => step(1)}>→</button></div></div>
    </div>
  </section>
}
