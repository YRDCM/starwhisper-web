// 后台鉴权传输方式的回归测试：/admin/** 一律走 X-Admin-Key 请求头，密钥不再落进 query
const { test } = require('node:test')
const assert = require('node:assert/strict')

// api.js 的密钥读写依赖 localStorage，node 环境先注入一个最小实现
const storage = {}
globalThis.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v) },
  removeItem: (k) => { delete storage[k] }
}

let api
test.before(async () => {
  api = await import('../src/api.js')
})

test('setAdminKey / getAdminKey：仍用 starwhisper:adminkey 记忆，可写入与清除', () => {
  api.setAdminKey('s3cret')
  assert.equal(storage['starwhisper:adminkey'], 's3cret')
  assert.equal(api.getAdminKey(), 's3cret')

  api.setAdminKey('')
  assert.equal(storage['starwhisper:adminkey'], undefined) // 清除后不残留
  assert.equal(api.getAdminKey(), '')
})

test('attachAdminKey：后台请求注入 X-Admin-Key 头，并清掉误传的 params.key', () => {
  api.setAdminKey('s3cret')
  const config = { url: '/admin/stats', headers: {}, params: { key: 's3cret' } }
  api.attachAdminKey(config)
  assert.equal(config.headers['X-Admin-Key'], 's3cret')
  assert.ok(!('key' in config.params)) // 兜底：密钥不会回落到 query
  assert.deepEqual(config.params, {})
})

test('attachAdminKey：支持 config.admin 显式标记（路径不在 /admin 下时）', () => {
  api.setAdminKey('s3cret')
  const config = { url: '/internal/metrics', headers: {}, admin: true }
  api.attachAdminKey(config)
  assert.equal(config.headers['X-Admin-Key'], 's3cret')
})

test('attachAdminKey：没有 key 时不发头，交给后端 403 兜底', () => {
  api.setAdminKey('')
  const config = { url: '/admin/users', headers: {} }
  api.attachAdminKey(config)
  assert.equal(config.headers['X-Admin-Key'], undefined)
  assert.deepEqual(config.headers, {})
})

test('attachAdminKey：/admin 路径识别覆盖相对与绝对 URL，不误伤普通接口', () => {
  api.setAdminKey('k1')
  const cases = [
    ['/admin/stats', true],
    ['/admin', true],
    ['/api/admin/users/12/daily-usage?date=2026-10-20', true],
    ['http://localhost:8080/api/admin/config', true],
    ['/signs/list', false],
    ['/api/administrators', false], // admin 段必须完整，不能误判
    ['/user/me?next=/admin/x', false] // 查询串里出现 admin 不算后台接口
  ]
  for (const [url, isAdmin] of cases) {
    const config = { url, headers: {} }
    api.attachAdminKey(config)
    assert.equal(config.headers['X-Admin-Key'], isAdmin ? 'k1' : undefined, url)
  }
})
