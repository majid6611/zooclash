import { useState } from 'react';
import { ANIMAL_EMOJI } from '../pages/MatchPage.jsx';

export default function CardArranger({ animals, onSubmit, label }) {
  const [slots,      setSlots]      = useState([...animals]);
  const [dragging,   setDragging]   = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function swap(i, j) {
    const next = [...slots];
    [next[i], next[j]] = [next[j], next[i]];
    setSlots(next);
  }

  async function submit() {
    setSubmitting(true);
    try {
      await onSubmit(slots);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-arranger">
      <div className="cards-row">
        {slots.map((animal, i) => (
          <div
            key={`${animal}-${i}`}
            className={`animal-card${dragging === i ? ' dragging' : ''}`}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { swap(dragging, i); setDragging(null); }}
          >
            <div className="card-pos">{i + 1}</div>
            <div className="card-emoji">{ANIMAL_EMOJI[animal]}</div>
            <div className="card-name">{animal}</div>
            <div className="card-arrows">
              <button onClick={() => i > 0 && swap(i, i - 1)} disabled={i === 0}>◀</button>
              <button onClick={() => i < slots.length - 1 && swap(i, i + 1)} disabled={i === slots.length - 1}>▶</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={submit} disabled={submitting}>
        {submitting ? 'Submitting…' : label}
      </button>
    </div>
  );
}
