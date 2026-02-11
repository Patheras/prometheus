'use client'

import { useState, useEffect } from 'react'

export function useChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [width, setWidth] = useState(480) // Default width

  // Load saved width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('chatPanelWidth')
    if (savedWidth) {
      setWidth(parseInt(savedWidth, 10))
    }
  }, [])

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  return {
    isOpen,
    width,
    open,
    close,
    toggle,
  }
}
