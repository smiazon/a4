// Utility function to get favicon URL for a website
export function getFaviconUrl(url) {
  if (!url) return null
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const domain = urlObj.hostname
    
    // Use Google's favicon service as a reliable fallback
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch (e) {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/)
    if (match) {
      return `https://www.google.com/s2/favicons?domain=${match[1]}&sz=32`
    }
    return null
  }
}

// Try to get favicon from the actual website first, fallback to Google's service
export async function fetchFavicon(url) {
  if (!url) return null
  
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const origin = urlObj.origin
    
    // Try common favicon locations
    const faviconPaths = [
      `${origin}/favicon.ico`,
      `${origin}/favicon.png`,
      `${origin}/apple-touch-icon.png`
    ]
    
    // For now, use Google's service as it's more reliable
    // In a real browser, we'd check the actual site's favicon
    return getFaviconUrl(url)
  } catch (e) {
    return getFaviconUrl(url)
  }
}
