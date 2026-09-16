import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ErrorPage } from '../features/ErrorPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    hydrateFallbackElement: <div className="page"><p className="muted">正在打开拾页…</p></div>,
    children: [
      { path: '/', lazy: async () => ({ Component: (await import('../features/home/HomePage')).HomePage }) },
      { path: '/notes', lazy: async () => ({ Component: (await import('../features/notes/NotesPage')).NotesPage }) },
      { path: '/notes/new', lazy: async () => ({ Component: (await import('../features/notes/NoteFormPage')).NoteFormPage }) },
      { path: '/notes/:id', lazy: async () => ({ Component: (await import('../features/notes/NoteDetailPage')).NoteDetailPage }) },
      { path: '/notes/:id/edit', lazy: async () => ({ Component: (await import('../features/notes/NoteFormPage')).NoteFormPage }) },
      { path: '/sources/:id', lazy: async () => ({ Component: (await import('../features/sources/SourcePage')).SourcePage }) },
      { path: '/review', lazy: async () => ({ Component: (await import('../features/review/ReviewPage')).ReviewPage }) },
      { path: '/settings', lazy: async () => ({ Component: (await import('../features/settings/SettingsPage')).SettingsPage }) },
      { path: '/settings/trash', lazy: async () => ({ Component: (await import('../features/settings/TrashPage')).TrashPage }) },
      { path: '*', lazy: async () => ({ Component: (await import('../features/NotFoundPage')).NotFoundPage }) }
    ]
  }
])
