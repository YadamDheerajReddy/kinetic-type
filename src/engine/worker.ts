import * as Comlink from 'comlink'
import { echoKeyEvent } from './adaptiveEngine'
import type { EchoResult, KeyEvent } from './types'

export interface AdaptiveEngineApi {
  echo(event: KeyEvent): EchoResult
}

const api: AdaptiveEngineApi = {
  echo(event) {
    return echoKeyEvent(event, performance.now())
  },
}

Comlink.expose(api)
