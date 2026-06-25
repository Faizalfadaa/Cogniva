import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, FileText, Link, PenLine, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { MOCK_TOPICS } from '../lib/mockData';
import type { Difficulty } from '../contracts/dto';
import { useSessionStore } from '../store/sessionStore';

type Intent = 'exam' | 'new' | 'review';

function DiffBadge({ d }: { d: Difficulty }) {
  const map = {
    dasar:    { label: 'Mudah',   bg: '#F0FDF4', color: '#16A34A' },
    menengah: { label: 'Sedang',  bg: '#F5F3FF', color: '#7C3AED' },
    lanjut:   { label: 'Sulit',   bg: '#1A1A2E', color: '#FFFFFF' },
  };
  const s = map[d];
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Step indicator ──────────────────────────────────────────────────────────
function StepBar({ step, onBack }: { step: number; onBack: () => void }) {
  const steps = ['Nama & Tujuan', 'Pilih Topik', 'Materi'];
  return (
    <div className="sticky top-0 z-30 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
            <BookOpen size={14} color="white" />
          </div>
          <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Cogniva</span>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const active = i + 1 === step;
            const done = i + 1 < step;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px" style={{ background: done ? 'var(--accent-primary)' : 'var(--border)' }} />}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={active
                      ? { background: 'var(--accent-primary)', color: 'white' }
                      : done
                      ? { background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)' }
                      : { background: 'var(--bg-base)', color: 'var(--text-muted)' }
                    }
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  <span
                    className="text-sm font-medium hidden sm:block"
                    style={{ color: active ? 'var(--text-primary)' : done ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                  >
                    {s}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={15} /> Kembali
        </button>
      </div>
    </div>
  );
}

// ── Step 1: Nama & Tujuan ──────────────────────────────────────────────────
function Step1({ onNext }: { onNext: (name: string, goal: string, intent: Intent) => void }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);

  const intents: { id: Intent; label: string }[] = [
    { id: 'exam', label: 'Persiapan ujian 🎯' },
    { id: 'new', label: 'Belajar topik baru 🌱' },
    { id: 'review', label: 'Mengulang materi 🔁' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-4xl mb-2" style={{ color: 'var(--text-primary)' }}>
        Apa yang ingin kamu<br />kuasai hari ini?
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>
        Beri nama sesimu dan tentukan tujuan belajar
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Nama Sesi</label>
          <input
            type="text"
            placeholder="mis. Belajar Hukum Newton untuk UAS"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{ background: 'white', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Apa tujuan belajarmu?</label>
          <textarea
            placeholder="Aku ingin memahami bagaimana gaya bekerja pada benda..."
            value={goal}
            onChange={e => setGoal(e.target.value.slice(0, 300))}
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-all"
            style={{ background: 'white', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <div className="text-right text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{goal.length}/300</div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Niat belajar kali ini</label>
          <div className="flex gap-3 flex-wrap">
            {intents.map(it => (
              <button
                key={it.id}
                onClick={() => setIntent(it.id)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={intent === it.id
                  ? { background: 'var(--accent-primary)', color: 'white' }
                  : { background: 'white', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }
                }
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-10">
        <button
          onClick={() => onNext(name, goal, intent ?? 'new')}
          disabled={!name.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-primary)' }}
        >
          Lanjut <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Pilih Topik ────────────────────────────────────────────────────
function Step2({ onNext }: { onNext: (topicId: string, topicTitle: string) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = MOCK_TOPICS.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-4xl mb-2" style={{ color: 'var(--text-primary)' }}>
        Pilih topik yang ingin<br />diajarkan
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Pilih satu topik untuk sesi ini</p>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Cari topik..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none"
          style={{ background: 'white', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {filtered.map(t => (
          <div
            key={t.topicId}
            onClick={() => setSelected(t.topicId)}
            className="p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5"
            style={{
              background: 'white',
              border: selected === t.topicId ? '2px solid var(--accent-primary)' : '1.5px solid var(--border)',
              boxShadow: selected === t.topicId ? '0 0 0 3px var(--accent-primary-dim)' : 'none',
            }}
          >
            <div className="text-2xl mb-2">{t.icon}</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t.description}</p>
            <div className="flex items-center gap-2">
              <DiffBadge d={t.difficulty} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>~{t.estimatedTurns}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 items-center">
          {[0,1,2].map(i => (
            <div key={i} className="h-1.5 w-8 rounded-full" style={{ background: i === 1 ? 'var(--accent-primary)' : 'var(--border)' }} />
          ))}
          <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>Langkah 2 dari 3</span>
        </div>
        <button
          onClick={() => {
            const t = MOCK_TOPICS.find(t => t.topicId === selected);
            if (t) onNext(t.topicId, t.title);
          }}
          disabled={!selected}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent-primary)' }}
        >
          Lanjut <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Materi Referensi ────────────────────────────────────────────────
function Step3({ onStart }: { onStart: () => void }) {
  const [tags, setTags] = useState<string[]>(['Gaya dan Gerak', 'Hukum Aksi-Reaksi']);
  const [tagInput, setTagInput] = useState('');
  const [activeSource, setActiveSource] = useState<'file' | 'link' | 'text' | null>(null);

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));
  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  };

  const sources = [
    { id: 'file' as const, icon: <FileText size={28} />, label: 'Upload File', sub: 'PDF, TXT, DOCX' },
    { id: 'link' as const, icon: <Link size={28} />, label: 'Paste Link', sub: 'URL artikel / video' },
    { id: 'text' as const, icon: <PenLine size={28} />, label: 'Tulis Langsung', sub: 'Ketik atau paste teks' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display font-bold text-4xl mb-1" style={{ color: 'var(--text-primary)' }}>
        Berikan materi referensi{' '}
        <span className="font-normal text-2xl" style={{ color: 'var(--text-muted)' }}>(opsional)</span>
      </h1>
      <p className="text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>
        Bantu Reka memahami konteks yang kamu ajarkan
      </p>

      <div className="grid grid-cols-3 gap-4 mb-10">
        {sources.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSource(activeSource === s.id ? null : s.id)}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl transition-all hover:-translate-y-0.5"
            style={{
              background: 'white',
              border: activeSource === s.id ? '2px solid var(--accent-primary)' : '1.5px solid var(--border)',
              boxShadow: activeSource === s.id ? '0 0 0 3px var(--accent-primary-dim)' : 'none',
              color: activeSource === s.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            {s.icon}
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Concepts tag input */}
      <div className="mb-10">
        <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Konsep kunci yang ingin diajarkan
        </label>
        <div
          className="flex flex-wrap gap-2 p-3 rounded-xl"
          style={{ background: 'white', border: '1.5px solid var(--border)' }}
        >
          {tags.map(t => (
            <span
              key={t}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
              style={{ background: 'var(--accent-primary)' }}
            >
              {t}
              <button onClick={() => removeTag(t)} className="hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder="Tambah konsep..."
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag}
            className="flex-1 min-w-32 outline-none text-sm bg-transparent"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 items-center">
          {[0,1,2].map(i => (
            <div key={i} className="h-1.5 w-8 rounded-full" style={{ background: i === 2 ? 'var(--accent-primary)' : 'var(--border)' }} />
          ))}
          <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>Langkah 3 dari 3</span>
        </div>
        <button
          onClick={onStart}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: 'var(--accent-primary)' }}
        >
          Mulai Mengajar →
        </button>
      </div>
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────
export default function SetupPage() {
  const navigate = useNavigate();
  const { setSession } = useSessionStore();
  const [step, setStep] = useState(1);
  const [topicId, setTopicId] = useState('');
  const [topicTitle, setTopicTitle] = useState('');

  const handleBack = () => {
    if (step === 1) navigate('/dashboard');
    else setStep(s => s - 1);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <StepBar step={step} onBack={handleBack} />
      {step === 1 && (
        <Step1 onNext={(_name, _goal, _intent) => setStep(2)} />
      )}
      {step === 2 && (
        <Step2 onNext={(tid, tTitle) => {
          setTopicId(tid);
          setTopicTitle(tTitle);
          setStep(3);
        }} />
      )}
      {step === 3 && (
        <Step3 onStart={() => {
          setSession(`ses_${Date.now()}`, topicId, topicTitle);
          navigate('/teaching');
        }} />
      )}
    </div>
  );
}
