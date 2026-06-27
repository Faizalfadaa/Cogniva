import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import { useUserStore } from '../../state/UserStore'
import type { WorkspaceDTO, WorkspaceState } from '../../dto/WorkspaceDTO'
import styles from '../../styles/HomePage.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

function stateBadgeLabel(state: WorkspaceState): string {
  const map: Record<WorkspaceState, string> = {
    Draft: 'Draft',
    Teaching: 'Teaching',
    Evaluating: 'Evaluating',
    Completed: 'Completed',
  }
  return map[state]
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StateBadge({ state }: { state: WorkspaceState }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${state.toLowerCase()}`]}`}>
      {stateBadgeLabel(state)}
    </span>
  )
}

function WorkspaceCard({
  ws,
  onClick,
}: {
  ws: WorkspaceDTO
  onClick: () => void
}) {
  const hasTitle = Boolean(ws.title)

  return (
    <button className={styles.wsCard} onClick={onClick} aria-label={`Buka workspace ${ws.title ?? 'tanpa judul'}`}>
      <div className={styles.wsCardThumb}>
        {ws.thumbnailUrl ? (
          <img className={styles.wsCardThumbImg} src={ws.thumbnailUrl} alt="" />
        ) : (
          <div className={styles.wsCardThumbPlaceholder} aria-hidden="true" />
        )}
        <span className={styles.wsCardThumbBadge}>
          <StateBadge state={ws.state} />
        </span>
      </div>
      <div className={styles.wsCardBody}>
        <p className={`${styles.wsCardTitle} ${!hasTitle ? styles.wsCardTitleEmpty : ''}`}>
          {ws.title ?? 'Workspace tanpa judul'}
        </p>
        <p className={styles.wsCardMeta}>
          {timeAgo(ws.updatedAt)}
          {ws.description && (
            <span className={styles.wsCardDesc}> · {ws.description}</span>
          )}
        </p>
      </div>
    </button>
  )
}

function NewWorkspaceCard({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      className={styles.newCard}
      onClick={onClick}
      disabled={loading}
      aria-label="Buat workspace baru"
    >
      <div className={styles.newCardInner}>
        <div className={styles.newCardPlus}>
          {loading ? (
            <svg className={styles.spinner} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
          ) : (
            <span>+</span>
          )}
        </div>
        <p className={styles.newCardLabel}>{loading ? 'Membuat workspace...' : 'Workspace baru'}</p>
      </div>
    </button>
  )
}

function EmptyState({ onNew, loading }: { onNew: () => void; loading: boolean }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="8" y="12" width="32" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 20h16M16 26h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="36" cy="12" r="6" fill="var(--lime)" />
          <path d="M33.5 12h5M36 9.5v5" stroke="var(--lime-text)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className={styles.emptyTitle}>Belum ada workspace</h3>
      <p className={styles.emptyBody}>
        Mulai sesi pertamamu. Pilih topik, buka whiteboard, dan ajari AI muridmu.
      </p>
      <button className={styles.emptyBtn} onClick={onNew} disabled={loading}>
        {loading ? 'Membuat...' : 'Buat workspace pertama'}
      </button>
    </div>
  )
}

// ─── Name Setup Modal ────────────────────────────────────────────────────────

