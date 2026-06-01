import { useState } from 'react';
import { EditableField } from './EditableField';

const REGION_BANNER_COLORS = { East: ['#1e3a5f','#2563eb'], West: ['#5f1e1e','#dc2626'], South: ['#1e4d2b','#16a34a'], Midwest: ['#4d3a1e','#d97706'] };
const cardStyle = { background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20 };
const btnStyle = { padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: '#6366f1', color: '#fff' };

export function MammalResearchCard({ animalName, card, isAdmin, onFieldSave, onGenerate, generating }) {
  const [imgErrors, setImgErrors] = useState({});
  const [lightbox, setLightbox]   = useState(null);
  const region = (card?.region && REGION_BANNER_COLORS[card.region]) ? card.region : 'East';
  const [bgDark, bgLight] = REGION_BANNER_COLORS[region];
  const galleryImages = card?.galleryImages || [];
  const phyloPicUrl   = card?.phyloPicUrl   || null;
  const wikiImageUrl  = card?.wikiImageUrl  || null;
  const empty = !card || Object.keys(card).length === 0;
  const handleImgError = (key) => setImgErrors(prev => ({ ...prev, [key]: true }));
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: 'relative', height: 160, borderRadius: '12px 12px 0 0', overflow: 'hidden', background: `linear-gradient(135deg,${bgDark} 0%,${bgLight} 100%)` }}>
        {phyloPicUrl && !imgErrors['phylopic'] && <img src={phyloPicUrl} alt={`${animalName} silhouette`} onError={() => handleImgError('phylopic')} style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', height: 120, opacity: 0.35, filter: 'brightness(0)', objectFit: 'contain' }} />}
        {wikiImageUrl && !imgErrors['wiki-header'] && <img src={wikiImageUrl} alt={animalName} onError={() => handleImgError('wiki-header')} style={{ position: 'absolute', left: 0, top: 0, width: '45%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,0.5) 0%,transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{region} Region · Seed #{card?.seed || ''}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', margin: 0, fontSize: 26, textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.1 }}>{animalName}</h2>
            {card?.latinName && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginTop: 3 }}>{card.latinName}</div>}
          </div>
          {isAdmin && <button onClick={() => onGenerate(animalName)} disabled={generating} style={{ ...btnStyle, opacity: generating ? 0.6 : 1 }}>{generating ? 'Generating...' : 'Regenerate'}</button>}
        </div>
      </div>
      {empty ? (
        <div style={{ ...cardStyle, borderRadius: '0 0 12px 12px', borderTop: 'none', color: '#666', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 32 }}>{isAdmin ? 'No data yet — click "Regenerate" to auto-populate.' : 'Organism facts coming soon!'}</div>
      ) : (
        <div style={{ ...cardStyle, borderRadius: '0 0 12px 12px', borderTop: 'none', borderColor: `${bgLight}44` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['Habitat','habitat'],['Diet & Hunting','diet'],['Superpower','superpower'],['Battle Strength','battleStrength']].map(([label, fld]) => (
              <div key={fld} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{label}</div>
                {isAdmin && onFieldSave ? <EditableField value={card[fld]} label={fld} onSave={v => onFieldSave(animalName, fld, v)} color="#ccc" multiline /> : <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{card[fld] || '-'}</div>}
              </div>
            ))}
            {galleryImages.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Photo Gallery</div>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                  {galleryImages.map((img, i) => !imgErrors[`gallery-${i}`] && (
                    <div key={i} style={{ flexShrink: 0, textAlign: 'center' }}>
                      <img src={img.url} alt={animalName} onError={() => handleImgError(`gallery-${i}`)} onClick={() => setLightbox({ url: img.url, source: img.source, name: animalName })} style={{ height: 160, width: 200, objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'zoom-in' }} />
                      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{img.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lightbox && (
              <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }}>
                <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                  <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
                  <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: -12, right: -12, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
            )}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Fun Facts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(card.funFacts || []).map((fact, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: bgLight, fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                    <span style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{fact}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, gridColumn: '1 / -1', flexWrap: 'wrap' }}>
              {[['Size', card.size], ['Lifespan', card.lifespan], ['Speed', card.speed]].map(([label, val]) => val && (
                <div key={label} style={{ background: `${bgLight}15`, borderRadius: 8, padding: '10px 16px', border: `1px solid ${bgLight}33`, flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#ccc' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
