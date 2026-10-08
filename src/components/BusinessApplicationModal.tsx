import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Clock3, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import { api } from '../api';
import { Category, City, User } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  user: User;
  categories: Category[];
  cities: City[];
  onClose: () => void;
}
const weekdays = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

export function BusinessApplicationModal({ user, categories, cities, onClose }: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [previous, setPrevious] = useState<Awaited<ReturnType<typeof api.getMyBusinessApplications>>>([]);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  useEscapeKey(() => { if (!busy) onClose(); });

  useEffect(() => {
    let active = true;
    api.getMyBusinessApplications().then((items) => { if (active) setPrevious(items); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Arizalarni yuklab bo‘lmadi.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; focused?.focus(); };
  }, []);

  const pending = previous.find((application) => application.status === 'PENDING');
  const success = submitted || Boolean(pending);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!days.length) { setError('Kamida bitta ish kunini tanlang.'); return; }
    if (!photos.length) { setError('Biznesingizning kamida bitta rasmini qo‘shing.'); return; }
    const data = new FormData(event.currentTarget);
    days.forEach((day) => data.append('working_days', String(day)));
    photos.forEach((file) => data.append('photos', file));
    setBusy(true);
    try { await api.submitBusinessApplication(data); setSubmitted(true); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Arizani yuborib bo‘lmadi. Qayta urinib ko‘ring.'); }
    finally { setBusy(false); }
  }
  function selectPhotos(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.length > 6 || selected.some((file) => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('6 tagacha JPG, PNG yoki WebP rasm tanlang. Har biri 5 MB dan kichik bo‘lsin.');
      return;
    }
    setPhotos(selected); setError('');
  }
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6" onClick={() => { if (!busy) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="application-title" tabIndex={-1}
        className="application-dialog bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] flex flex-col outline-none"
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []);
          const first = controls[0], last = controls[controls.length - 1];
          if (document.activeElement === dialog.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
          else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Building2 size={22} /></span>
            <div><h2 id="application-title" className="text-lg font-bold text-slate-950">Biznesingizni qo‘shing</h2><p className="text-sm text-slate-500 mt-0.5">Yangi mijozlar sari birinchi qadam</p></div>
          </div>
          <button type="button" aria-label="Yopish" disabled={busy} onClick={onClose} className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
          {loading ? <div role="status" className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /><span className="sr-only">Yuklanmoqda</span></div> : success ? (
            <div className="text-center py-8" role="status">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={32} /></div>
              <h3 className="text-2xl font-bold mt-5">Arizangiz qabul qilindi</h3>
              <p className="text-slate-500 leading-relaxed max-w-sm mx-auto mt-3">Sayt egasi ma’lumotlarni tekshiradi. Tasdiqlangach, biznesingiz katalogda ko‘rinadi va boshqaruv paneli ochiladi.</p>
              <div className="flex justify-center gap-2 text-amber-700 bg-amber-50 rounded-xl p-3 mt-6"><Clock3 size={20} /> Ko‘rib chiqilmoqda</div>
              <button onClick={onClose} className="primary-button w-full mt-6">Tushunarli</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="shrink-0 mt-0.5" size={20} /><p>Biznesingiz faqat tekshiruvdan keyin e’lon qilinadi. Ma’lumotlarni to‘g‘ri va to‘liq kiriting.</p></div>
              {previous[0]?.status === 'REJECTED' && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Avvalgi ariza rad etilgan: {previous[0].rejectReason}. Ma’lumotlarni to‘g‘rilab qayta yuborishingiz mumkin.</div>}
              <fieldset disabled={busy} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="field-label sm:col-span-2">Biznes nomi<input name="name" required maxLength={255} placeholder="Masalan, Nasaf klinikasi" className="form-field" /></label>
                <label className="field-label">Faoliyat turi<select name="category" required defaultValue="" className="form-field"><option value="" disabled>Soha tanlang</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="field-label">Shahar<select name="city" required defaultValue="" className="form-field"><option value="" disabled>Shahar tanlang</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
                <label className="field-label sm:col-span-2">To‘liq manzil<input name="address" required maxLength={255} placeholder="Ko‘cha, uy raqami va mo‘ljal" className="form-field" /></label>
                <label className="field-label sm:col-span-2">Bog‘lanish uchun telefon<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required pattern="\+998[0-9]{9}" defaultValue={user.phone || '+998'} placeholder="+998901234567" className="form-field" /><span className="text-xs font-normal text-slate-500">Masalan: +998901234567</span></label>
                <label className="field-label">Ochiladi<input name="open_time" type="time" required defaultValue="09:00" className="form-field" /></label>
                <label className="field-label">Yopiladi<input name="close_time" type="time" required defaultValue="18:00" className="form-field" /></label>
                <div className="sm:col-span-2"><p className="field-label mb-2">Ish kunlari</p><div className="grid grid-cols-7 gap-1.5">{[1, 2, 3, 4, 5, 6, 0].map((day) => <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} className={`min-h-11 rounded-xl text-xs font-semibold border ${days.includes(day) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500'}`}>{weekdays[day]}</button>)}</div></div>
                <label className="field-label sm:col-span-2">Biznes haqida <span className="font-normal text-slate-500">(ixtiyoriy)</span><textarea name="description" rows={3} maxLength={5000} className="form-field resize-y" placeholder="Qanday xizmatlar ko‘rsatasiz?" /></label>
                <label className="sm:col-span-2 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 p-5 flex flex-col items-center gap-2 cursor-pointer"><Upload className="text-blue-600" /><span className="font-semibold text-sm">Biznes rasmlarini tanlang</span><span className="text-xs text-slate-500">1–6 ta rasm · har biri 5 MB gacha</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => selectPhotos(event.target.files)} className="max-w-full text-sm" /></label>
                {previews.length > 0 && <div className="sm:col-span-2 grid grid-cols-3 gap-2">{previews.map((url, index) => <div key={url} className="relative"><img src={url} alt={`Tanlangan biznes rasmi ${index + 1}`} className="h-24 w-full object-cover rounded-xl" /><button type="button" aria-label={`${index + 1}-rasmni olib tashlash`} onClick={() => setPhotos((current) => current.filter((_, item) => item !== index))} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm hover:bg-rose-50 hover:text-rose-700"><X size={18} /></button></div>)}</div>}
              </fieldset>
              {error && <div role="alert" className="flex gap-2 bg-rose-50 text-rose-800 rounded-xl p-4 text-sm"><AlertCircle className="shrink-0" size={20} />{error}</div>}
              <button type="submit" disabled={busy} className="primary-button w-full flex items-center justify-center gap-2">{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}{busy ? 'Yuborilmoqda…' : 'Arizani yuborish'}</button>
              <p className="text-xs text-center text-slate-500">Ariza holatini shu oynadan kuzatishingiz mumkin.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
