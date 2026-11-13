import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Spelling Bee')
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy()
  })
})