function NameModal({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.modalMark}>✦</div>
        <h2 id="modal-title" className={styles.modalTitle}>Hei, siapa namamu?</h2>
        <p className={styles.modalBody}>
          Murid AI-mu akan memanggilmu dengan nama ini sepanjang sesi.
        </p>
        <input
          ref={inputRef}
          className={styles.modalInput}
          type="text"
          placeholder="Nama kamu..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          maxLength={40}
          aria-label="Nama kamu"
        />
        <button
          className={styles.modalBtn}
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          Masuk ke Cogniva →
        </button>
      </div>
    </div>
  )
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ label: string; value: WorkspaceState | 'All' }> = [
  { label: 'Semua', value: 'All' },
  { label: 'Teaching', value: 'Teaching' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Evaluating', value: 'Evaluating' },
  { label: 'Completed', value: 'Completed' },
]

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const bridge = useBridge()
  const navigate = useNavigate()
  const { userName, needsNameSetup, setUserName } = useUserStore()

  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<WorkspaceState | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (needsNameSetup) return
    bridge.listWorkspaces().then(ws => {
      setWorkspaces(ws)
      setLoading(false)
    })
  }, [bridge, needsNameSetup])

  async function handleCreateWorkspace() {
    if (creating) return
    setCreating(true)
    try {
      const ws = await bridge.createWorkspace()
      navigate(`/workspace/${ws.id}`)
    } catch {
      setCreating(false)
    }
  }

  function handleOpenWorkspace(ws: WorkspaceDTO) {
    if (ws.state === 'Completed') {
      navigate(`/evaluation/${ws.id}`)
    } else {
      navigate(`/workspace/${ws.id}`)
    }
  }

  function handleNameConfirm(name: string) {
    setUserName(name)
  }

  const filtered = workspaces.filter(ws => {
    const matchState = filter === 'All' || ws.state === filter
    const matchSearch =
      !searchQuery ||
      (ws.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ws.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchState && matchSearch
  })

  const stateCounts: Record<WorkspaceState, number> = {
    Draft: 0,
    Teaching: 0,
    Evaluating: 0,
    Completed: 0,
  }
  workspaces.forEach(ws => { stateCounts[ws.state]++ })

  const hasAny = workspaces.length > 0

  if (needsNameSetup) {
    return <NameModal onConfirm={handleNameConfirm} />
  }

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>✦</span>
            <span className={styles.logoText}>Cogniva</span>
          </div>

          <button
            className={styles.newBtn}
            onClick={handleCreateWorkspace}
            disabled={creating}
            aria-label="Buat workspace baru"
          >
            <span className={styles.newBtnPlus}>{creating ? '…' : '+'}</span>
            <span>Workspace baru</span>
          </button>
        </div>

        <nav className={styles.sidebarNav} aria-label="Filter workspace">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.navItem} ${filter === opt.value ? styles.navItemActive : ''}`}
              onClick={() => setFilter(opt.value)}
              aria-current={filter === opt.value ? 'page' : undefined}
            >
              <span>{opt.label}</span>
              {opt.value !== 'All' && stateCounts[opt.value] > 0 && (
                <span className={styles.navCount}>{stateCounts[opt.value]}</span>
              )}
              {opt.value === 'All' && workspaces.length > 0 && (
                <span className={styles.navCount}>{workspaces.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.userChip}>
            <div className={styles.userAvatar}>
              {userName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <span className={styles.userName}>{userName}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <header className={styles.mainHeader}>
          <div className={styles.mainHeaderLeft}>
            <h1 className={styles.mainTitle}>
              {filter === 'All' ? 'Semua workspace' : filter}
            </h1>
            {hasAny && (
              <p className={styles.mainSub}>
                {filtered.length} workspace{filtered.length !== 1 ? '' : ''}
              </p>
            )}
          </div>

          {hasAny && (
            <div className={styles.searchBox}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={styles.searchIcon}>
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Cari workspace..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Cari workspace"
              />
            </div>
          )}
        </header>

        {/* Stats strip */}
        {hasAny && (
          <div className={styles.statsStrip}>
            {Object.entries(stateCounts)
              .filter(([, count]) => count > 0)
              .map(([state, count]) => (
                <button
                  key={state}
                  className={`${styles.statPill} ${filter === state ? styles.statPillActive : ''}`}
                  onClick={() => setFilter(filter === state ? 'All' : state as WorkspaceState)}
                >
                  <span className={`${styles.statDot} ${styles[`dot_${state.toLowerCase()}`]}`} />
                  <span>{count} {state}</span>
                </button>
              ))}
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingGrid}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.skeleton} aria-hidden="true" />
              ))}
            </div>
          ) : !hasAny ? (
            <EmptyState onNew={handleCreateWorkspace} loading={creating} />
          ) : filtered.length === 0 ? (
            <div className={styles.noResults}>
              <p>Tidak ada workspace yang cocok.</p>
              <button className={styles.clearFilter} onClick={() => { setFilter('All'); setSearchQuery('') }}>
                Hapus filter
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(ws => (
                <WorkspaceCard
                  key={ws.id}
                  ws={ws}
                  onClick={() => handleOpenWorkspace(ws)}
                />
              ))}
              <NewWorkspaceCard onClick={handleCreateWorkspace} loading={creating} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}