import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Clock, Send, Mic, Lock, Unlock,
  Pencil, Eraser, Type, Square, Minus, RotateCcw, RotateCw, Trash2, X
} from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import type { DialogMessage, LearnerResponseType } from '../contracts/dto';

// ── Mock learner responses ─────────────────────────────────────────────────
const MOCK_RESPONSES = [
  { type: 'question' as LearnerResponseType, text: 'Hmm, aku belum paham — kalau gayanya sama besar, kenapa benda bisa bergerak?' },
  { type: 'acknowledgment' as LearnerResponseType, text: 'Oh! Jadi gaya aksi dan reaksi itu bekerja pada benda yang berbeda. Aku mengerti sekarang 💡' },
  { type: 'confusion' as LearnerResponseType, text: 'Tapi wait, gimana kalau massanya berbeda? Kecepatannya pasti beda dong...' },
  { type: 'question' as LearnerResponseType, text: 'Kalau benda di ruang hampa, apakah berlaku juga Hukum Newton?' },
  { type: 'paraphrase' as LearnerResponseType, text: 'Jadi intinya, makin besar gaya yang diberikan, makin besar percepatannya — tapi makin besar massanya, makin kecil percepatannya?' },
];

function getBubbleStyle(type: LearnerResponseType) {
  switch (type) {
    case 'question':     return { bg: '#FEF3C7', border: '#FDE68A', icon: '❓' };
    case 'confusion':    return { bg: '#FEF3C7', border: '#FDE68A', icon: '💭' };
    case 'acknowledgment': return { bg: '#ECFDF5', border: '#A7F3D0', icon: '💡' };
    case 'paraphrase':   return { bg: '#EDE9FF', border: '#C4B5FD', icon: '🔄' };
    default:             return { bg: '#F3F4F6', border: '#E5E7EB', icon: '💬' };
  }
}

// ── Simple canvas drawing ──────────────────────────────────────────────────
type Tool = 'pen' | 'eraser' | 'text' | 'rect' | 'line';
type Color = string;

interface DrawPoint { x: number; y: number; }
interface DrawStroke { tool: Tool; color: Color; width: number; points: DrawPoint[]; }

