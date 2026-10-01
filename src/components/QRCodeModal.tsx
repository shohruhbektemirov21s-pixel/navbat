import React, { useEffect, useState } from 'react';
import { X, Download, QrCode, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { BusinessItem } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useTimedState } from '../hooks/useTimedState';

interface QRCodeModalProps {
  business: BusinessItem;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ business, onClose }) => {
  useEscapeKey(onClose);
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, showCopied] = useTimedState<boolean>(2000);

  // Generate URL for booking
  const bookingUrl = `${window.location.origin}/#business/${business.slug}`;

  useEffect(() => {
    QRCode.toDataURL(bookingUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation failed:', err));
  }, [bookingUrl]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(bookingUrl).catch(() => {});
    showCopied(true);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `navbatbor-qr-${business.slug}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 text-center">
        <button aria-label="Yopish"
          id="close-qr-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2 text-blue-600">
          <QrCode className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">{t('qr_code')}</span>
        </div>

        <h3 className="text-lg font-bold text-slate-900">{business.name}</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          QR-kod
        </p>

        {/* QR image */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mb-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="NavbatBor QR Code" className="w-56 h-56 mx-auto rounded-lg shadow-xs" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
              {t('loading')}
            </div>
          )}
        </div>

        {/* URL box with copy */}
        <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 mb-4">
          <span className="truncate flex-1 font-mono text-[11px] text-left">{bookingUrl}</span>
          <button
            id="qr-copy-url-btn"
            onClick={handleCopy}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs transition shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Download Button */}
        <button
          id="qr-download-btn"
          onClick={handleDownload}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>PNG (Download)</span>
        </button>
      </div>
    </div>
  );
};
