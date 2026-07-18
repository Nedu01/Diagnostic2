import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLogin from './AdminLogin'

const { login } = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../../lib/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/adminApi')>()),
  login,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminLogin', () => {
  it('disables the submit button while the password field is empty', () => {
    render(<AdminLogin onSuccess={vi.fn()} />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('calls onSuccess and shows no alert on ok', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    login.mockResolvedValue('ok')
    render(<AdminLogin onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('Admin password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(onSuccess).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the wrong-password message on wrong_password', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    login.mockResolvedValue('wrong_password')
    render(<AdminLogin onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('Admin password'), 'nope')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That password is not right. Try again.')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows the rate-limit message on rate_limited', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    login.mockResolvedValue('rate_limited')
    render(<AdminLogin onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('Admin password'), 'whatever')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Wait 15 minutes and try again.')
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
