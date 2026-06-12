import { supabase } from '../lib/supabase'
import { hasScribeRole } from '../utils/authRoles'
import Cookies from 'js-cookie'
import { ApiResponse, COOKIE_EXPIRES, User } from './constants'
import { SentryMonitoring } from '../utils/sentry-monitoring'
import * as Sentry from '@sentry/nextjs'

/**
 * Are we running inside a (cross-site) iframe? Used by the embed flow.
 *
 * Inside a cross-site iframe a SameSite=Lax cookie is NOT sent on requests, so
 * the middleware (which gates protected routes on the access_token cookie) would
 * bounce the framed session to /login. Auth cookies must therefore be written as
 * SameSite=None; Secure while framed. Comparing window.self/top references is
 * allowed cross-origin; if a stricter context throws, we are definitely framed.
 */
function isFramed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Cookie SameSite/secure options for auth cookies. Framed (embed) sessions need
 * SameSite=None; Secure so the cookie survives token refreshes inside the iframe;
 * top-level sessions keep the CSRF-safer Lax default.
 */
function authCookieSameSite(): { sameSite: 'none' | 'lax'; secure: boolean } {
  return isFramed()
    ? { sameSite: 'none', secure: true }
    : { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}

export interface SupabaseAuthResponse {
  message: string
  password_updated: boolean
  first_name: string
  last_name: string
  sur_name: string
  session: {
    access_token: string
    refresh_token: string
    expires_in: number
    expires_at: number
    token_type: string
    user: {
      id: string
      email: string
      user_metadata: {
        email: string
        email_verified: boolean
        phone_verified: boolean
        sub: string
      }
    }
  }
}

class SupabaseAuthService {
  private static instance: SupabaseAuthService
  private isSigningOut: boolean = false
  private isHandlingSessionUpdate: boolean = false

  private constructor() {
    // Initialize auth state listener
    this.initAuthStateListener()
  }

  public static getInstance(): SupabaseAuthService {
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = new SupabaseAuthService()
    }
    return SupabaseAuthService.instance
  }

  private initAuthStateListener() {
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session && !this.isSigningOut) {
        this.handleSessionUpdate(session)
      } else if (event === 'SIGNED_OUT') {
        this.isSigningOut = false
        this.clearAuthData()
      } else if (event === 'TOKEN_REFRESHED' && session && !this.isSigningOut) {
        // On token refresh, only update tokens - don't re-fetch doctor data
        // This prevents infinite loops from frequent token refreshes
        this.handleTokenRefresh(session)
      } else if (event === 'PASSWORD_RECOVERY' && session) {
        console.log('Password recovery session detected - not auto-logging in')
        // Don't auto-login on password recovery - let the reset password page handle it
      }
    })
  }

  private async handleSessionUpdate(session: any) {
    // Prevent concurrent executions to avoid infinite loops
    if (this.isHandlingSessionUpdate) {
      console.log('Session update already in progress, skipping...')
      return
    }

    this.isHandlingSessionUpdate = true

    try {
      // First check if user account is active before making any API calls
      if (session.user.user_metadata?.is_active === false) {
        console.log('User account is deactivated, signing out immediately')
        this.isSigningOut = true
        await supabase.auth.signOut()
        return
      }

      // Persist a minimal session immediately to avoid middleware redirect races
      // during OAuth callback navigation.
      let initialRole: string[] = [];
      if (session.user.user_metadata?.role) {
        if (Array.isArray(session.user.user_metadata.role)) {
          initialRole = session.user.user_metadata.role;
        } else {
          initialRole = [session.user.user_metadata.role];
        }
      } else {
        initialRole = ['doctor'];
      }

      const initialUserData: User = {
        id: session.user.id,
        email: session.user.email,
        first_name: session.user.user_metadata?.first_name || '',
        last_name: session.user.user_metadata?.last_name || '',
        role: initialRole,
        hospital_id: session.user.user_metadata?.hospital_id,
        department: session.user.user_metadata?.department || '',
        registration_number: session.user.user_metadata?.registration_number || '',
        sur_name: session.user.user_metadata?.sur_name || '',
      }

      this.setAuthData(session.access_token, initialUserData)
      Cookies.set('refresh_token', session.refresh_token, {
        expires: COOKIE_EXPIRES,
        ...authCookieSameSite()
      })
      localStorage.setItem('refresh_token', session.refresh_token)

      // Fetch doctor info from database to get additional user details
      const { data: doctorData, error } = await supabase
        .from('doctor')
        .select('first_name, last_name, sur_name, hospital_id, department, registration_number, is_active')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116: No rows found - this is expected for new users
        console.warn('Doctor data not found or inaccessible (proceeding with session user only).', error)
      }

      // Check if doctor account is active
      if (doctorData && !doctorData.is_active) {
        console.log('Doctor account is deactivated, signing out immediately')
        this.isSigningOut = true
        await supabase.auth.signOut()
        return
      }

      // Handle role as array (new format) or string (legacy format)
      let userRole: string[] = [];
      if (session.user.user_metadata?.role) {
        if (Array.isArray(session.user.user_metadata.role)) {
          userRole = session.user.user_metadata.role;
        } else {
          // Legacy: convert single role string to array
          userRole = [session.user.user_metadata.role];
        }
      } else {
        userRole = ['doctor']; // default role
      }

      if (hasScribeRole(userRole)) {
        console.log('Account with scribe role blocked from NurMed web session')
        this.isSigningOut = true
        await supabase.auth.signOut()
        this.clearAuthData()
        return
      }

      // B2B-only platform: block individual (B2C) accounts that have no
      // hospital association. Mirrors the guard in login() so OAuth / restored
      // sessions can't bypass it.
      const hospitalId =
        doctorData?.hospital_id ?? session.user.user_metadata?.hospital_id
      if (hospitalId === null || hospitalId === undefined) {
        console.log('Account without hospital_id blocked from NurMed web session')
        this.isSigningOut = true
        await supabase.auth.signOut()
        this.clearAuthData()
        return
      }

      const userData: User = {
        id: session.user.id,
        email: session.user.email,
        first_name: doctorData?.first_name || session.user.user_metadata?.first_name || '',
        last_name: doctorData?.last_name || session.user.user_metadata?.last_name || '',
        role: userRole,
        hospital_id: doctorData?.hospital_id || session.user.user_metadata?.hospital_id,
        department: doctorData?.department || session.user.user_metadata?.department || '',
        registration_number: doctorData?.registration_number || session.user.user_metadata?.registration_number || '',
        sur_name: doctorData?.sur_name || session.user.user_metadata?.sur_name || ''
      }

      // Store auth data
      this.setAuthData(session.access_token, userData)

    } catch (error) {
      console.error('Error handling session update:', error)
      // Don't clear auth data on error - this could cause logout issues
    } finally {
      this.isHandlingSessionUpdate = false
    }
  }

  private async handleTokenRefresh(session: any) {
    // On token refresh, only update tokens without fetching doctor data
    // This prevents infinite loops from frequent automatic token refreshes
    try {
      // Get existing user data from storage to avoid unnecessary API calls
      const currentUser = this.getCurrentUser()
      
      if (currentUser) {
        // Update tokens while keeping existing user data
        this.setAuthData(session.access_token, currentUser)
        
        // Update refresh token
        Cookies.set('refresh_token', session.refresh_token, {
          expires: COOKIE_EXPIRES,
          ...authCookieSameSite()
        })
        localStorage.setItem('refresh_token', session.refresh_token)
      } else {
        // If no user data exists, fall back to full session update
        // This should rarely happen, but ensures we don't lose user data
        await this.handleSessionUpdate(session)
      }
    } catch (error) {
      console.error('Error handling token refresh:', error)
    }
  }

  setAuthData(token: string, user: User): void {
    Cookies.set('access_token', token, {
      expires: COOKIE_EXPIRES,
      ...authCookieSameSite()
    })

    Cookies.set('user', JSON.stringify(user), {
      expires: COOKIE_EXPIRES,
      ...authCookieSameSite()
    })

    localStorage.setItem('access_token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }

  clearAuthData(): void {
    // Remove all cookies
    Cookies.remove('access_token')
    Cookies.remove('user')
    Cookies.remove('refresh_token')

    // Clear all localStorage items
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }

  getCurrentUser(): User | null {
    const userCookie = Cookies.get('user')
    const userLocal = localStorage.getItem('user')

    if (userCookie) {
      return JSON.parse(userCookie)
    } else if (userLocal) {
      const user = JSON.parse(userLocal)
      const token = localStorage.getItem('access_token')

      if (token && user) {
        this.setAuthData(token, user)
      }

      return user
    }

    return null
  }

  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      // Step 1: Sign in with email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        // Track authentication errors
        SentryMonitoring.trackAuthError(authError, {
          email: email,
          action: 'login',
        });
        
        // Also capture the error directly to ensure it gets sent
        Sentry.captureException(authError);
        
        return { success: false, error: authError.message }
      }

      if (!authData.session || !authData.user) {
        const errorMsg = 'Login failed: No session created'
        return { success: false, error: errorMsg }
      }

      if(authData.user.user_metadata?.is_active === false) {
        this.isSigningOut = true
        await supabase.auth.signOut()
        return { success: false, error: 'Your account has been deactivated. Please contact your administrator.' }
      }

      // Step 2: Fetch doctor information
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctor')
        .select('first_name, last_name, sur_name, hospital_id, department, registration_number, is_active')
        .eq('user_id', authData.user.id)
        .single()

      if (doctorError && doctorError.code !== 'PGRST116') {
        // PGRST116: No rows found
        return { success: false, error: 'Doctor not found' }
      }

      // Check if doctor account is active
      if (doctorData && !doctorData.is_active) {
        // Sign out the user immediately since they're not allowed to login
        this.isSigningOut = true
        await supabase.auth.signOut()
        return { success: false, error: 'Your account has been deactivated. Please contact your administrator.' }
      }


      // Step 3: Create user object
      // Handle role as array (new format) or string (legacy format)
      let userRole: string[] = [];
      if (authData.user.user_metadata?.role) {
        if (Array.isArray(authData.user.user_metadata.role)) {
          userRole = authData.user.user_metadata.role;
        } else {
          // Legacy: convert single role string to array
          userRole = [authData.user.user_metadata.role];
        }
      } else {
        userRole = ['doctor']; // default role
      }

      if (hasScribeRole(userRole)) {
        this.isSigningOut = true
        await supabase.auth.signOut()
        this.clearAuthData()
        return {
          success: false,
          error:
            'Accounts with the scribe role cannot access the NurMed dashboard.',
        }
      }

      // B2B-only platform: a user must be associated with a hospital to log in.
      // The hospital_id lives in the user's metadata (and/or doctor record);
      // individual (B2C) accounts have no hospital_id and must be blocked here.
      const hospitalId =
        doctorData?.hospital_id ?? authData.user.user_metadata?.hospital_id
      if (hospitalId === null || hospitalId === undefined) {
        this.isSigningOut = true
        await supabase.auth.signOut()
        this.clearAuthData()
        return {
          success: false,
          error:
            'This account is not associated with a hospital, so it cannot access this platform. Individual accounts must use the NurMed scribe app.',
        }
      }

      const userData: User = {
        id: authData.user.id,
        email: authData.user.email!,
        first_name: doctorData?.first_name || authData.user.user_metadata?.first_name || '',
        last_name: doctorData?.last_name || authData.user.user_metadata?.last_name || '',
        role: userRole,
        hospital_id: doctorData?.hospital_id || authData.user.user_metadata?.hospital_id,
        department: doctorData?.department || authData.user.user_metadata?.department || '',
        registration_number: doctorData?.registration_number || authData.user.user_metadata?.registration_number || '',
        sur_name: doctorData?.sur_name || authData.user.user_metadata?.sur_name || ''
      }

      // Step 4: Store auth data (this will also be handled by the auth state listener)
      this.setAuthData(authData.session.access_token, userData)


      return {
        success: true,
        token: authData.session.access_token,
        user: userData
      }

    } catch (error: any) {
      // Track authentication errors
      SentryMonitoring.trackAuthError(error, {
        email: email,
        action: 'login',
      });
      
      // Also capture the error directly to ensure it gets sent
      Sentry.captureException(error);
      
      return { success: false, error: error.message || 'Login failed' }
    }
  }

  async signup(params: {
    first_name: string
    last_name: string
    email: string
    password: string
    address: string
    organization?: string
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const siteUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

      const emailRedirectTo = new URL('/login', siteUrl).toString()

      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          emailRedirectTo,
          data: {
            first_name: params.first_name,
            last_name: params.last_name,
            address: params.address,
            organization: params.organization || '',
            role: ['doctor'],
          },
        },
      })

      if (error) {
        SentryMonitoring.trackAuthError(error, {
          email: params.email,
          action: 'signup',
        })
        Sentry.captureException(error)
        return { success: false, error: error.message }
      }

      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return { success: false, error: 'User with this email already exists' }
      }

      return {
        success: true,
        message: 'Account created successfully. Please check your email to verify your account.',
      }
    } catch (error: any) {
      SentryMonitoring.trackAuthError(error, {
        email: params.email,
        action: 'signup',
      })
      Sentry.captureException(error)
      return { success: false, error: error.message || 'Signup failed' }
    }
  }

  async signInWithGoogle(redirectTo?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Prefer current origin so staging/prod OAuth redirect always matches the tab URL
      // (avoids wrong callback when NEXT_PUBLIC_SITE_URL is unset or misconfigured).
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const callbackUrl = new URL('/callback', siteUrl || (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'))

      if (redirectTo) {
        callbackUrl.searchParams.set('redirect_to', redirectTo)
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
        },
      })

      if (error) {
        SentryMonitoring.trackAuthError(error, {
          action: 'google_oauth_login',
        })
        Sentry.captureException(error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      SentryMonitoring.trackAuthError(error, {
        action: 'google_oauth_login',
      })
      Sentry.captureException(error)
      return { success: false, error: error.message || 'Google sign-in failed' }
    }
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/forgot-reset-password`
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, message: 'Password reset email sent successfully' }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to send reset password email' }
    }
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // After successful password update, log out the user
      // They need to login again with their new password
      await this.logout()

      return { success: true, message: 'Password updated successfully' }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update password' }
    }
  }

  async verifyPassword(password: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const user = this.getCurrentUser()
      if (!user?.email) {
        return { success: false, error: 'No authenticated user found' }
      }

      // Try to sign in with current email and provided password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password
      })

      if (error) {
        return { success: false, error: 'Invalid password' }
      }

      return { success: true, message: 'Password verified successfully' }
    } catch (error: any) {
      return { success: false, error: error.message || 'Password verification failed' }
    }
  }

  async getUser(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const session = await supabase.auth.getSession()
      if (!session.data.session?.user) {
        return { success: false, error: 'No authenticated user' }
      }

      if(session.data.session.user.user_metadata?.is_active === false) {
        await supabase.auth.signOut()
        return { success: false, error: 'Your account has been deactivated. Please contact your administrator.' }
      }

      const metaRole = session.data.session.user.user_metadata?.role
      if (hasScribeRole(metaRole)) {
        await supabase.auth.signOut()
        this.clearAuthData()
        return {
          success: false,
          error:
            'Accounts with the scribe role cannot access the NurMed dashboard.',
        }
      }

      const { data: doctorData, error } = await supabase
        .from('doctor')
        .select('id, first_name, last_name, sur_name, email, is_active')
        .eq('user_id', session.data.session.user.id)
        .single()

      // Check if doctor account is active
      if (doctorData && !doctorData.is_active) {
        // Sign out the user immediately since they're not allowed to login
        await supabase.auth.signOut()
        return { success: false, error: 'Your account has been deactivated. Please contact your administrator.' }
      }

      if (error || !doctorData) {
        // During invite flow, doctor profile might not exist yet
        // Return user data from session instead
        const user = session.data.session.user
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email || '',
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            role: user.user_metadata?.role || ''
          }
        }
      }

      return {
        success: true,
        user: {
          id: doctorData.id,
          email: doctorData.email,
          first_name: doctorData.first_name || '',
          last_name: doctorData.last_name || '',
          role: session.data.session.user.user_metadata?.role || ''
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to fetch user data' }
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut()
      this.clearAuthData()
    } catch (error) {
      console.error('Logout error:', error)
      // Clear data anyway
      this.clearAuthData()
    }
  }

  // Get current session
  async getSession() {
    return await supabase.auth.getSession()
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const session = await supabase.auth.getSession()
    return !!session.data.session
  }
}

export const supabaseAuthService = SupabaseAuthService.getInstance()