import { useNavigate } from 'react-router-dom';
import { BookOpen, MessageCircle, Clock, Hash, FileText, ChevronRight } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { MOCK_EVALUATION } from '../lib/mockData';
import type { FindingCategory, Finding } from '../contracts/dto';

const CATEGORY_CONFIG: Record<FindingCategory, {
  label: string; color: string; bg: string; border: string; chipBg: string; chipColor: string; icon: string;
}> = {
  BENAR:         { label: 'BENAR',         color: '#16A34A', bg: '#FFFFFF', border: '#16A34A', chipBg: '#DCFCE7', chipColor: '#16A34A', icon: '✓' },
  KELIRU:        { label: 'KELIRU',        color: '#DC2626', bg: '#FFFFFF', border: '#DC2626', chipBg: '#FEE2E2', chipColor: '#DC2626', icon: '✕' },
  TERLEWAT:      { label: 'TERLEWAT',      color: '#D97706', bg: '#FFFFFF', border: '#D97706', chipBg: '#FEF3C7', chipColor: '#D97706', icon: '○' },
  MEMBINGUNGKAN: { label: 'MEMBINGUNGKAN', color: '#4F46E5', bg: '#FFFFFF', border: '#4F46E5', chipBg: '#EEF2FF', chipColor: '#4F46E5', icon: '−' },
};

function scoreLabel(score: number) {
  if (score >= 90) return 'Luar Biasa';
  if (score >= 75) return 'Cukup Baik';
  if (score >= 60) return 'Perlu Latihan';
  return 'Terus Belajar';
}

function FindingCard({ category, findings }: { category: FindingCategory; findings: Finding[] }) {
  const cfg = CATEGORY_CONFIG[category];
  const concepts = findings.filter(f => f.category === category);
  if (!concepts.length) return null;
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: cfg.bg, border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Top accent line */}
      <div className="h-1" style={{ background: cfg.color }} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: cfg.color }}
          >
            {cfg.icon}
          </div>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {concepts.map((f, i) => (
            <span
              key={i}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: cfg.chipBg, color: cfg.chipColor, border: `1px solid ${cfg.chipBg}` }}
            >
              {f.concept}
            </span>
          ))}
        </div>
        <button className="text-xs font-semibold" style={{ color: cfg.color }}>
          lihat detail →
        </button>
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const navigate = useNavigate();
  const { evaluationResult, topicTitle, turnCount, reset } = useSessionStore();
  const result = evaluationResult ?? MOCK_EVALUATION;

  const handleNewSession = () => {
    reset();
    navigate('/setup');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Minimal top nav */}
      <div className="bg-white border-b sticky top-0 z-30" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-3xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
              <BookOpen size={12} color="white" />
            </div>
            <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Cogniva</span>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {['1. Login','2. Dashboard','3. Setup Sesi','4. Sesi Mengajar'].map(s => (
              <span key={s}>{s}</span>
            ))}
            <span className="font-semibold px-3 py-1 rounded-full text-white" style={{ background: 'var(--accent-primary)' }}>5. Evaluasi</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Hero result card */}
        <div className="rounded-2xl p-7" style={{ background: 'var(--accent-primary-dim)' }}>
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex-1">
              <h1 className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--text-primary)' }}>
                Sesi selesai! 🎉
              </h1>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                {topicTitle || 'Hukum Newton'} · {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <div className="flex items-end gap-2 mb-1">
                <span className="font-display font-black text-7xl" style={{ color: 'var(--text-primary)', lineHeight: 1 }}>
                  {result.score}
                </span>
                <span className="text-2xl font-medium mb-2" style={{ color: 'var(--text-muted)' }}>/100</span>
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
                SKOR KESELURUHAN
              </p>
              <span
                className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                style={{ background: 'var(--accent-primary)' }}
              >
                {scoreLabel(result.score)}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-primary)' }}>
                {result.summary}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {[
                  { icon: <MessageCircle size={13} />, label: `${turnCount || 5} giliran mengajar` },
                  { icon: <Clock size={13} />, label: '12 menit' },
                  { icon: <Hash size={13} />, label: `${result.findings.filter(f=>f.category==='BENAR').length + result.findings.filter(f=>f.category==='TERLEWAT').length} konsep dibahas` },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{ background: 'white', color: 'var(--text-secondary)' }}
                  >
                    {stat.icon} {stat.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Findings grid */}
        <div>
          <h2 className="font-display font-bold text-xl mb-4" style={{ color: 'var(--text-primary)' }}>
            Temuan Reka
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['BENAR','KELIRU','TERLEWAT','MEMBINGUNGKAN'] as FindingCategory[]).map(cat => (
              <FindingCard key={cat} category={cat} findings={result.findings} />
            ))}
          </div>
        </div>

        {/* Strengths + Improvements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            className="p-5 rounded-2xl"
            style={{ background: 'white', border: '1px solid var(--border)' }}
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              👍 Yang sudah bagus
            </h3>
            <ul className="space-y-3">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: '#16A34A' }}>✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div
            className="p-5 rounded-2xl"
            style={{ background: 'white', border: '1px solid var(--border)' }}
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              🎯 Yang bisa ditingkatkan
            </h3>
            <ul className="space-y-3">
              {result.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronRight size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="sticky bottom-0 bg-white border-t py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FileText size={15} /> Lihat Transkrip Sesi
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              Kembali ke Dashboard
            </button>
            <button
              onClick={handleNewSession}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--accent-primary)' }}
            >
              Mulai Sesi Baru 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
