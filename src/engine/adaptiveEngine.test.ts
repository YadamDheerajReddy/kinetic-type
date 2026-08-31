import { describe, expect, it } from 'vitest'
import { echoKeyEvent } from './adaptiveEngine'
import type { KeyEvent } from './types'

describe('echoKeyEvent', () => {
  it('echoes the event back with the worker-clock receipt timestamp', () => {
    const event: KeyEvent = {
      code: 'KeyE',
      char: 'e',
      type: 'down',
      t: 1000,
      domain: 'PROSE',
    }

    const result = echoKeyEvent(event, 1004.2)

    expect(result.event).toEqual(event)
    expect(result.workerReceivedAt).toBe(1004.2)
  })
})
