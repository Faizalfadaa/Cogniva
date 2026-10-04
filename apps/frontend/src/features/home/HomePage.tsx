import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBridge } from '../../bridge/BridgeProvider'
import { useUserStore } from '../../state/UserStore'
import { LoginScreen } from '../auth/LoginScreen'
import Onboarding from './Onboarding'
import type { WorkspaceDTO, WorkspaceState } from '../../dto/WorkspaceDTO'
import styles from '../../styles/HomePage.module.css'
import { ProductTour } from '../tour/ProductTour'
import { HOME_TOUR_STEPS } from '../tour/tourSteps'
import { useAppTour } from '../tour/useAppTour'
import { useLocale, useT, type Translate } from '../../i18n/LanguageProvider'
import { LanguageToggle } from '../../i18n/LanguageToggle'
import { LocaleBadge } from '../../i18n/LocaleBadge'
import { LOCALE_LABELS, type MessageKey } from '../../i18n/messages'

// ─── Helpers ────────────────────────────────────────────────────────────────

type ViewFilter = 'All' | 'Active' | 'Completed'

/** Draft + Teaching = Active. Evaluating + Completed = Completed. */
function getViewFilter(state: WorkspaceState): Exclude<ViewFilter, 'All'> {
  return state === 'Draft' || state === 'Teaching' ? 'Active' : 'Completed'
}

