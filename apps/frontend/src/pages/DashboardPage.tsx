import { useNavigate } from 'react-router-dom';
import { BookOpen, Flame, Zap, Calendar, MessageCircle, ChevronRight, Plus } from 'lucide-react';
import { MOCK_RECENT_SESSIONS } from '../lib/mockData';
import type { Difficulty } from '../contracts/dto';

function difficultyBadge(d: Difficulty) {
  const map = {
    dasar:    { label: 'Mudah',   bg: '#F0FDF4', color: '#16A34A' },
    menengah: { label: 'Sedang',  bg: '#F5F3FF', color: '#7C3AED' },
    lanjut:   { label: 'Sulit',   bg: '#1A1A2E', color: '#FFFFFF' },
  };
  const s = map[d];
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

const NAV_ITEMS = ['Beranda', 'Sesi Saya', 'Catatan', 'Statistik'];

export default function DashboardPage() {
  const navigate = useNavigate();

  // Mini bar chart data
  const weekData = [
    { day: 'Sen', h: 30 }, { day: 'Sel', h: 45 }, { day: 'Rab', h: 25 },
    { day: 'Kam', h: 70 }, { day: 'Jum', h: 55 }, { day: 'Sab', h: 20 }, { day: 'Min', h: 90 },
  ];
  const maxH = Math.max(...weekData.map(d => d.h));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
              <BookOpen size={14} color="white" />
            </div>
            <span className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Cogniva</span>
          </div>
          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1 bg-gray-100 rounded-full px-1 py-1">
            {NAV_ITEMS.map((item, i) => (
              <button
                key={item}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={i === 0
                  ? { background: 'white', color: 'var(--text-primary)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                {item}
              </button>
            ))}
          </div>
          {/* Right */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-500 text-xs font-semibold">
              <Flame size={13} /> 5 hari
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)' }}>
              <Zap size={13} /> 1,240 XP
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: 'var(--accent-primary)' }}>
              A
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Hero greeting card */}
        <div className="rounded-2xl p-7 flex items-start justify-between" style={{ background: 'var(--accent-primary-dim)' }}>
          <div>
            <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text-primary)' }}>
              Halo, Anisa! 👋
            </h1>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Kamu sudah mengajar 3 topik minggu ini.</p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Konsistensimu luar biasa — terus ajarkan Reka dan raih pemahaman yang lebih dalam!
            </p>
            <button
              onClick={() => navigate('/setup')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--accent-primary)' }}
            >
              <Plus size={15} /> Mulai Sesi Baru
            </button>
          </div>

          {/* Mini weekly chart */}
          <div
            className="hidden md:flex flex-col p-4 rounded-xl min-w-[200px]"
            style={{ background: 'white', boxShadow: 'var(--shadow-sm)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Progres Minggu Ini</p>
            <div className="flex items-end gap-1.5 h-16">
              {weekData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${(d.h / maxH) * 52}px`,
                      background: d.day === 'Min' ? 'var(--accent-primary)' : 'var(--accent-primary-dim)',
                    }}
                  />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.day}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>15 - 21 Jun 2025</span>
              <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>15 sesi</span>
            </div>
          </div>
        </div>

        {/* Active session banner */}
        <div>
          <h2 className="font-display font-bold text-lg mb-3" style={{ color: 'var(--text-primary)' }}>Lanjutkan Sesi</h2>
          <div
            className="flex items-center gap-4 p-5 rounded-2xl"
            style={{ background: 'white', border: '1.5px solid var(--accent-primary-dim)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-primary-dim)' }}>
              <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Hukum Termodinamika</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--accent-primary)' }}>
                  Sedang Berlangsung
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Calendar size={11} /> Terakhir: 20 Jun 2025</span>
                <span className="flex items-center gap-1"><MessageCircle size={11} /> Giliran ke-3 dari estimasi 6</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--accent-primary-dim)' }}>
                <div className="h-full rounded-full" style={{ width: '50%', background: 'var(--accent-primary)' }} />
              </div>
            </div>
            <button
              onClick={() => navigate('/teaching')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'var(--accent-primary)' }}
            >
              Lanjutkan <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Recent sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Sesi Terakhir</h2>
            <button className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>Lihat semua</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MOCK_RECENT_SESSIONS.map((s) => (
              <div
                key={s.sessionId}
                className="p-4 rounded-2xl cursor-pointer transition-all hover:-translate-y-0.5"
                style={{ background: 'white', boxShadow: 'var(--shadow-sm)', border: '1px solid transparent' }}
                onClick={() => navigate('/evaluation')}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.topicTitle}</p>
                  </div>
                  {difficultyBadge(s.topicId === 't3' ? 'lanjut' : s.topicId === 't8' ? 'dasar' : 'menengah')}
                </div>
                <div className="flex items-center gap-3 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {s.createdAt}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={10} /> {s.turnCount} giliran</span>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Skor</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{s.score}/100</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--accent-primary-dim)' }}>
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: 'var(--accent-primary)' }} />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Selesai</span>
                  <button className="text-xs font-semibold" style={{ color: 'var(--accent-primary)' }}>Lihat Detail →</button>
                </div>
              </div>
            ))}

            {/* Add new */}
            <div
              className="p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5 border-2 border-dashed"
              style={{ borderColor: 'var(--border)', minHeight: 170 }}
              onClick={() => navigate('/setup')}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-primary-dim)' }}>
                <Plus size={16} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>+ Sesi Baru</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
