import { describe, it, expect } from 'vitest'
import { parsePagesRange } from '@shared/pages-range'

describe('parsePagesRange', () => {
  it('empty string returns empty array', () => {
    expect(parsePagesRange('', 100)).toEqual([])
  })

  it('single page "5" returns [5]', () => {
    expect(parsePagesRange('5', 100)).toEqual([5])
  })

  it('range "3-6" returns [3,4,5,6]', () => {
    expect(parsePagesRange('3-6', 100)).toEqual([3, 4, 5, 6])
  })

  it('open end "98-" with total 100 returns [98,99,100]', () => {
    expect(parsePagesRange('98-', 100)).toEqual([98, 99, 100])
  })

  it('open start "-3" returns [1,2,3]', () => {
    expect(parsePagesRange('-3', 100)).toEqual([1, 2, 3])
  })

  it('step "1-10/3" returns [1,4,7,10]', () => {
    expect(parsePagesRange('1-10/3', 100)).toEqual([1, 4, 7, 10])
  })

  it('multiple "1-3,7,10-12" returns [1,2,3,7,10,11,12]', () => {
    expect(parsePagesRange('1-3,7,10-12', 100)).toEqual([1, 2, 3, 7, 10, 11, 12])
  })

  it('negative "1-10,!5-7" returns [1,2,3,4,8,9,10]', () => {
    expect(parsePagesRange('1-10,!5-7', 100)).toEqual([1, 2, 3, 4, 8, 9, 10])
  })

  it('negative at start "!5" with total 10 returns [1,2,3,4,6,7,8,9,10]', () => {
    expect(parsePagesRange('!5', 10)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10])
  })

  it('dedup "5,3,5,1" returns [1,3,5]', () => {
    expect(parsePagesRange('5,3,5,1', 100)).toEqual([1, 3, 5])
  })

  it('filter exceeding "8-12" with total 10 returns [8,9,10]', () => {
    expect(parsePagesRange('8-12', 10)).toEqual([8, 9, 10])
  })

  it('full-width comma "1，3，5" returns [1,3,5]', () => {
    expect(parsePagesRange('1，3，5', 100)).toEqual([1, 3, 5])
  })

  it('invalid "abc" returns null', () => {
    expect(parsePagesRange('abc', 100)).toBeNull()
  })
})
