import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Zap, Star, BookOpen } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — dark panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[48%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0F0E1A 0%, #1A1830 60%, #0F0E1A 100%)' }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
            <BookOpen size={18} color="white" />
          </div>
          <span className="font-display font-bold text-white text-lg">Cogniva</span>
        </div>

        {/* Hero mockup */}
        <div className="relative flex-1 flex flex-col items-center justify-center -mt-8">
          {/* Fake whiteboard UI */}
          <div
            className="w-full max-w-sm rounded-2xl p-5 mb-8 relative"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex gap-3 mb-4">
              <div className="rounded-lg px-3 py-1.5 text-xs text-white font-medium" style={{ background: 'rgba(91,79,207,0.5)' }}>F = ma</div>
              <div className="flex items-center gap-1 text-white/40 text-xs">→</div>
              <div className="rounded-lg px-3 py-1.5 text-xs text-white font-medium" style={{ background: 'rgba(255,255,255,0.1)' }}>a = F/m</div>
            </div>
            <div className="h-px w-full mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--accent-primary)' }}>?</div>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <div className="rounded-lg px-2 py-1 text-xs text-white/60" style={{ background: 'rgba(255,255,255,0.06)' }}>mengajar</div>
            </div>
            {/* floating bubbles */}
            <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: '#1A1830', border: '1px solid rgba(255,255,255,0.15)' }}>?</div>
            <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-primary)', boxShadow: '0 0 12px rgba(91,79,207,0.5)' }}>
              <Zap size={12} color="white" />
            </div>
          </div>

          {/* Tagline */}
          <h1 className="font-display font-black text-white text-5xl leading-[1.05] text-center mb-3">
            Ajarkan.<br />Pahami.<br />Kuasai.
          </h1>
          <p className="text-white/40 text-sm text-center max-w-xs">
            "Cara tercepat memahami sesuatu adalah dengan mengajarkannya kepada orang lain."
          </p>
        </div>

        {/* Feature list */}
        <div className="relative flex flex-col gap-2">
          {[
            { icon: <Zap size={14} />, label: 'AI yang benar-benar belajar dari kamu' },
            { icon: <Star size={14} />, label: 'Feedback mendalam setelah sesi' },
            { icon: <BookOpen size={14} />, label: 'Belajar sambil mengajar' },
          ].map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span style={{ color: 'var(--accent-primary-light)' }}>{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
            <BookOpen size={16} color="white" />
          </div>
          <span className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Cogniva</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl hidden lg:flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
              <BookOpen size={16} color="white" />
            </div>
            <span className="hidden lg:block font-display font-bold" style={{ color: 'var(--text-primary)' }}>Cogniva</span>
          </div>

          <h2 className="font-display font-bold text-3xl mb-1" style={{ color: 'var(--text-primary)' }}>
            Selamat datang<br />kembali
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>Lanjutkan perjalanan belajarmu</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider mb-1.5 uppercase" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-base)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider mb-1.5 uppercase" style={{ color: 'var(--text-muted)' }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <button type="button" className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                  Lupa password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 mt-2 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--accent-primary)' }}
            >
              Masuk →
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>atau</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
            style={{ border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Daftar akun baru
          </button>

          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
            Dengan mendaftar kamu menyetujui{' '}
            <span className="underline cursor-pointer" style={{ color: 'var(--accent-primary)' }}>syarat layanan</span>
          </p>
        </div>
      </div>
    </div>
  );
}