function WhiteboardCanvas({
  locked,
  onSnapshotReady,
}: {
  locked: boolean;
  onSnapshotReady: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [redoStack, setRedoStack] = useState<DrawStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const currentStroke = useRef<DrawStroke | null>(null);
  const isEmpty = strokes.length === 0;

  const COLORS = ['#000000', '#4B5563', '#6366F1', '#DC2626', '#16A34A', '#F59E0B'];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
      ctx.lineWidth = stroke.tool === 'eraser' ? 20 : stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  }, [strokes]);

  useEffect(() => { redraw(); }, [redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): DrawPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (locked) return;
    const pos = getPos(e);
    currentStroke.current = { tool, color, width: tool === 'pen' ? 2.5 : 8, points: [pos] };
    setDrawing(true);
    setRedoStack([]);
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !currentStroke.current || locked) return;
    const pos = getPos(e);
    currentStroke.current.points.push(pos);

    // Live preview
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    redraw();
    const stroke = currentStroke.current;
    if (stroke.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
      ctx.lineWidth = stroke.tool === 'eraser' ? 20 : stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = stroke.points;
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!drawing || !currentStroke.current) return;
    setStrokes(prev => [...prev, currentStroke.current!]);
    currentStroke.current = null;
    setDrawing(false);
  };

  const undo = () => {
    if (!strokes.length) return;
    setRedoStack(prev => [...prev, strokes[strokes.length - 1]]);
    setStrokes(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (!redoStack.length) return;
    setStrokes(prev => [...prev, redoStack[redoStack.length - 1]]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const clear = () => { setStrokes([]); setRedoStack([]); };

  const getSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden" style={{ background: 'white' }}>
        {/* Dot grid bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Empty state */}
        {isEmpty && !locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-base)' }}>
              <Pencil size={22} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Mulai menjelaskan di sini</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>tulis, gambar, atau buat diagram</p>
          </div>
        )}

        {locked && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(249,250,251,0.7)', backdropFilter: 'blur(2px)' }}
          >
            <div className="flex flex-col items-center gap-2">
              <Lock size={28} style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Papan dikunci</p>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="w-full h-full"
          style={{ cursor: locked ? 'not-allowed' : tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />

        {/* Status */}
        {!isEmpty && (
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--green)' }}
          >
            ✓ Papan siap dikirim
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t"
        style={{ background: 'white', borderColor: 'var(--border)' }}
      >
        {/* Tools */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-base)' }}>
          {([
            { id: 'pen', icon: <Pencil size={15} /> },
            { id: 'eraser', icon: <Eraser size={15} /> },
            { id: 'text', icon: <Type size={15} /> },
            { id: 'rect', icon: <Square size={15} /> },
            { id: 'line', icon: <Minus size={15} /> },
          ] as { id: Tool; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={tool === t.id ? { background: 'var(--accent-primary)', color: 'white' } : { color: 'var(--text-secondary)' }}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-5 h-5 rounded-full transition-all"
              style={{
                background: c,
                outline: color === c ? `2.5px solid ${c}` : 'none',
                outlineOffset: 2,
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* History + Send */}
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={!strokes.length} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:bg-gray-100">
            <RotateCcw size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={redo} disabled={!redoStack.length} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:bg-gray-100">
            <RotateCw size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={clear} disabled={!strokes.length} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:bg-gray-100">
            <Trash2 size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-gray-100" style={{ color: 'var(--text-secondary)' }}>
            <Mic size={14} /> Rekam
          </button>

          <button
            onClick={() => {
              const snap = getSnapshot();
              onSnapshotReady(snap);
            }}
            disabled={isEmpty}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent-primary)' }}
          >
            Kirim Giliran →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dialog panel ───────────────────────────────────────────────────────────
function DialogPanel({ messages, isSending }: { messages: DialogMessage[]; isSending: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Reka header */}
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
        <div className="relative">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
            style={{ background: 'var(--accent-primary-dim)' }}
          >
            😊
          </div>
          <div
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
            style={{ background: '#16A34A' }}
          />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Reka</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isSending ? '✏️ Sedang menyimak...' : 'Murid yang penasaran 🤔'}
          </p>
        </div>
        <button className="ml-auto w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100">
          <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="text-4xl">😊</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Hei! Aku Reka, siap belajar dari kamu.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Mulai jelaskan di papan, nanti aku pasti punya banyak pertanyaan!
            </p>
          </div>
        )}

        {messages.map(msg => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-sm text-white"
                  style={{ background: 'var(--accent-primary)' }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }
          const style = getBubbleStyle(msg.responseType ?? 'question');
          return (
            <div key={msg.id} className="flex gap-2 items-end">
              <div className="text-base flex-shrink-0 mb-1">{style.icon}</div>
              <div
                className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm"
                style={{ background: style.bg, border: `1px solid ${style.border}`, color: 'var(--text-primary)' }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-2 items-end">
            <div className="text-base">❓</div>
            <div
              className="px-4 py-3 rounded-2xl rounded-bl-sm"
              style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}
            >
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: 'var(--text-muted)',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Text input */}
      <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
        >
          <input
            type="text"
            placeholder="Tambahkan penjelasan teks..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>tekan Enter untuk kirim</span>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Teaching page ──────────────────────────────────────────────────────────
export default function TeachingPage() {
  const navigate = useNavigate();
  const { topicTitle, turnCount, messages, isSending, addMessage, setIsSending, incrementTurn, setStatus, setEvaluationResult } = useSessionStore();
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleSnapshot = (_dataUrl: string) => {
    if (isSending) return;
    setIsSending(true);
    incrementTurn();

    addMessage({
      id: `u${Date.now()}`,
      role: 'user',
      content: '📎 [Snapshot papan dikirim]',
      timestamp: new Date().toISOString(),
    });

    // Simulate learner response
    setTimeout(() => {
      const response = MOCK_RESPONSES[turnCount % MOCK_RESPONSES.length];
      addMessage({
        id: `l${Date.now()}`,
        role: 'learner',
        content: response.text,
        responseType: response.type,
        timestamp: new Date().toISOString(),
      });
      setIsSending(false);
    }, 2200);
  };

  const handleEndSession = () => {
    setStatus('EVALUASI');
    // Simulate eval
    const { MOCK_EVALUATION } = require('../lib/mockData');
    setEvaluationResult(MOCK_EVALUATION);
    navigate('/evaluation');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-4 bg-white border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={15} />
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)' }}>#</span>
          {topicTitle || 'Sesi Mengajar'}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />
            Giliran ke-{turnCount + 1}
          </div>
          <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Clock size={13} /> {formatTime(elapsed)}
          </div>
        </div>

        <button
          onClick={() => setShowEndConfirm(true)}
          className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all hover:bg-red-50"
          style={{ color: '#DC2626' }}
        >
          Akhiri Sesi
        </button>
      </div>

      {/* Main: canvas + dialog */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <WhiteboardCanvas locked={locked} onSnapshotReady={handleSnapshot} />
        </div>

        {/* Lock / raise buttons */}
        <div
          className="flex flex-col gap-2 py-3 px-1.5 border-l border-r items-center justify-center"
          style={{ borderColor: 'var(--border)', background: 'white' }}
        >
          <button
            onClick={() => setLocked(!locked)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100"
            title={locked ? 'Unlock papan' : 'Lock papan'}
            style={{ color: locked ? 'var(--accent-primary)' : 'var(--text-muted)' }}
          >
            {locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 text-base"
            title="Raise hand"
          >
            ✋
          </button>
        </div>

        {/* Dialog */}
        <div
          className="w-80 flex-shrink-0 flex flex-col overflow-hidden border-l"
          style={{ borderColor: 'var(--border)', background: 'white' }}
        >
          <DialogPanel messages={messages} isSending={isSending} />
        </div>
      </div>

      {/* End session confirm */}
      {showEndConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Akhiri sesi?</h3>
              <button onClick={() => setShowEndConfirm(false)} className="hover:opacity-60">
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Sesi akan diakhiri dan Reka akan menilai penjelasanmu. Ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Batal
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#DC2626' }}
              >
                Akhiri Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// Fix require in ESM
declare function require(module: string): any;
