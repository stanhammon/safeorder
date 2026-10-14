import { LoginPage } from '@/features/auth/LoginPage'
import { ChefCardPage, ServerCardPage } from '@/features/cards/CardPages'
import { DishFormPage } from '@/features/dishes/DishFormPage'
import { DishPage } from '@/features/dishes/DishPage'
import { SafeOrderEditPage } from '@/features/dishes/SafeOrderEditPage'
import { HomePage } from '@/features/home/HomePage'
import { NotFoundPage } from '@/features/home/NotFoundPage'
import { LogMealPage } from '@/features/log/LogMealPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { PeoplePage, PersonPage } from '@/features/people/PeoplePages'
import { RestaurantFormPage } from '@/features/restaurants/RestaurantFormPage'
import { RestaurantPage } from '@/features/restaurants/RestaurantPage'
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
          { path: 'log', element: <LogMealPage /> },
          { path: 'restaurants/new', element: <RestaurantFormPage /> },
          { path: 'restaurants/:restaurantId', element: <RestaurantPage /> },
          { path: 'restaurants/:restaurantId/edit', element: <RestaurantFormPage /> },
          { path: 'restaurants/:restaurantId/dishes/new', element: <DishFormPage /> },
          { path: 'dishes/:dishId', element: <DishPage /> },
          { path: 'dishes/:dishId/edit', element: <DishFormPage /> },
          { path: 'dishes/:dishId/order/:personId', element: <SafeOrderEditPage /> },
          { path: 'dishes/:dishId/card/:personId', element: <ServerCardPage /> },
          { path: 'people', element: <PeoplePage /> },
          { path: 'people/:personId', element: <PersonPage /> },
          { path: 'people/:personId/card', element: <ChefCardPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
