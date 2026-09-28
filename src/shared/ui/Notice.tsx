/** Уведомление над чертежом (открытие и сохранение файлов). */
export interface NoticeData {
  text: string;
  tone: 'ok' | 'bad';
  seq: number;
}

export function Notice({ notice, onClose }: { notice: NoticeData | null; onClose: () => void }) {
  if (!notice) return null;
  return (
    <div className={`notice ${notice.tone === 'bad' ? 'n-bad' : 'n-ok'}`} role={notice.tone === 'bad' ? 'alert' : 'status'} key={notice.seq}>
      <span>{notice.text}</span>
      <button type="button" className="del" aria-label="Закрыть уведомление" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
