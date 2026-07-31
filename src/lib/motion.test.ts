import { describe, it, expect } from 'vitest'
import {
  fluidEase, springFluid, tweenFluid, tweenExit,
  fadeUp, staggerContainer, cardHover, tapScale, viewportOnce,
  reveal, riseIn, REVEAL_TRANSITION,
} from './motion'

describe('motion tokens', () => {
  it('fluid easing a spec szerinti görbe', () => {
    expect(fluidEase).toEqual([0.32, 0.72, 0, 1])
  })

  it('kilépés rövidebb mint belépés', () => {
    expect(tweenExit.duration!).toBeLessThan(tweenFluid.duration!)
  })

  it('spring ~5% túllövésre hangolt', () => {
    expect(springFluid).toMatchObject({ type: 'spring', stiffness: 260, damping: 30 })
  })

  it('fadeUp csak transform/opacity kulcsokat animál', () => {
    expect(Object.keys(fadeUp.hidden)).toEqual(expect.arrayContaining(['opacity', 'y']))
    expect(fadeUp.hidden).not.toHaveProperty('width')
    expect(fadeUp.hidden).not.toHaveProperty('height')
  })

  it('staggerContainer alapértelmezett 80ms lépcső', () => {
    type WithStagger = { transition: { staggerChildren: number } }
    const v = staggerContainer()
    expect((v.show as WithStagger).transition.staggerChildren).toBeCloseTo(0.08)
    expect((staggerContainer(0.12).show as WithStagger).transition.staggerChildren).toBeCloseTo(0.12)
  })

  it('hover/tap/viewport tokenek', () => {
    expect(cardHover).toMatchObject({ y: -4, scale: 1.015 })
    expect(tapScale).toEqual({ scale: 0.97 })
    expect(viewportOnce).toEqual({ once: true, amount: 0.2 })
  })

  it('örökölt API megmarad (FollowedRow, SeasonGrid) és a fluid görbén fut', () => {
    expect(REVEAL_TRANSITION.ease).toEqual(fluidEase)
    const r = reveal(3)
    expect(r.viewport).toEqual({ once: true, margin: '-40px' })
    expect(r.transition.delay).toBeCloseTo(0.09)
    expect(reveal(99).transition.delay).toBeCloseTo(0.3)
    expect(riseIn.shown).toMatchObject({ opacity: 1, y: 0 })
  })
})
