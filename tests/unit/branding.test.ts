import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_BRANDING, applyBranding, getBranding } from '../../src/lib/branding'

afterEach(() => {
  delete window.__ORION_CONFIG__
  document.documentElement.removeAttribute('style')
})

describe('getBranding', () => {
  it('falls back to the built-in defaults when nothing is configured', () => {
    expect(getBranding()).toEqual(DEFAULT_BRANDING)
  })

  it('uses configured name and tagline, trimming whitespace', () => {
    window.__ORION_CONFIG__ = { branding: { name: '  Sunset Live  ', tagline: '  Producción  ' } }
    const result = getBranding()
    expect(result.name).toBe('Sunset Live')
    expect(result.tagline).toBe('Producción')
  })

  it('keeps the default name when the configured name is blank', () => {
    window.__ORION_CONFIG__ = { branding: { name: '   ' } }
    expect(getBranding().name).toBe(DEFAULT_BRANDING.name)
  })

  it('accepts valid hex accent colors', () => {
    window.__ORION_CONFIG__ = { branding: { accent: '#FF5500', accentText: '#000' } }
    const result = getBranding()
    expect(result.accent).toBe('#FF5500')
    expect(result.accentText).toBe('#000')
  })

  it('rejects a non-hex accent so config.js can never inject arbitrary CSS', () => {
    window.__ORION_CONFIG__ = { branding: { accent: 'red; background: url(evil)' } }
    expect(getBranding().accent).toBe('')
  })
})

describe('applyBranding', () => {
  it('sets the document title from the branding name', () => {
    applyBranding({ name: 'Sunset Live', tagline: 't', accent: '', accentText: '' })
    expect(document.title).toBe('Sunset Live')
  })

  it('overrides the accent CSS variables only when a color is provided', () => {
    applyBranding({ name: 'X', tagline: 't', accent: '#123456', accentText: '#ffffff' })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456')
    expect(document.documentElement.style.getPropertyValue('--accent-text')).toBe('#ffffff')
  })

  it('leaves the stylesheet accent untouched when no accent is configured', () => {
    applyBranding({ name: 'X', tagline: 't', accent: '', accentText: '' })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('')
  })
})
