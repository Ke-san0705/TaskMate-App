import '../styles/AmbientStateLayer.css';

export default function AmbientStateLayer({ mood, level = 0, enabled = true }) {
  if (!enabled || level <= 0) {
    return null;
  }

  return (
    <div
      className={`ambient-layer ambient-layer--${mood} ambient-layer--level-${level}`}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
