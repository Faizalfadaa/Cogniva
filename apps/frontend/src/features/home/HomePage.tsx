import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import { useUserStore } from '../../state/UserStore'
import Onboarding from './Onboarding'
import type { WorkspaceDTO, WorkspaceState } from '../../dto/WorkspaceDTO'
import styles from '../../styles/HomePage.module.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

type ViewFilter = 'All' | 'Active' | 'Completed'

/** Draft + Teaching = Active. Evaluating + Completed = Completed. */
function getViewFilter(state: WorkspaceState): Exclude<ViewFilter, 'All'> {
  return state === 'Draft' || state === 'Teaching' ? 'Active' : 'Completed'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** A drawn plus. A text "+" centres its line box rather than the glyph, which
 *  leaves it visibly low inside a fixed-size tile or beside a label. */
function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────
// Still shows the real underlying state (Draft/Teaching/Evaluating/Completed)
// on the card itself — users benefit from that granularity inside a section,
// but don't need to filter by it.

function StateBadge({ state }: { state: WorkspaceState }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${state.toLowerCase()}`]}`}>
      {state}
    </span>
  )
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function WorkspaceCard({
  ws,
  onClick,
  onDeleteClick,
}: {
  ws: WorkspaceDTO
  onClick: () => void
  onDeleteClick: () => void
}) {
  const hasTitle = Boolean(ws.title)
  return (
    <div className={styles.wsCardWrap}>
      <button
        className={styles.wsCard}
        onClick={onClick}
        aria-label={`Open workspace ${ws.title ?? 'untitled'}`}
      >
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
            {ws.title ?? 'Untitled workspace'}
          </p>
          <p className={styles.wsCardMeta}>
            {timeAgo(ws.updatedAt)}
            {ws.description && (
              <span className={styles.wsCardDesc}> · {ws.description}</span>
            )}
          </p>
        </div>
      </button>
      <button
        className={styles.wsCardDeleteBtn}
        onClick={e => {
          e.stopPropagation()
          onDeleteClick()
        }}
        aria-label={`Delete workspace ${ws.title ?? 'untitled'}`}
        title="Delete workspace"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2.5 3.5h9M5.5 3.5V2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M5.8 6.3v4M8.2 6.3v4M3.3 3.5l.5 8a1 1 0 0 0 1 .95h4.4a1 1 0 0 0 1-.95l.5-8"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

function NewWorkspaceCard({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      className={styles.newCard}
      onClick={onClick}
      disabled={loading}
      aria-label="Create a new workspace"
    >
      <div className={styles.newCardInner}>
        <div className={styles.newCardPlus}>
          {loading ? (
            <svg className={styles.spinner} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
          ) : (
            <IconPlus size={16} />
          )}
        </div>
        <p className={styles.newCardLabel}>{loading ? 'Creating workspace...' : 'New workspace'}</p>
      </div>
    </button>
  )
}

function EmptyState({ filter, onNew, loading }: { filter: ViewFilter; onNew: () => void; loading: boolean }) {
  const isCompleted = filter === 'Completed'
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
      {isCompleted ? (
        <>
          <h3 className={styles.emptyTitle}>No finished sessions yet</h3>
          <p className={styles.emptyBody}>
            Finish a teaching session and its evaluation will show up here.
          </p>
        </>
      ) : (
        <>
          <h3 className={styles.emptyTitle}>No workspaces yet</h3>
          <p className={styles.emptyBody}>
            Start your first session. Pick a topic, open the whiteboard, and teach your AI student.
          </p>
          <button className={styles.emptyBtn} onClick={onNew} disabled={loading}>
            {loading ? 'Creating...' : 'Create your first workspace'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  ws,
  deleting,
  onConfirm,
  onCancel,
}: {
  ws: WorkspaceDTO
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className={styles.modalOverlay} onClick={() => !deleting && onCancel()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalMarkDanger}>!</div>
        <h2 id="delete-modal-title" className={styles.modalTitle}>Delete this workspace?</h2>
        <p className={styles.modalBody}>
          {ws.title ? <>"{ws.title}"</> : 'Untitled workspace'} will be permanently deleted,
          including all its teaching history and evaluation. This action cannot be undone.
        </p>
        <button className={styles.modalBtnDanger} onClick={onConfirm} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Yes, delete workspace'}
        </button>
        <button className={styles.modalBtnGhost} onClick={onCancel} disabled={deleting}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
// Opened from the sidebar profile button. The name is the only thing stored
// about a user today, so this is where it gets changed.

function LoginScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'login') {
        await onLogin(username, password)
      } else {
        await onRegister(username, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <div className={styles.loginLogo}>
          <img src="/cogniva_logo.png" alt="" />
        </div>
        <h2 id="login-title" className={styles.modalTitle}>
          {mode === 'login' ? 'Sign in to Cogniva' : 'Create your account'}
        </h2>
        <p className={styles.modalBody}>
          Keep your teaching workspaces attached to your username.
        </p>

        <input
          className={styles.modalInput}
          type="text"
          value={username}
          placeholder="Username"
          autoComplete="username"
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          maxLength={24}
          aria-label="Username"
        />
        <input
          className={styles.modalInput}
          type="password"
          value={password}
          placeholder="Password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          aria-label="Password"
        />
        {error && <p className={styles.authError}>{error}</p>}

        <button className={styles.modalBtn} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting
            ? 'Please wait...'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
        </button>
        <button
          className={styles.modalBtnGhost}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
          disabled={submitting}
        >
          {mode === 'login' ? 'Create a new account' : 'I already have an account'}
        </button>
      </div>
    </div>
  )
}

function ProfileModal({
  userName,
  onSave,
  onClose,
}: {
  userName: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(userName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed !== userName

  function handleSave() {
    if (!canSave) return
    onSave(trimmed)
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.profileAvatarLg} aria-hidden="true">
          {userName.charAt(0).toUpperCase() || '?'}
        </div>
        <h2 id="profile-modal-title" className={styles.modalTitle}>Your profile</h2>
        <p className={styles.modalBody}>
          Your AI student calls you by this name during a session.
        </p>

        <span className={styles.profileFieldLabel}>Display name</span>
        <input
          ref={inputRef}
          className={styles.modalInput}
          type="text"
          value={name}
          placeholder="Your name..."
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          maxLength={40}
          aria-label="Your name"
        />

        <button className={styles.modalBtn} onClick={handleSave} disabled={!canSave}>
          Save changes
        </button>
        <button className={styles.modalBtnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ label: string; value: ViewFilter }> = [
  { label: 'All',       value: 'All' },
  { label: 'Active',    value: 'Active' },
  { label: 'Completed', value: 'Completed' },
]

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const bridge = useBridge()
  const navigate = useNavigate()
  const {
    user,
    userName,
    authLoading,
    needsNameSetup,
    fetchMe,
    login,
    register,
    logout,
    setUserName,
  } = useUserStore()

  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ViewFilter>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceDTO | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const loadWorkspaces = useCallback(() => {
    setLoading(true)
    setError(null)
    bridge
      .listWorkspaces()
      .then(ws => {
        setWorkspaces(ws)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        setError(
          'Could not connect to the server. Make sure the backend is running at http://localhost:8000.'
        )
      })
  }, [bridge])

  useEffect(() => {
    if (authLoading || !user || needsNameSetup) return
    loadWorkspaces()
  }, [authLoading, user, needsNameSetup, loadWorkspaces])

  async function handleCreateWorkspace() {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const ws = await bridge.createWorkspace()
      navigate(`/workspace/${ws.id}`)
    } catch {
      setCreating(false)
      setError(
        'Failed to create workspace. Make sure the backend is running at http://localhost:8000.'
      )
    }
  }

  function handleOpenWorkspace(ws: WorkspaceDTO) {
    const isCompleted = getViewFilter(ws.state) === 'Completed'
    navigate(isCompleted ? `/evaluation/${ws.id}` : `/workspace/${ws.id}`)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await bridge.deleteWorkspace(deleteTarget.id)
      setWorkspaces(prev => prev.filter(w => w.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('Failed to delete workspace. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = workspaces.filter(ws => {
    const matchFilter = filter === 'All' || getViewFilter(ws.state) === filter
    const matchSearch =
      !searchQuery ||
      (ws.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ws.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchFilter && matchSearch
  })

  const activeCount    = workspaces.filter(ws => getViewFilter(ws.state) === 'Active').length
  const completedCount = workspaces.filter(ws => getViewFilter(ws.state) === 'Completed').length
  const counts: Record<ViewFilter, number> = {
    All:       workspaces.length,
    Active:    activeCount,
    Completed: completedCount,
  }

  const hasAny = workspaces.length > 0

  if (authLoading) {
    return (
      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.content}>
            <div className={styles.loadingGrid}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.skeleton} aria-hidden="true" />
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!user) return <LoginScreen onLogin={login} onRegister={register} />

  // First visit: short intro explaining what Cogniva is, ending with the name step.
  if (needsNameSetup) return <Onboarding onDone={setUserName} />

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.logo}>
            <span className={styles.logoMark}><img src="/cogniva_logo.png" alt="Cogniva Logo" className={styles.logoImg} /></span>
            <span className={styles.logoText}>Cogniva</span>
          </div>

          <button
            className={styles.newBtn}
            onClick={handleCreateWorkspace}
            disabled={creating}
            aria-label="Create a new workspace"
          >
            <span className={styles.newBtnPlus}>
              {creating ? '…' : <IconPlus size={14} />}
            </span>
            <span>New workspace</span>
          </button>
        </div>

        <nav className={styles.sidebarNav} aria-label="Filter workspaces">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.navItem} ${filter === opt.value ? styles.navItemActive : ''}`}
              onClick={() => setFilter(opt.value)}
              aria-current={filter === opt.value ? 'page' : undefined}
            >
              <span>{opt.label}</span>
              {counts[opt.value] > 0 && (
                <span className={styles.navCount}>{counts[opt.value]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <button className={styles.logoutBtn} onClick={logout}>
            Sign out
          </button>
          <button
            className={styles.userChip}
            onClick={() => setProfileOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Open profile settings for ${userName ?? 'you'}`}
            title="Profile"
          >
            <div className={styles.userAvatar}>
              {userName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <span className={styles.userName}>{userName}</span>
            <span className={styles.userChipCaret} aria-hidden="true">▲</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <header className={styles.mainHeader}>
          <div className={styles.mainHeaderLeft}>
            <h1 className={styles.mainTitle}>
              {filter === 'All' ? 'All workspaces' : filter}
            </h1>
            {hasAny && (
              <p className={styles.mainSub}>{filtered.length} workspace{filtered.length === 1 ? '' : 's'}</p>
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
                placeholder="Search workspaces..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search workspaces"
              />
            </div>
          )}
        </header>

        {/* Content */}
        <div className={styles.content}>
          {error ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>Can't connect</h3>
              <p className={styles.emptyBody}>{error}</p>
              <button className={styles.emptyBtn} onClick={loadWorkspaces}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className={styles.loadingGrid}>
              {[1, 2, 3].map(i => (
                <div key={i} className={styles.skeleton} aria-hidden="true" />
              ))}
            </div>
          ) : !hasAny ? (
            <EmptyState filter={filter} onNew={handleCreateWorkspace} loading={creating} />
          ) : filtered.length === 0 ? (
            <div className={styles.noResults}>
              <p>No matching workspaces.</p>
              <button
                className={styles.clearFilter}
                onClick={() => { setFilter('All'); setSearchQuery('') }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(ws => (
                <WorkspaceCard
                  key={ws.id}
                  ws={ws}
                  onClick={() => handleOpenWorkspace(ws)}
                  onDeleteClick={() => setDeleteTarget(ws)}
                />
              ))}
              {/* Only show new workspace card in All / Active views */}
              {(filter === 'All' || filter === 'Active') && (
                <NewWorkspaceCard onClick={handleCreateWorkspace} loading={creating} />
              )}
            </div>
          )}
        </div>
      </main>

      {profileOpen && (
        <ProfileModal
          userName={userName ?? ''}
          onSave={setUserName}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          ws={deleteTarget}
          deleting={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
