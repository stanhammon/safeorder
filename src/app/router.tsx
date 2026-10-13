import { LoginPage } from '@/features/auth/LoginPage'
import { HomePage, LogPage, NotFoundPage } from '@/features/home/HomePage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { PeoplePage, PersonPage } from '@/features/people/PeoplePages'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { createBrowserRouter } from 'react-router'
import { AppLayout, RequireSession } from './AppLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'log', element: <LogPage /> },
          { path: 'people', element: <PeoplePage /> },
          { path: 'people/:personId', element: <PersonPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
