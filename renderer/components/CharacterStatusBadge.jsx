import '../styles/FocusTaskCard.css';

const MOOD_LABELS = {
  calm: '落ち着き',
  attentive: '確認',
  restless: '少し詰まり',
  anxious: '一つ選ぶ',
  overloaded: '整理中',
  clicked: '会話',
  notifying: '通知',
  relieved: '軽くなった',
  celebrating: '完了',
  reconnecting: '再会',
  focusing: '今やる'
};

export default function CharacterStatusBadge({ mood }) {
  const label = MOOD_LABELS[mood] || '状態';
  return (
    <div className={`character-status character-status--${mood}`} aria-live="polite">
      <span>{label}</span>
    </div>
  );
}
