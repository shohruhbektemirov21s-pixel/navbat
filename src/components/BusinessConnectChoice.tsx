import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, Send, X } from 'lucide-react';
import { api } from '../api';
import { useEscapeKey } from '../hooks/useEscapeKey';

export function BusinessConnectChoice({ onWebsite, onClose }: { onWebsite: () => void; onClose: () => void }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);
  useEffect(() => {
    let active = true;
    api.getTelegramBusinessConnectLink().then((result) => { if (active) setLink(result.deepLink); })
      .catch(() => { if (active) setError('Botga havolani olishda xatolik. Saytda ariza yuborishingiz mumkin.'); });
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    return () => { active = false; document.body.style.overflow = overflow; focused?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-5 bg-slate-950/55 backdrop-blur-sm" onClick={onClose}>
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="business-connect-title" aria-describedby="business-connect-description" className="business-connect-dialog bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md max-h-[94dvh] overflow-y-auto overscroll-contain shadow-2xl outline-none" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('button, a[href]') || []);
      if (document.activeElement === root.current) { event.preventDefault(); (event.shiftKey ? elements[elements.length - 1] : elements[0])?.focus(); }
      else if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0]?.focus(); }
    }}>
      <div className="flex justify-between items-start"><div className="rounded-2xl p-3 bg-blue-50 text-blue-600"><Building2 size={26} /></div><button onClick={onClose} aria-label="Yopish" className="h-11 w-11 rounded-full hover:bg-slate-100 flex items-center justify-center"><X size={20} /></button></div>
      <h2 id="business-connect-title" className="text-2xl font-bold mt-5">Biznesingizni qo‘shing</h2>
      <p id="business-connect-description" className="text-sm leading-relaxed text-slate-500 mt-3">Ma’lumotlar va rasmlarni yuboring. Sayt egasi tekshirib tasdiqlagach, biznesingiz katalogda ko‘rinadi.</p>
      <ol className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">{['Ma’lumotlarni kiriting', 'Tekshiruvni kuting', 'Mijozlarni qabul qiling'].map((step, index) => <li key={step} className="flex-1 min-w-0"><span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{index + 1}</span><span className="leading-relaxed">{step}</span></li>)}</ol>
      {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="primary-button mt-6 flex justify-center items-center gap-2"><Send size={18} />Telegram orqali ariza yuborish</a> : <p role="status" className="text-sm mt-6 text-slate-500">{error || 'Bot havolasi tayyorlanmoqda…'}</p>}
      <button onClick={onWebsite} className="mt-3 w-full rounded-xl border border-slate-200 min-h-12 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50">Saytda ariza to‘ldirish<ArrowRight size={16} /></button>
      <p className="mt-5 text-center text-xs text-slate-500">Ro‘yxatdan o‘tish bepul</p>
    </div>
  </div>;
}
