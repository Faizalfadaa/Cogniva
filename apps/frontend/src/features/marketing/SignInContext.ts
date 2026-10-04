import { createContext, useContext } from 'react'

/**
 * Opens the sign-in overlay from anywhere inside the marketing pages.
 *
 * The overlay itself lives once in MarketingLayout, so a pricing card or a
 * contact block can offer "sign in" without each page mounting its own copy.
 */
export const SignInContext = createContext<() => void>(() => {})

export function useOpenSignIn(): () => void {
  return useContext(SignInContext)
}
