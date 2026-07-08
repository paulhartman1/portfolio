'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

export default function PushNotificationSetup() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if push notifications are supported
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window)
  }, [])

  const subscribeToPush = async () => {
    try {
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Please enable notifications to get alerts for help requests')
        return
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      // Save subscription to database
      const subscriptionData = subscription.toJSON()
      const { error } = await supabaseBrowser
        .from('push_subscriptions')
        .insert([{
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys?.p256dh,
          auth: subscriptionData.keys?.auth,
        }])

      if (error) throw error

      setIsSubscribed(true)
      console.log('Push notification subscription saved')
    } catch (error) {
      console.error('Error subscribing to push:', error)
      alert('Failed to subscribe to notifications. Please try again.')
    }
  }

  if (!isSupported) {
    return null // Don't show if not supported
  }

  if (isSubscribed) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
        ✅ Notifications enabled
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
      <span>Get notified when someone needs help</span>
      <button
        onClick={subscribeToPush}
        className="bg-white text-purple-600 px-4 py-1 rounded-md font-semibold hover:bg-purple-50 transition-colors"
      >
        Enable
      </button>
    </div>
  )
}

// Helper to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