function timeAgo(iso: string, t: Translate): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('time.justNow')
  if (mins < 60) return t('time.minsAgo', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('time.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return days === 1 ? t('time.dayAgo') : t('time.daysAgo', { count: days })
}

/** The four workspace states, as their message keys. */
const STATE_KEYS: Record<WorkspaceState, MessageKey> = {
  Draft: 'state.draft',
  Teaching: 'state.teaching',
  Evaluating: 'state.evaluating',
  Completed: 'state.completed',
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
  const t = useT()
  return (
    <span className={`${styles.badge} ${styles[`badge_${state.toLowerCase()}`]}`}>
      {t(STATE_KEYS[state])}
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
  const t = useT()
  const hasTitle = Boolean(ws.title)
  return (
    <div className={styles.wsCardWrap}>
      <button
        className={styles.wsCard}
        onClick={onClick}
        aria-label={t('home.openWorkspace', { title: ws.title ?? t('home.untitled') })}
      >
        <div className={styles.wsCardThumb}>
          {ws.thumbnailUrl ? (
            <img className={styles.wsCardThumbImg} src={ws.thumbnailUrl} alt="" />
          ) : (
            <div className={styles.wsCardThumbPlaceholder} aria-hidden="true" />
          )}
          <span className={styles.wsCardThumbBadge}>
            <LocaleBadge
              locale={ws.locale}
              title={t('home.workspaceLanguage', { language: LOCALE_LABELS[ws.locale] })}
              style={{ marginRight: '6px' }}
            />
            <StateBadge state={ws.state} />
          </span>
        </div>
        <div className={styles.wsCardBody}>
          <p className={`${styles.wsCardTitle} ${!hasTitle ? styles.wsCardTitleEmpty : ''}`}>
            {ws.title ?? t('home.untitledWorkspace')}
          </p>
          <p className={styles.wsCardMeta}>
            {timeAgo(ws.updatedAt, t)}
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
        aria-label={t('home.deleteWorkspace', { title: ws.title ?? t('home.untitled') })}
        title={t('home.deleteWorkspaceTitle')}
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
  const t = useT()
  return (
    <button
      className={styles.newCard}
      onClick={onClick}
      disabled={loading}
      aria-label={t('home.createWorkspace')}
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
        <p className={styles.newCardLabel}>
          {loading ? t('home.creatingWorkspace') : t('home.newWorkspace')}
        </p>
      </div>
    </button>
  )
}

function EmptyState({ filter, onNew, loading }: { filter: ViewFilter; onNew: () => void; loading: boolean }) {
  const t = useT()
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
          <h3 className={styles.emptyTitle}>{t('home.noFinished')}</h3>
          <p className={styles.emptyBody}>{t('home.noFinishedHint')}</p>
        </>
      ) : (
        <>
          <h3 className={styles.emptyTitle}>{t('home.noWorkspaces')}</h3>
          <p className={styles.emptyBody}>{t('home.noWorkspacesHint')}</p>
          <button className={styles.emptyBtn} onClick={onNew} disabled={loading}>
            {loading ? t('home.creating') : t('home.createFirst')}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

/**
 * Second step before leaving a session. Not styled as a danger action: signing
 * out destroys nothing, it just ends the session. The wording differs for a
 * guest because "exit guest" sounds more final than it is.
 */
function LogoutConfirmModal({
  isGuest,
  busy,
  onConfirm,
  onCancel,
}: {
  isGuest: boolean
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  return (
    <div className={styles.modalOverlay} onClick={() => !busy && onCancel()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalMark}>?</div>
        <h2 id="logout-modal-title" className={styles.modalTitle}>
          {isGuest ? t('home.exitGuestTitle') : t('home.signOutTitle')}
        </h2>
        <p className={styles.modalBody}>
          {isGuest ? t('home.exitGuestBody') : t('home.signOutBody')}
        </p>
        <button className={styles.modalBtn} onClick={onConfirm} disabled={busy}>
          {busy
            ? t('home.signingOut')
            : isGuest
              ? t('home.confirmExitGuest')
              : t('home.confirmSignOut')}
        </button>
        <button className={styles.modalBtnGhost} onClick={onCancel} disabled={busy}>
          {t('home.staySignedIn')}
        </button>
      </div>
    </div>
  )
}

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
  const t = useT()
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
        <h2 id="delete-modal-title" className={styles.modalTitle}>
          {t('home.deleteConfirm')}
        </h2>
        <p className={styles.modalBody}>
          {t('home.deleteBody', {
            title: ws.title ? `"${ws.title}"` : t('home.untitledWorkspace'),
          })}
        </p>
        <button className={styles.modalBtnDanger} onClick={onConfirm} disabled={deleting}>
          {deleting ? t('home.deleting') : t('home.confirmDelete')}
        </button>
        <button className={styles.modalBtnGhost} onClick={onCancel} disabled={deleting}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
// Opened from the sidebar profile button. The name is the only thing stored
// about a user today, so this is where it gets changed.

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
  const t = useT()

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
        <h2 id="profile-modal-title" className={styles.modalTitle}>{t('home.profile')}</h2>
        <p className={styles.modalBody}>{t('home.profileBody')}</p>

        <span className={styles.profileFieldLabel}>{t('home.displayName')}</span>
        <input
          ref={inputRef}
          className={styles.modalInput}
          type="text"
          value={name}
          placeholder={t('home.yourName')}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          maxLength={40}
          aria-label={t('home.yourNameLabel')}
        />

        <button className={styles.modalBtn} onClick={handleSave} disabled={!canSave}>
          {t('home.saveChanges')}
        </button>
        <button className={styles.modalBtnGhost} onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ label: MessageKey; value: ViewFilter }> = [
  { label: 'home.all',       value: 'All' },
  { label: 'home.active',    value: 'Active' },
  { label: 'home.completed', value: 'Completed' },
]

/** The heading over the grid, which names the filter rather than repeating it. */
const FILTER_TITLES: Record<ViewFilter, MessageKey> = {
  All: 'home.allWorkspaces',
  Active: 'home.active',
  Completed: 'home.completed',
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const bridge = useBridge()
  const navigate = useNavigate()
  const t = useT()
  const { locale } = useLocale()

  const {
    user,
    userName,
    authLoading,
    needsNameSetup,
    fetchMe,
    login,
    register,
    continueAsGuest,
    logout,
    setUserName,
  } = useUserStore()

  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  /**
   * Leaving a session drops you at the public landing page, not at the sign-in
   * panel. Without the navigate, clearing `user` just re-triggers the
   * `if (!user)` guard below and the login form appears in place, which reads
   * as "sign in again" rather than "you have signed out".
   */
  const handleLogout = useCallback(async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
      navigate('/')
    } finally {
      // The component usually unmounts on navigate; resetting keeps the dialog
      // usable again if logout threw and we are still here.
      setLoggingOut(false)
    }
  }, [loggingOut, logout, navigate])

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
        setError(t('home.connectError'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, t])

  useEffect(() => {
    if (authLoading || !user || needsNameSetup) return
    loadWorkspaces()
  }, [authLoading, user, needsNameSetup, loadWorkspaces])

  async function handleCreateWorkspace() {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const ws = await bridge.createWorkspace(locale)
      navigate(`/workspace/${ws.id}`)
    } catch {
      setCreating(false)
      setError(t('home.createError'))
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
      setError(t('home.deleteError'))
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

  // Must run before the early returns below: a hook skipped on the logged-out
  // render would change the hook order and blow up on the next one.
  const tour = useAppTour('home')

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

  if (!user) return <LoginScreen onLogin={login} onRegister={register} onGuest={continueAsGuest} />

  // First visit: short intro explaining what Cogniva is, ending with the name step.
  if (needsNameSetup) return <Onboarding onDone={setUserName} />

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          {/* The mark doubles as the way back to the public site. */}
          <Link to="/" className={styles.logo} title={t('header.homeTitle')}>
            <span className={styles.logoMark}><img src="/cogniva_logo.png" alt="Cogniva Logo" className={styles.logoImg} /></span>
            <span className={styles.logoText}>Cogniva</span>
          </Link>

          <button
            data-tour="new-workspace"
            className={styles.newBtn}
            onClick={handleCreateWorkspace}
            disabled={creating}
            aria-label={t('home.createWorkspace')}
          >
            <span className={styles.newBtnPlus}>
              {creating ? '…' : <IconPlus size={14} />}
            </span>
            <span>{t('home.newWorkspace')}</span>
          </button>
        </div>

        <nav
          className={styles.sidebarNav}
          data-tour="workspace-filters"
          aria-label={t('home.filterLabel')}
        >
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.navItem} ${filter === opt.value ? styles.navItemActive : ''}`}
              onClick={() => setFilter(opt.value)}
              aria-current={filter === opt.value ? 'page' : undefined}
            >
              <span>{t(opt.label)}</span>
              {counts[opt.value] > 0 && (
                <span className={styles.navCount}>{counts[opt.value]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <LanguageToggle style={{ alignSelf: 'flex-start', marginBottom: '8px' }} />

          <button className={styles.logoutBtn} onClick={() => setLogoutConfirm(true)}>
            {user.isGuest ? t('home.exitGuest') : t('home.signOut')}
          </button>
          <button
            data-tour="profile"
            className={styles.userChip}
            onClick={() => {
              if (!user.isGuest) setProfileOpen(true)
            }}
            disabled={user.isGuest}
            aria-haspopup="dialog"
            aria-label={t('home.openProfile', { name: userName ?? t('intro.you') })}
            title={user.isGuest ? t('home.guestSession') : t('home.profileShort')}
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
            <h1 className={styles.mainTitle}>{t(FILTER_TITLES[filter])}</h1>
            {hasAny && (
              <p className={styles.mainSub}>
                {filtered.length === 1
                  ? t('home.oneWorkspace')
                  : t('home.manyWorkspaces', { count: filtered.length })}
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
                placeholder={t('home.search')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label={t('home.searchLabel')}
              />
            </div>
          )}
        </header>

        {/* Content */}
        <div className={styles.content}>
          {error ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>{t('home.cantConnect')}</h3>
              <p className={styles.emptyBody}>{error}</p>
              <button className={styles.emptyBtn} onClick={loadWorkspaces}>
                {t('home.tryAgain')}
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
              <p>{t('home.noMatches')}</p>
              <button
                className={styles.clearFilter}
                onClick={() => { setFilter('All'); setSearchQuery('') }}
              >
                {t('home.clearFilters')}
              </button>
            </div>
          ) : (
            <div className={styles.grid} data-tour="workspace-list">
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

      {profileOpen && !user.isGuest && (
        <ProfileModal
          userName={userName ?? ''}
          onSave={setUserName}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {logoutConfirm && (
        <LogoutConfirmModal
          isGuest={Boolean(user.isGuest)}
          busy={loggingOut}
          onConfirm={handleLogout}
          onCancel={() => !loggingOut && setLogoutConfirm(false)}
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

      {/* First leg of the app tour. It cannot start before this point: the
          name-setup Onboarding returns early above, so none of these targets
          exist yet while that is on screen. */}
      {tour.active && (
        <ProductTour
          steps={HOME_TOUR_STEPS}
          index={tour.index}
          onIndexChange={tour.setIndex}
          onFinish={tour.advance}
          onSkip={tour.skipAll}
          finishLabel={t('tour.gotIt')}
        />
      )}
    </div>
  )
}
