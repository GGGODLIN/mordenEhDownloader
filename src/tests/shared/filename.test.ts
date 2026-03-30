import { describe, it, expect } from 'vitest'
import { getSafeName, applyTemplate, renameImageDuplicates, numberImageName } from '@shared/filename'

describe('getSafeName', () => {
  it('replaces dangerous chars with dashes', () => {
    expect(getSafeName('hello:world')).toBe('hello-world')
  })

  it('replaces multiple dangerous chars', () => {
    expect(getSafeName('a"b*c?d|e<f>g/h\\i')).toBe('a-b-c-d-e-f-g-h-i')
  })

  it('trims whitespace', () => {
    expect(getSafeName('  hello  ')).toBe('hello')
  })

  it('replaces newline', () => {
    expect(getSafeName('hello\nworld')).toBe('hello-world')
  })

  it('no change for safe name', () => {
    expect(getSafeName('hello world')).toBe('hello world')
  })
})

describe('applyTemplate', () => {
  const vars = {
    gid: '123456',
    token: 'abcdef',
    title: 'My Gallery',
    subtitle: 'Sub Title',
    category: 'Manga',
    uploader: 'Uploader Name',
  }

  it('replaces {title}', () => {
    expect(applyTemplate('{title}', vars)).toBe('My Gallery')
  })

  it('replaces all vars', () => {
    const result = applyTemplate('{gid}-{token}', vars)
    expect(result).toBe('123456-abcdef')
  })

  it('replaces {subtitle} with subtitle when not empty', () => {
    expect(applyTemplate('{subtitle}', vars)).toBe('Sub Title')
  })

  it('uses title when subtitle is empty', () => {
    const v = { ...vars, subtitle: '' }
    expect(applyTemplate('{subtitle}', v)).toBe('My Gallery')
  })

  it('applies getSafeName to title', () => {
    const v = { ...vars, title: 'My:Gallery' }
    expect(applyTemplate('{title}', v)).toBe('My-Gallery')
  })

  it('applies getSafeName to uploader', () => {
    const v = { ...vars, uploader: 'Up/loader' }
    expect(applyTemplate('{uploader}', v)).toBe('Up-loader')
  })

  it('is case insensitive for template vars', () => {
    expect(applyTemplate('{TITLE}', vars)).toBe('My Gallery')
  })
})

describe('renameImageDuplicates', () => {
  it('no duplicates returns same names', () => {
    expect(renameImageDuplicates(['a.jpg', 'b.jpg', 'c.jpg'])).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('adds (2) suffix to second duplicate', () => {
    expect(renameImageDuplicates(['a.jpg', 'a.jpg'])).toEqual(['a.jpg', 'a (2).jpg'])
  })

  it('adds (3) suffix to third duplicate', () => {
    expect(renameImageDuplicates(['a.jpg', 'a.jpg', 'a.jpg'])).toEqual(['a.jpg', 'a (2).jpg', 'a (3).jpg'])
  })

  it('case insensitive duplicate detection', () => {
    expect(renameImageDuplicates(['A.jpg', 'a.jpg'])).toEqual(['A.jpg', 'a (2).jpg'])
  })

  it('handles files without extension', () => {
    expect(renameImageDuplicates(['file', 'file'])).toEqual(['file', 'file (2)'])
  })
})

describe('numberImageName', () => {
  it('pads index based on total length', () => {
    expect(numberImageName('img.jpg', 1, 100, '：')).toBe('001：img.jpg')
  })

  it('single digit total needs 1 digit', () => {
    expect(numberImageName('img.jpg', 1, 9, '：')).toBe('1：img.jpg')
  })

  it('uses custom separator', () => {
    expect(numberImageName('img.jpg', 5, 10, '-')).toBe('05-img.jpg')
  })

  it('pads index for 3 digit total', () => {
    expect(numberImageName('img.jpg', 42, 999, '：')).toBe('042：img.jpg')
  })
})
