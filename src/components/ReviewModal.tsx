import React, { useState } from 'react';
import { X, Star, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { Booking } from '../types';
import { useTranslation } from '../i18n/LanguageContext';

interface ReviewModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ booking, onClose, onSuccess }) => {
  const { t, lang } = useTranslation();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Please enter a review');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createReview({
        booking_id: booking.id,
        rating,
        comment: comment.trim(),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabelsUz: Record<number, string> = {
    5: 'A’lo darajada (5/5)',
    4: 'Yaxshi (4/5)',
    3: 'Qoniqarli (3/5)',
    2: 'Yomon (2/5)',
    1: 'Juda yomon (1/5)'
  };
  const ratingLabelsRu: Record<number, string> = {
    5: 'Отлично (5/5)',
    4: 'Хорошо (4/5)',
    3: 'Удовлетворительно (3/5)',
    2: 'Плохо (2/5)',
    1: 'Очень плохо (1/5)'
  };
  const ratingLabelsEn: Record<number, string> = {
    5: 'Excellent (5/5)',
    4: 'Good (4/5)',
    3: 'Satisfactory (3/5)',
    2: 'Poor (2/5)',
    1: 'Very poor (1/5)'
  };

  const labels = lang === 'ru' ? ratingLabelsRu : lang === 'en' ? ratingLabelsEn : ratingLabelsUz;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6">
        <button
          id="close-review-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-slate-900">{t('leave_review')}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {booking.business_name} • {booking.service_name}
        </p>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  id={`star-btn-${star}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition focus:outline-none cursor-pointer"
                >
                  <Star
                    className={`w-8 h-8 transition ${
                      (hoverRating || rating) >= star
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {labels[rating]}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {t('reviews_title')}
            </label>
            <textarea
              id="review-comment-textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="..."
              required
              className="w-full text-xs border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            id="submit-review-btn"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-xl transition shadow-sm cursor-pointer"
          >
            {submitting ? t('loading') : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
};
