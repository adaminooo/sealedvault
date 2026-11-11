import { XIcon } from './icons';
import { useEffect, useRef, type ReactNode } from 'react';

import { t } from '../i18n';
interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Dialog; na mobilu jako spodní panel, který jde zavřít tažením dolů */
export function Modal({ title, onClose, children }: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  // tažení dolů za hlavičku (jen když je obsah odscrollovaný nahoru)
  const onTouchStart = (e: React.TouchEvent) => {
    if ((sheet.current?.scrollTop ?? 0) > 0) return;
    drag.current = { y0: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current || !sheet.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y0);
    drag.current.dy = dy;
    sheet.current.style.transform = `translateY(${dy}px)`;
    sheet.current.style.transition = 'none';
  };
  const onTouchEnd = () => {
    if (!drag.current || !sheet.current) return;
    const { dy } = drag.current;
    drag.current = null;
    sheet.current.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
    if (dy > 110) {
      sheet.current.style.transform = 'translateY(100%)';
      setTimeout(() => closeRef.current(), 180);
    } else sheet.current.style.transform = '';
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={sheet}>
        <header className="modal-head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Zavřít')}>
            <XIcon size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
